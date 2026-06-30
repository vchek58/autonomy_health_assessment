package com.example.model;

public record Observation(
    String id,
    String patientId,
    String display,
    String loincCode,
    Double value,        // null if non-numeric
    String unit,         // null if non-numeric
    String valueString,  // fallback for coded/text observations
    String date
) {}
