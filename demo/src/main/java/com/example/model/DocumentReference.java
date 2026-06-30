package com.example.model;

public record DocumentReference(
    String id,
    String patientId,
    String typeCode,
    String typeDisplay,
    String date
) {}
