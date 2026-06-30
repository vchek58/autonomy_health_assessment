package com.example.model;

public record MedicationRequest(
    String id,
    String patientId,
    String display,
    String rxNormCode,
    String status,
    String date
) {}
