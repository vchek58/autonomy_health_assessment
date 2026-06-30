package com.example.api;

import com.example.model.CohortReport;
import com.example.service.EligibilityService;
import com.example.service.PatientService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/eligibility")
@CrossOrigin(origins = "http://localhost:3000")
public class EligibilityController {

    private final PatientService patientService;
    private final EligibilityService eligibilityService;

    public EligibilityController(PatientService patientService, EligibilityService eligibilityService) {
        this.patientService = patientService;
        this.eligibilityService = eligibilityService;
    }

    /**
     * GET /api/eligibility/cohort
     * Evaluates eligibility for all 1132 patients and returns aggregated counts.
     * Computed on demand from in-memory records — no startup precomputation.
     */
    @GetMapping("/cohort")
    public CohortReport getCohortReport() {
        return eligibilityService.computeCohortReport(patientService.findAll());
    }
}
