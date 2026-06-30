package com.example.model;

public record Procedure(
    String id,
    String patientId,
    String display,
    String code,        // SNOMED or CPT code
    String codeSystem,
    String status,      // "completed" | "in-progress" | "stopped"
    String date         // performedDateTime or performedPeriod.start
) {}
