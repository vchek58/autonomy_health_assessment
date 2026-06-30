package com.example.fhir;

import com.example.model.Condition;
import com.example.model.Observation;
import com.example.model.Patient;
import com.example.model.Procedure;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Converts raw FHIR JsonNode objects into normalized internal model objects.
 * Each method extracts only the fields the application needs and safely handles
 * missing or partial data by returning null for absent fields.
 */
public class FhirNormalizer {

    public static Patient normalizePatient(JsonNode node) {
        String id = text(node, "id");

        String fullName = null;
        String familyName = null;
        List<String> givenNames = Collections.emptyList();
        JsonNode names = node.path("name");
        if (names.isArray() && !names.isEmpty()) {
            JsonNode official = findOfficialName(names);
            familyName = official.path("family").asText(null);

            JsonNode givenNode = official.path("given");
            if (givenNode.isArray() && !givenNode.isEmpty()) {
                List<String> collected = new ArrayList<>();
                for (JsonNode g : givenNode) {
                    collected.add(g.asText());
                }
                givenNames = Collections.unmodifiableList(collected);
            }

            String firstName = givenNames.isEmpty() ? "" : givenNames.get(0);
            fullName = (firstName + " " + (familyName != null ? familyName : "")).trim();
        }

        // birthSex is stored in the extension array, not as a top-level field
        String birthSex = extractExtension(node, "us-core-birthsex", "valueCode");

        String deceasedDate = text(node, "deceasedDateTime");

        return new Patient(id, fullName, familyName, givenNames, text(node, "gender"),
                birthSex, text(node, "birthDate"), deceasedDate);
    }

    public static Condition normalizeCondition(JsonNode node) {
        String id = text(node, "id");
        String patientId = resolveReference(node.path("subject").path("reference").asText(null));

        String display = null;
        String code = null;
        String codeSystem = null;
        JsonNode coding = node.path("code").path("coding");
        if (coding.isArray() && !coding.isEmpty()) {
            JsonNode first = coding.get(0);
            display = first.path("display").asText(null);
            code = first.path("code").asText(null);
            codeSystem = first.path("system").asText(null);
        }
        // Fall back to the top-level text if coding display is absent
        if (display == null) {
            display = node.path("code").path("text").asText(null);
        }

        String status = null;
        JsonNode statusCoding = node.path("clinicalStatus").path("coding");
        if (statusCoding.isArray() && !statusCoding.isEmpty()) {
            status = statusCoding.get(0).path("code").asText(null);
        }

        return new Condition(
                id, patientId, display, code, codeSystem, status,
                text(node, "onsetDateTime"),
                text(node, "abatementDateTime")
        );
    }

    public static Observation normalizeObservation(JsonNode node) {
        String id = text(node, "id");
        String patientId = resolveReference(node.path("subject").path("reference").asText(null));

        String display = null;
        String loincCode = null;
        JsonNode coding = node.path("code").path("coding");
        if (coding.isArray() && !coding.isEmpty()) {
            JsonNode first = coding.get(0);
            display = first.path("display").asText(null);
            loincCode = first.path("code").asText(null);
        }
        if (display == null) {
            display = node.path("code").path("text").asText(null);
        }

        // FHIR observations can carry their value in several different fields
        Double value = null;
        String unit = null;
        String valueString = null;

        if (node.hasNonNull("valueQuantity")) {
            JsonNode vq = node.path("valueQuantity");
            if (vq.hasNonNull("value")) {
                value = vq.path("value").asDouble();
            }
            unit = vq.path("unit").asText(null);
        } else if (node.hasNonNull("valueString")) {
            valueString = node.path("valueString").asText(null);
        } else if (node.hasNonNull("valueCodeableConcept")) {
            valueString = node.path("valueCodeableConcept").path("text").asText(null);
        }
        // TODO: handle valueBoolean, valueInteger, valuePeriod if needed

        // effectivePeriod.start is the fallback when effectiveDateTime is absent
        String date = text(node, "effectiveDateTime");
        if (date == null) {
            date = node.path("effectivePeriod").path("start").asText(null);
        }

        return new Observation(id, patientId, display, loincCode, value, unit, valueString, date);
    }

    public static Procedure normalizeProcedure(JsonNode node) {
        String id = text(node, "id");
        String patientId = resolveReference(node.path("subject").path("reference").asText(null));

        String display = null;
        String code = null;
        String codeSystem = null;
        JsonNode coding = node.path("code").path("coding");
        if (coding.isArray() && !coding.isEmpty()) {
            JsonNode first = coding.get(0);
            display = first.path("display").asText(null);
            code = first.path("code").asText(null);
            codeSystem = first.path("system").asText(null);
        }
        if (display == null) {
            display = node.path("code").path("text").asText(null);
        }

        String date = text(node, "performedDateTime");
        if (date == null) {
            date = node.path("performedPeriod").path("start").asText(null);
        }

        return new Procedure(id, patientId, display, code, codeSystem, text(node, "status"), date);
    }

    // Finds an extension by the last segment of its URL and returns the given value field.
    // e.g. extractExtension(node, "us-core-birthsex", "valueCode") → "F"
    private static String extractExtension(JsonNode node, String urlSuffix, String valueField) {
        JsonNode extensions = node.path("extension");
        if (!extensions.isArray()) return null;
        for (JsonNode ext : extensions) {
            String url = ext.path("url").asText("");
            if (url.endsWith(urlSuffix)) {
                return ext.path(valueField).asText(null);
            }
        }
        return null;
    }

    // Returns the name entry with use="official", falling back to the first entry if none found
    private static JsonNode findOfficialName(JsonNode names) {
        for (JsonNode name : names) {
            if ("official".equals(name.path("use").asText(null))) {
                return name;
            }
        }
        return names.get(0);
    }

    // "Patient/abc-123" → "abc-123"
    // Handles query-style references like "Location?identifier=..." by returning null
    static String resolveReference(String reference) {
        if (reference == null || !reference.contains("/")) return null;
        if (reference.contains("?")) return null; // query-style reference, not resolvable
        return reference.substring(reference.indexOf('/') + 1);
    }

    private static String text(JsonNode node, String field) {
        JsonNode n = node.path(field);
        return n.isMissingNode() || n.isNull() ? null : n.asText();
    }
}
