package com.example.fhir;

import com.example.model.Condition;
import com.example.model.DocumentReference;
import com.example.model.MedicationRequest;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Component
public class FhirParser {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Path dataDirectory;

    public FhirParser(@Value("${fhir.data.directory}") String dataDirectory) {
        this.dataDirectory = Paths.get(dataDirectory);
    }

    /**
     * Parses all FHIR NDJSON files and returns a map of patientId → PatientRecord.
     * Uses parallel observation parsing. To benchmark sequential vs parallel, swap
     * parseObservationFilesInParallel() for parseObservationFilesSequentially() below.
     */
    public Map<String, PatientRecord> parseAll() throws IOException {
        if (!Files.exists(dataDirectory)) {
            // TODO: throw a startup exception with a helpful message so the user
            //   knows to set fhir.data.directory in application.properties
            System.err.println("FHIR data directory not found: " + dataDirectory.toAbsolutePath());
            return Collections.emptyMap();
        }

        long start = System.currentTimeMillis();

        // Step 1: Patients must be parsed first — all other resources reference their IDs
        Map<String, Patient> patients = parsePatients();

        // Step 2: Parse conditions
        long conditionStart = System.currentTimeMillis();
        Map<String, List<Condition>> conditionsByPatient = new HashMap<>();
        parseResourceFiles("Condition", node -> {
            Condition c = FhirNormalizer.normalizeCondition(node);
            if (c.patientId() != null) {
                conditionsByPatient.computeIfAbsent(c.patientId(), k -> new ArrayList<>()).add(c);
            }
        });
        System.out.printf("Conditions parsed in %d ms%n", System.currentTimeMillis() - conditionStart);

        // Step 3: Parse observations — swap methods here to compare performance
        Map<String, List<Observation>> observationsByPatient = parseObservationFilesInParallel();

        // Step 4: Parse procedures
        long procedureStart = System.currentTimeMillis();
        Map<String, List<Procedure>> proceduresByPatient = new HashMap<>();
        parseResourceFiles("Procedure", node -> {
            Procedure p = FhirNormalizer.normalizeProcedure(node);
            if (p.patientId() != null) {
                proceduresByPatient.computeIfAbsent(p.patientId(), k -> new ArrayList<>()).add(p);
            }
        });
        System.out.printf("Procedures parsed in %d ms%n", System.currentTimeMillis() - procedureStart);

        // Step 5: Parse medication requests
        long medStart = System.currentTimeMillis();
        Map<String, List<MedicationRequest>> medicationsByPatient = new HashMap<>();
        parseResourceFiles("MedicationRequest", node -> {
            MedicationRequest mr = FhirNormalizer.normalizeMedicationRequest(node);
            if (mr.patientId() != null) {
                medicationsByPatient.computeIfAbsent(mr.patientId(), k -> new ArrayList<>()).add(mr);
            }
        });
        System.out.printf("MedicationRequests parsed in %d ms%n", System.currentTimeMillis() - medStart);

        // Step 6: Parse document references
        long docStart = System.currentTimeMillis();
        Map<String, List<DocumentReference>> documentsByPatient = new HashMap<>();
        parseResourceFiles("DocumentReference", node -> {
            DocumentReference dr = FhirNormalizer.normalizeDocumentReference(node);
            if (dr.patientId() != null) {
                documentsByPatient.computeIfAbsent(dr.patientId(), k -> new ArrayList<>()).add(dr);
            }
        });
        System.out.printf("DocumentReferences parsed in %d ms%n", System.currentTimeMillis() - docStart);

        // Step 7: Assemble final PatientRecord map
        Map<String, PatientRecord> records = new HashMap<>();
        for (Map.Entry<String, Patient> entry : patients.entrySet()) {
            String id = entry.getKey();
            records.put(id, new PatientRecord(
                    entry.getValue(),
                    conditionsByPatient.getOrDefault(id, List.of()),
                    observationsByPatient.getOrDefault(id, List.of()),
                    proceduresByPatient.getOrDefault(id, List.of()),
                    medicationsByPatient.getOrDefault(id, List.of()),
                    documentsByPatient.getOrDefault(id, List.of())
            ));
        }

        System.out.printf("Total: parsed %d patients in %d ms%n",
                records.size(), System.currentTimeMillis() - start);

        return records;
    }

    /**
     * Parses all 14 Observation shards one at a time on the calling thread.
     * This is the baseline to measure before applying the parallel optimization.
     * Swap this into parseAll() in place of parseObservationFilesInParallel() to benchmark.
     */
    @SuppressWarnings("unused")
    private Map<String, List<Observation>> parseObservationFilesSequentially() throws IOException {
        long start = System.currentTimeMillis();

        List<Observation> all = new ArrayList<>();
        for (Path file : getNdjsonFiles("Observation")) {
            all.addAll(parseSingleObservationFile(file));
        }

        Map<String, List<Observation>> result = groupObservationsByPatient(all);
        System.out.printf("[Sequential] Observations parsed in %d ms%n",
                System.currentTimeMillis() - start);
        return result;
    }

    /**
     * Parses all 14 Observation shards concurrently using a fixed thread pool.
     * Each shard is parsed independently into its own List<Observation>, then all
     * lists are merged on the main thread — no shared mutable state during parsing.
     */
    private Map<String, List<Observation>> parseObservationFilesInParallel() throws IOException {
        long start = System.currentTimeMillis();

        List<Path> files = getNdjsonFiles("Observation");
        int threadCount = Math.min(files.size(), Runtime.getRuntime().availableProcessors());
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);

        try {
            // Submit one task per shard — each returns its own independent list
            List<CompletableFuture<List<Observation>>> futures = files.stream()
                    .map(file -> CompletableFuture.supplyAsync(
                            () -> parseSingleObservationFile(file), pool))
                    .collect(Collectors.toList());

            // Wait for all shards, flatten into one list, then group by patient
            List<Observation> all = futures.stream()
                    .map(CompletableFuture::join)
                    .flatMap(List::stream)
                    .collect(Collectors.toList());

            Map<String, List<Observation>> result = groupObservationsByPatient(all);
            System.out.printf("[Parallel]   Observations parsed in %d ms using %d threads%n",
                    System.currentTimeMillis() - start, threadCount);
            return result;
        } finally {
            pool.shutdown();
        }
    }

    /**
     * Parses a single Observation NDJSON shard into a flat list.
     * Returns an empty list (never throws) so futures don't fail silently on I/O errors.
     */
    private List<Observation> parseSingleObservationFile(Path file) {
        List<Observation> results = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(file)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                try {
                    JsonNode node = mapper.readTree(line);
                    Observation o = FhirNormalizer.normalizeObservation(node);
                    if (o.patientId() != null) {
                        results.add(o);
                    }
                } catch (Exception e) {
                    System.err.printf("Skipping malformed line in %s: %s%n",
                            file.getFileName(), e.getMessage());
                }
            }
        } catch (IOException e) {
            System.err.printf("Failed to read observation shard %s: %s%n",
                    file.getFileName(), e.getMessage());
        }
        return results;
    }

    /**
     * Groups a flat list of Observations into a map keyed by patientId.
     * Called once after all shards have finished parsing — single-threaded, no locks needed.
     */
    private Map<String, List<Observation>> groupObservationsByPatient(List<Observation> observations) {
        Map<String, List<Observation>> map = new HashMap<>();
        for (Observation o : observations) {
            map.computeIfAbsent(o.patientId(), k -> new ArrayList<>()).add(o);
        }
        return map;
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
     * Finds all shards for a resource type (e.g. Condition.000.ndjson, Condition.001.ndjson)
     * and invokes the consumer for each JSON line.
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
                    System.err.printf("Skipping malformed line in %s: %s%n",
                            file.getFileName(), e.getMessage());
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
