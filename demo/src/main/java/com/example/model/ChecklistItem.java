package com.example.model;

import java.util.List;

public record ChecklistItem(
    String requirement,
    ChecklistStatus status,
    List<String> evidenceIds
) {}
