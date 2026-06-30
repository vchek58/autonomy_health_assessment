package com.example.model;

import java.util.Map;

// Percentages are intentionally omitted — computed by the frontend from raw counts
// to avoid rounding disagreements between layers.
public record CohortReport(
    int totalPatients,
    int eligibleCount,
    int notEligibleCount,
    int unknownCount,
    Map<UnknownReason, Long> unknownReasonBreakdown
) {}
