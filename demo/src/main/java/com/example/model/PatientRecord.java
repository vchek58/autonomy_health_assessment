package com.example.model;

import java.util.List;

// Aggregate of all FHIR resources belonging to one patient.
// This is the primary unit passed to the frontend and eligibility logic.
public record PatientRecord(
    Patient patient,
    List<Condition> conditions,
    List<Observation> observations,
    List<Procedure> procedures
) {}
