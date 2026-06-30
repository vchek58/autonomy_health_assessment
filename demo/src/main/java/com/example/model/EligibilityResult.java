package com.example.model;

import java.util.List;

public record EligibilityResult(
    EligibilityStatus status,
    Double bmiValue,
    String bmiObservationId,
    List<String> matchedComorbidityIds,
    List<String> weightLossEvidenceIds,
    List<String> psychEvalEvidenceIds,
    List<UnknownReason> unknownReasons
) {}
