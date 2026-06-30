package com.example.api;

import com.example.model.Patient;
import com.example.model.PatientRecord;
import com.example.service.PatientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.List;

@RestController
@RequestMapping("/api/patients")
@CrossOrigin(origins = "http://localhost:3000") // Next.js dev server
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    /**
     * GET /api/patients
     * Returns all patients. Used to populate the Part B patient selector dropdown.
     *
     * TODO: this returns full PatientRecords (with all observations/conditions/procedures).
     *   For the selector dropdown only Patient summaries are needed — add a
     *   GET /api/patients/summaries endpoint that returns List<Patient> to avoid
     *   sending megabytes of data just to render a name list.
     */
    @GetMapping
    public Collection<PatientRecord> getAllPatients() {
        return patientService.findAll();
    }

    /**
     * GET /api/patients/{id}
     * Returns a single patient's full record. Used by the Part B clinical snapshot
     * and timeline views when a patient is selected.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PatientRecord> getPatient(@PathVariable String id) {
        return patientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/patients/search?name=xyz
     * Returns patients whose name contains the query string (case-insensitive).
     * Used by the Part B patient selector search box.
     *
     * TODO: wire this up in the Next.js frontend with a debounced input so a
     *   network call isn't fired on every keystroke
     */
    @GetMapping("/search")
    public List<Patient> searchByName(@RequestParam String name) {
        return patientService.searchByName(name);
    }

    // TODO: add GET /api/patients/{id}/eligibility for Part C per-patient eligibility
    // TODO: add GET /api/patients/{id}/ai-review for Part D AI-assisted review
}
