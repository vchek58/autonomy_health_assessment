package com.example.model;

import java.util.List;

public record AiReview(
    String clinicalSummary,
    EligibilityResult eligibilityAssessment,
    List<ChecklistItem> checklist,
    List<String> recommendedNextSteps,
    String generatedAt,
    boolean degraded
) {}
