package com.example.service;

import com.example.model.CohortReport;
import com.example.model.Condition;
import com.example.model.EligibilityResult;
import com.example.model.EligibilityStatus;
import com.example.model.Observation;
import com.example.model.PatientRecord;
import com.example.model.UnknownReason;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class EligibilityService {

    private static final String BMI_LOINC = "39156-5";

    // Verified against the actual dataset — codes not present in the data have been excluded.
    // See PART_C_PLAN.md for the full verification table.
    private static final Set<String> COMORBIDITY_SNOMED = Set.of(
        "59621000",      // Essential hypertension
        "44054006",      // Diabetes mellitus type 2
        "55822004",      // Hyperlipidemia
        "73430006",      // Sleep apnea
        "1551000119108"  // Nonproliferative diabetic retinopathy due to T2DM
    );

    // Procedure codes for weight-management evidence present in this dataset.
    // Original plan codes (182922004, 401271004) do not appear in the data.
    private static final Set<String> WEIGHT_LOSS_PROCEDURE_CODES = Set.of(
        "228557008",  // Cognitive and behavioral therapy
        "410299006",  // Lab findings education, guidance, and counseling
        "410314003"   // Health promotion education, guidance, and counseling
    );

    // Only liraglutide (897122) appears in this 1132-patient synthetic dataset.
    private static final Set<String> ANTI_OBESITY_RX_CODES = Set.of(
        "897122"  // 3 ML liraglutide 6 MG/ML Pen Injector
    );

    // Dataset has no dedicated psych eval document type — procedures are the only signal.
    private static final Set<String> PSYCH_EVAL_PROCEDURE_CODES = Set.of(
        "385892000",  // Mental health screening
        "312384001",  // Multidisciplinary assessment
        "200619008"   // Comprehensive interview and evaluation
    );

    public EligibilityResult evaluatePatient(PatientRecord record) {
        List<UnknownReason> unknownReasons = new ArrayList<>();

        // Step 1: BMI — most recent observation with LOINC 39156-5
        Observation latestBmi = record.observations().stream()
                .filter(o -> BMI_LOINC.equals(o.loincCode()) && o.value() != null && o.date() != null)
                .max(Comparator.comparing(Observation::date))
                .orElse(null);

        Double bmiValue = null;
        String bmiObservationId = null;
        if (latestBmi == null) {
            unknownReasons.add(UnknownReason.MISSING_BMI_OBSERVATION);
        } else {
            bmiValue = latestBmi.value();
            bmiObservationId = latestBmi.id();
        }

        // Step 2: Comorbidities — active conditions with verified SNOMED codes
        List<String> matchedComorbidityIds = record.conditions().stream()
                .filter(c -> "active".equals(c.status()) && COMORBIDITY_SNOMED.contains(c.code()))
                .map(Condition::id)
                .collect(Collectors.toList());

        // Step 3a: Prior weight-loss evidence — procedures then anti-obesity medications
        List<String> weightLossEvidenceIds = new ArrayList<>();
        record.procedures().stream()
                .filter(p -> WEIGHT_LOSS_PROCEDURE_CODES.contains(p.code()))
                .map(com.example.model.Procedure::id)
                .forEach(weightLossEvidenceIds::add);
        record.medicationRequests().stream()
                .filter(mr -> ANTI_OBESITY_RX_CODES.contains(mr.rxNormCode()))
                .map(com.example.model.MedicationRequest::id)
                .forEach(weightLossEvidenceIds::add);
        if (weightLossEvidenceIds.isEmpty()) {
            unknownReasons.add(UnknownReason.MISSING_PRIOR_WEIGHT_LOSS_EVIDENCE);
        }

        // Step 3b: Psych eval — procedure codes only (no dedicated doc type in this dataset)
        List<String> psychEvalEvidenceIds = record.procedures().stream()
                .filter(p -> PSYCH_EVAL_PROCEDURE_CODES.contains(p.code()))
                .map(com.example.model.Procedure::id)
                .collect(Collectors.toList());
        if (psychEvalEvidenceIds.isEmpty()) {
            unknownReasons.add(UnknownReason.MISSING_PSYCH_EVAL_EVIDENCE);
        }

        // Step 4: Classify
        // unknownReasons at the bmi >= 40 / 35-40 branches only contains documentation gaps,
        // since MISSING_BMI_OBSERVATION is only added when bmiValue is null.
        EligibilityStatus status;
        if (bmiValue == null) {
            status = EligibilityStatus.UNKNOWN;
        } else if (bmiValue < 35.0) {
            status = EligibilityStatus.NOT_ELIGIBLE;
        } else if (bmiValue >= 40.0) {
            status = unknownReasons.isEmpty() ? EligibilityStatus.ELIGIBLE : EligibilityStatus.UNKNOWN;
        } else {
            // 35 <= bmi < 40
            if (matchedComorbidityIds.isEmpty()) {
                status = EligibilityStatus.NOT_ELIGIBLE;
            } else {
                status = unknownReasons.isEmpty() ? EligibilityStatus.ELIGIBLE : EligibilityStatus.UNKNOWN;
            }
        }

        return new EligibilityResult(
                status, bmiValue, bmiObservationId,
                matchedComorbidityIds, weightLossEvidenceIds, psychEvalEvidenceIds,
                unknownReasons
        );
    }

    public CohortReport computeCohortReport(Collection<PatientRecord> records) {
        int total = 0, eligible = 0, notEligible = 0, unknown = 0;
        Map<UnknownReason, Long> breakdown = new EnumMap<>(UnknownReason.class);

        for (PatientRecord record : records) {
            total++;
            EligibilityResult result = evaluatePatient(record);
            switch (result.status()) {
                case ELIGIBLE -> eligible++;
                case NOT_ELIGIBLE -> notEligible++;
                case UNKNOWN -> {
                    unknown++;
                    for (UnknownReason reason : result.unknownReasons()) {
                        breakdown.merge(reason, 1L, Long::sum);
                    }
                }
            }
        }

        return new CohortReport(total, eligible, notEligible, unknown, breakdown);
    }
}
