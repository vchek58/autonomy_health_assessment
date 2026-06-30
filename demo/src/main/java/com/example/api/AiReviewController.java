package com.example.api;

import com.example.model.AiReview;
import com.example.service.AiReviewService;
import com.example.service.EligibilityService;
import com.example.service.PatientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/patients")
@CrossOrigin(origins = "http://localhost:3000")
public class AiReviewController {

    private final PatientService patientService;
    private final EligibilityService eligibilityService;
    private final AiReviewService aiReviewService;

    public AiReviewController(PatientService patientService, EligibilityService eligibilityService,
            AiReviewService aiReviewService) {
        this.patientService = patientService;
        this.eligibilityService = eligibilityService;
        this.aiReviewService = aiReviewService;
    }

    /**
     * POST /api/patients/{id}/ai-review
     * Generates an AI-assisted clinical review for one patient. Returns 503 if the
     * ANTHROPIC_API_KEY environment variable is not set. The response always includes
     * a degraded=true flag when the AI call fails so the frontend can render a fallback.
     */
    @PostMapping("/{id}/ai-review")
    public ResponseEntity<?> generateReview(@PathVariable String id) {
        if (!aiReviewService.isAvailable()) {
            return ResponseEntity.status(503)
                    .body(Map.of("error",
                            "AI review is not configured. Set the ANTHROPIC_API_KEY environment variable."));
        }

        return patientService.findById(id)
                .map(record -> {
                    var eligibility = eligibilityService.evaluatePatient(record);
                    AiReview review = aiReviewService.generateReview(record, eligibility);
                    return ResponseEntity.ok(review);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
