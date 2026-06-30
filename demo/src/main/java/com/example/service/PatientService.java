package com.example.service;

import com.example.fhir.FhirParser;
import com.example.model.Patient;
import com.example.model.PatientRecord;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class PatientService {

    private final FhirParser parser;

    // Parsed once at startup, then served from memory for all requests
    private Map<String, PatientRecord> records = Collections.emptyMap();

    public PatientService(FhirParser parser) {
        this.parser = parser;
    }

    @PostConstruct
    public void load() throws IOException {
        this.records = parser.parseAll();
    }

    public Collection<PatientRecord> findAll() {
        return records.values();
    }

    public Optional<PatientRecord> findById(String id) {
        return Optional.ofNullable(records.get(id));
    }

    /**
     * Returns all patients whose full name contains the query string (case-insensitive).
     * Used by the Part B patient selector search box.
     * TODO: if 1000 patients is too slow for prefix search, build a trie or use
     *   a simple sorted list with binary search on startup
     */
    public List<Patient> searchByName(String query) {
        String lower = query.toLowerCase();
        return records.values().stream()
                .map(PatientRecord::patient)
                .filter(p -> p.fullName() != null && p.fullName().toLowerCase().contains(lower))
                .collect(Collectors.toList());
    }

    // TODO: add findByEligibilityStatus(String status) for the Part C cohort report endpoint
}
