package com.example.model;

public record Patient(
    String id,
    String fullName,
    String gender,
    String birthDate   // ISO-8601 date string e.g. "1961-02-11"
) {}
