package com.example.model;

public record Condition(
    String id,
    String patientId,
    String display,
    String code,        // SNOMED code
    String codeSystem,
    String status,      // "active" | "resolved" | "inactive"
    String onsetDate,
    String abatementDate
) {}
