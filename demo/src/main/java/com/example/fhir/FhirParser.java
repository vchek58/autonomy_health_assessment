package com.example.fhir;

import com.example.model.Condition;
import com.example.model.Observation;
import com.example.model.Patient;
import com.example.model.PatientRecord;
import com.example.model.Procedure;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class FhirParser {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Path dataDirectory;

    public FhirParser(@Value("${fhir.data.directory}") String dataDirectory) {
        this.dataDirectory = Paths.get(dataDirectory);
    }

    /**
     * Parses all FHIR NDJSON files in the data directory and returns a map of
     * patientId → PatientRecord containing all their normalized resources.
     *
     * Sequential baseline: files are read one at a time.
     * TODO (performance optimization): after benchmarking this baseline, switch
     *   Observation file parsing to parallel using CompletableFuture or parallelStream
     *   to exploit multi-core I/O. Observation has 14 shards and is the dominant cost.
     *   Note: the accumulator maps below must be replaced with ConcurrentHashMap and
     *   thread-safe list types before parallelizing.
     */
    public Map<String, PatientRecord> parseAll() throws IOException {
        if (!Files.exists(dataDirectory)) {
            // TODO: throw a startup exception with a helpful message so the user
            //   knows to set fhir.data.directory in application.properties
            System.err.println("FHIR data directory not found: " + dataDirectory.toAbsolutePath());
            return Collections.emptyMap();
        }

        long start = System.currentTimeMillis();

        // Step 1: Patients must be parsed first so we can key everything else off their IDs
        Map<String, Patient> patients = parsePatients();

        // Step 2: Initialize per-patient accumulator lists
        Map<String, List<Condition>> conditionsByPatient = new HashMap<>();
        Map<String, List<Observation>> observationsByPatient = new HashMap<>();
        Map<String, List<Procedure>> proceduresByPatient = new HashMap<>();
        for (String id : patients.keySet()) {
            conditionsByPatient.put(id, new ArrayList<>());
            observationsByPatient.put(id, new ArrayList<>());
            proceduresByPatient.put(id, new ArrayList<>());
        }

        // Step 3: Parse remaining resource types and group by patient
        // --- SEQUENTIAL BASELINE (measure this before optimizing) ---
        long conditionStart = System.currentTimeMillis();
        parseResourceFiles("Condition", node -> {
            Condition c = FhirNormalizer.normalizeCondition(node);
            if (c.patientId() != null) {
                conditionsByPatient.computeIfAbsent(c.patientId(), k -> new ArrayList<>()).add(c);
            }
        });
        System.out.printf("Conditions parsed in %d ms%n", System.currentTimeMillis() - conditionStart);

        // TODO: record observationStart time here for the before/after benchmark
        long observationStart = System.currentTimeMillis();
        parseResourceFiles("Observation", node -> {
            Observation o = FhirNormalizer.normalizeObservation(node);
            if (o.patientId() != null) {
                observationsByPatient.computeIfAbsent(o.patientId(), k -> new ArrayList<>()).add(o);
            }
        });
        System.out.printf("Observations parsed in %d ms%n", System.currentTimeMillis() - observationStart);

        long procedureStart = System.currentTimeMillis();
        parseResourceFiles("Procedure", node -> {
            Procedure p = FhirNormalizer.normalizeProcedure(node);
            if (p.patientId() != null) {
                proceduresByPatient.computeIfAbsent(p.patientId(), k -> new ArrayList<>()).add(p);
            }
        });
        System.out.printf("Procedures parsed in %d ms%n", System.currentTimeMillis() - procedureStart);

        // TODO: parse MedicationRequest and DocumentReference if needed for Part C
        //   (prior weight-loss attempt evidence and psychological evaluation docs
        //   may be in these resource types)

        // Step 4: Assemble final PatientRecord map
        Map<String, PatientRecord> records = new HashMap<>();
        for (Map.Entry<String, Patient> entry : patients.entrySet()) {
            String id = entry.getKey();
            records.put(id, new PatientRecord(
                    entry.getValue(),
                    conditionsByPatient.getOrDefault(id, List.of()),
                    observationsByPatient.getOrDefault(id, List.of()),
                    proceduresByPatient.getOrDefault(id, List.of())
            ));
        }

        System.out.printf("Total: parsed %d patients in %d ms%n",
                records.size(), System.currentTimeMillis() - start);

        return records;
    }

    private Map<String, Patient> parsePatients() throws IOException {
        Map<String, Patient> patients = new HashMap<>();
        for (Path file : getNdjsonFiles("Patient")) {
            readLines(file, node -> {
                Patient p = FhirNormalizer.normalizePatient(node);
                if (p.id() != null) {
                    patients.put(p.id(), p);
                }
            });
        }
        return patients;
    }

    /**
     * Finds all shards for a resource type (e.g. "Observation.000.ndjson",
     * "Observation.001.ndjson", ...) and invokes the consumer for each JSON line.
     */
    private void parseResourceFiles(String resourceType, ResourceConsumer consumer) throws IOException {
        for (Path file : getNdjsonFiles(resourceType)) {
            readLines(file, consumer);
        }
    }

    private void readLines(Path file, ResourceConsumer consumer) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(file)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                try {
                    JsonNode node = mapper.readTree(line);
                    consumer.accept(node);
                } catch (Exception e) {
                    // TODO: replace with structured logging (slf4j) so malformed lines
                    //   are traceable without stopping the entire parse
                    System.err.printf("Skipping malformed line in %s: %s%n", file.getFileName(), e.getMessage());
                }
            }
        }
    }

    private List<Path> getNdjsonFiles(String resourceType) throws IOException {
        return Files.list(dataDirectory)
                .filter(p -> {
                    String name = p.getFileName().toString();
                    return name.startsWith(resourceType + ".") && name.endsWith(".ndjson");
                })
                .sorted()
                .collect(Collectors.toList());
    }

    @FunctionalInterface
    private interface ResourceConsumer {
        void accept(JsonNode node) throws Exception;
    }
}
