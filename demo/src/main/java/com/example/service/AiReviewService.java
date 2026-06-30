package com.example.service;

import com.example.model.AiReview;
import com.example.model.ChecklistItem;
import com.example.model.ChecklistStatus;
import com.example.model.Condition;
import com.example.model.EligibilityResult;
import com.example.model.Patient;
import com.example.model.PatientRecord;
import com.example.model.UnknownReason;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AiReviewService {

    private static final String ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-sonnet-4-6";

    private final String apiKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AiReviewService(
            @Value("${anthropic.api.key:}") String apiKey,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public AiReview generateReview(PatientRecord record, EligibilityResult eligibility) {
        String generatedAt = Instant.now().toString();
        Set<String> scopedIds = buildScopedIds(eligibility);

        try {
            String requestJson = buildRequestJson(record, eligibility, scopedIds);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ANTHROPIC_URL))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                return buildDegradedReview(eligibility, generatedAt);
            }

            JsonNode body = objectMapper.readTree(response.body());
            for (JsonNode item : body.path("content")) {
                if ("tool_use".equals(item.path("type").asText())
                        && "submit_review".equals(item.path("name").asText())) {
                    return parseToolInput(item.path("input"), eligibility, scopedIds, generatedAt);
                }
            }

            return buildDegradedReview(eligibility, generatedAt);

        } catch (Exception e) {
            return buildDegradedReview(eligibility, generatedAt);
        }
    }

    // ── Request building ──────────────────────────────────────────────────────

    private String buildRequestJson(PatientRecord record, EligibilityResult eligibility, Set<String> scopedIds)
            throws Exception {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", MODEL);
        root.put("max_tokens", 1024);

        // Force tool use so the response is always structured JSON
        ObjectNode toolChoice = root.putObject("tool_choice");
        toolChoice.put("type", "tool");
        toolChoice.put("name", "submit_review");

        root.putArray("tools").add(buildToolDefinition());
        root.put("system", buildSystemPrompt(scopedIds));

        ArrayNode messages = root.putArray("messages");
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        userMsg.put("content", buildUserMessage(record, eligibility));

        return objectMapper.writeValueAsString(root);
    }

    private ObjectNode buildToolDefinition() {
        ObjectNode tool = objectMapper.createObjectNode();
        tool.put("name", "submit_review");
        tool.put("description", "Submit the structured clinical review for this patient.");

        ObjectNode schema = tool.putObject("input_schema");
        schema.put("type", "object");
        schema.putArray("required").add("clinicalSummary").add("checklist").add("recommendedNextSteps");

        ObjectNode props = schema.putObject("properties");

        ObjectNode summaryProp = props.putObject("clinicalSummary");
        summaryProp.put("type", "string");
        summaryProp.put("description", "2-3 sentence clinical narrative grounded in documented FHIR evidence.");

        ObjectNode checklistProp = props.putObject("checklist");
        checklistProp.put("type", "array");
        ObjectNode itemSchema = checklistProp.putObject("items");
        itemSchema.put("type", "object");
        itemSchema.putArray("required").add("requirement").add("status").add("evidenceIds");
        ObjectNode itemProps = itemSchema.putObject("properties");
        itemProps.putObject("requirement").put("type", "string");
        ObjectNode statusProp = itemProps.putObject("status");
        statusProp.put("type", "string");
        statusProp.putArray("enum").add("MET").add("NOT_MET").add("UNKNOWN");
        ObjectNode evidProp = itemProps.putObject("evidenceIds");
        evidProp.put("type", "array");
        evidProp.putObject("items").put("type", "string");

        ObjectNode nextStepsProp = props.putObject("recommendedNextSteps");
        nextStepsProp.put("type", "array");
        nextStepsProp.putObject("items").put("type", "string");

        return tool;
    }

    private String buildSystemPrompt(Set<String> scopedIds) {
        String idList = scopedIds.isEmpty() ? "(none)" : String.join(", ", scopedIds);
        return "You are a clinical reviewer assistant for bariatric surgery prior authorization.\n"
                + "Your role is to narrate the deterministic eligibility assessment — not to override the eligibility decision.\n"
                + "The final eligibility determination is computed by the system and is always authoritative.\n\n"
                + "Instructions for clinicalSummary:\n"
                + "- Write 2-3 sentences summarizing the patient's clinical picture as it relates to bariatric eligibility.\n"
                + "- Only assert claims that are directly supported by the FHIR evidence IDs listed below.\n"
                + "- Do not use speculative language (may, might, could, possibly) without a specific documented basis.\n"
                + "- Do not restate the eligibility verdict — the clinician can already see it.\n\n"
                + "Instructions for checklist:\n"
                + "- Use only the four fixed requirement labels provided in the user message.\n"
                + "- Status must be MET, NOT_MET, or UNKNOWN. Use UNKNOWN when a requirement does not apply or documentation is missing.\n"
                + "- evidenceIds must only contain IDs from this scoped list — do not cite any other IDs: " + idList + "\n\n"
                + "Instructions for recommendedNextSteps:\n"
                + "- List concrete, actionable steps only for requirements that are NOT_MET or UNKNOWN.\n"
                + "- If no action is needed, return [\"No further action required.\"]";
    }

    private String buildUserMessage(PatientRecord record, EligibilityResult eligibility) {
        StringBuilder sb = new StringBuilder();
        Patient patient = record.patient();

        sb.append("Patient: ")
                .append(patient.fullName() != null ? patient.fullName() : "Unknown")
                .append(", DOB ").append(patient.birthDate() != null ? patient.birthDate() : "unknown")
                .append(", ").append(patient.birthSex() != null ? patient.birthSex()
                        : patient.gender() != null ? patient.gender() : "sex unknown")
                .append("\n\n");

        sb.append("=== ELIGIBILITY ASSESSMENT (system-computed) ===\n");
        sb.append("Status: ").append(eligibility.status()).append("\n\n");

        if (eligibility.bmiValue() != null) {
            sb.append("BMI: ").append(String.format("%.1f", eligibility.bmiValue()))
                    .append(" (FHIR Observation ID: ").append(eligibility.bmiObservationId()).append(")\n");
        } else {
            sb.append("BMI: No observation recorded\n");
        }

        sb.append("\nComorbidities matched (active):\n");
        if (eligibility.matchedComorbidityIds().isEmpty()) {
            sb.append("  None matched\n");
        } else {
            Map<String, String> condMap = record.conditions().stream()
                    .collect(Collectors.toMap(
                            Condition::id,
                            c -> c.display() != null ? c.display() : "Unknown",
                            (a, b) -> a));
            for (String id : eligibility.matchedComorbidityIds()) {
                sb.append("  - ").append(condMap.getOrDefault(id, "Unknown"))
                        .append(" (FHIR ID: ").append(id).append(")\n");
            }
        }

        sb.append("\nPrior weight-loss program evidence:\n");
        if (eligibility.weightLossEvidenceIds().isEmpty()) {
            sb.append("  None found\n");
        } else {
            for (String id : eligibility.weightLossEvidenceIds()) {
                sb.append("  - FHIR ID: ").append(id).append("\n");
            }
        }

        sb.append("\nPsychological evaluation:\n");
        if (eligibility.psychEvalEvidenceIds().isEmpty()) {
            sb.append("  None found\n");
        } else {
            for (String id : eligibility.psychEvalEvidenceIds()) {
                sb.append("  - FHIR ID: ").append(id).append("\n");
            }
        }

        if (!eligibility.unknownReasons().isEmpty()) {
            sb.append("\nMissing documentation:\n");
            for (UnknownReason reason : eligibility.unknownReasons()) {
                sb.append("  - ").append(reason.name()).append("\n");
            }
        }

        sb.append("\n=== PATIENT CONTEXT ===\n");
        sb.append("Active conditions:\n");
        record.conditions().stream()
                .filter(c -> "active".equals(c.status()))
                .limit(10)
                .forEach(c -> sb.append("  - ")
                        .append(c.display() != null ? c.display() : "Unknown")
                        .append(" (onset: ").append(c.onsetDate() != null ? c.onsetDate() : "unknown").append(")\n"));

        sb.append("\nRecent procedures (up to 5):\n");
        record.procedures().stream()
                .filter(p -> p.date() != null)
                .sorted((a, b) -> b.date().compareTo(a.date()))
                .limit(5)
                .forEach(p -> sb.append("  - ")
                        .append(p.display() != null ? p.display() : "Unknown")
                        .append(" (").append(p.date()).append(")\n"));

        sb.append("\n=== REQUIREMENTS TO ASSESS ===\n");
        sb.append("Complete the checklist for these four requirements (use these exact labels):\n");
        sb.append("1. \"BMI ≥ 35 (≥ 40 without comorbidity required)\"\n");
        sb.append("2. \"Qualifying comorbidity (required if BMI 35–40)\"\n");
        sb.append("3. \"Prior weight-loss program evidence\"\n");
        sb.append("4. \"Psychological evaluation\"\n");

        return sb.toString();
    }

    // ── Response parsing ──────────────────────────────────────────────────────

    private AiReview parseToolInput(JsonNode input, EligibilityResult eligibility,
            Set<String> scopedIds, String generatedAt) {
        String clinicalSummary = input.path("clinicalSummary").asText("AI review could not be completed.");

        List<String> nextSteps = new ArrayList<>();
        JsonNode nextStepsNode = input.path("recommendedNextSteps");
        if (nextStepsNode.isArray()) {
            for (JsonNode step : nextStepsNode) {
                nextSteps.add(step.asText());
            }
        }

        List<ChecklistItem> checklist = new ArrayList<>();
        JsonNode checklistNode = input.path("checklist");
        if (checklistNode.isArray()) {
            for (JsonNode item : checklistNode) {
                String requirement = item.path("requirement").asText();
                ChecklistStatus status;
                try {
                    status = ChecklistStatus.valueOf(item.path("status").asText("UNKNOWN"));
                } catch (IllegalArgumentException e) {
                    status = ChecklistStatus.UNKNOWN;
                }

                List<String> evidenceIds = new ArrayList<>();
                JsonNode evidNode = item.path("evidenceIds");
                if (evidNode.isArray()) {
                    for (JsonNode id : evidNode) {
                        String idStr = id.asText();
                        if (scopedIds.contains(idStr)) {
                            evidenceIds.add(idStr);
                        }
                        // IDs not in the scoped list are silently dropped (hallucination guard)
                    }
                }

                checklist.add(new ChecklistItem(requirement, status, evidenceIds));
            }
        }

        if (checklist.isEmpty()) {
            return buildDegradedReview(eligibility, generatedAt);
        }

        return new AiReview(clinicalSummary, eligibility, checklist, nextSteps, generatedAt, false);
    }

    // ── Degraded fallback ─────────────────────────────────────────────────────

    private AiReview buildDegradedReview(EligibilityResult eligibility, String generatedAt) {
        return new AiReview(
                "AI review could not be completed.",
                eligibility,
                buildDegradedChecklist(eligibility),
                List.of(),
                generatedAt,
                true
        );
    }

    private List<ChecklistItem> buildDegradedChecklist(EligibilityResult eligibility) {
        List<ChecklistItem> items = new ArrayList<>();

        // BMI
        ChecklistStatus bmiStatus;
        if (eligibility.bmiValue() == null) {
            bmiStatus = ChecklistStatus.UNKNOWN;
        } else if (eligibility.bmiValue() >= 35.0) {
            bmiStatus = ChecklistStatus.MET;
        } else {
            bmiStatus = ChecklistStatus.NOT_MET;
        }
        List<String> bmiEvidence = eligibility.bmiObservationId() != null
                ? List.of(eligibility.bmiObservationId()) : List.of();
        items.add(new ChecklistItem("BMI ≥ 35 (≥ 40 without comorbidity required)", bmiStatus, bmiEvidence));

        // Qualifying comorbidity — UNKNOWN means "not required" when BMI >= 40
        ChecklistStatus comorbStatus;
        if (eligibility.bmiValue() != null && eligibility.bmiValue() >= 40.0) {
            comorbStatus = ChecklistStatus.UNKNOWN;
        } else if (!eligibility.matchedComorbidityIds().isEmpty()) {
            comorbStatus = ChecklistStatus.MET;
        } else {
            comorbStatus = ChecklistStatus.NOT_MET;
        }
        items.add(new ChecklistItem("Qualifying comorbidity (required if BMI 35–40)",
                comorbStatus, eligibility.matchedComorbidityIds()));

        // Prior weight-loss evidence
        items.add(new ChecklistItem("Prior weight-loss program evidence",
                !eligibility.weightLossEvidenceIds().isEmpty() ? ChecklistStatus.MET : ChecklistStatus.NOT_MET,
                eligibility.weightLossEvidenceIds()));

        // Psychological evaluation
        items.add(new ChecklistItem("Psychological evaluation",
                !eligibility.psychEvalEvidenceIds().isEmpty() ? ChecklistStatus.MET : ChecklistStatus.NOT_MET,
                eligibility.psychEvalEvidenceIds()));

        return items;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Set<String> buildScopedIds(EligibilityResult eligibility) {
        Set<String> ids = new HashSet<>();
        if (eligibility.bmiObservationId() != null) ids.add(eligibility.bmiObservationId());
        ids.addAll(eligibility.matchedComorbidityIds());
        ids.addAll(eligibility.weightLossEvidenceIds());
        ids.addAll(eligibility.psychEvalEvidenceIds());
        return ids;
    }
}
