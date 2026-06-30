# Autonomy Health Assessment

A clinician-facing prior authorization review tool that ingests raw FHIR bulk data, presents a patient clinical view, and uses AI-assisted reasoning to determine whether a patient is likely to meet bariatric surgery coverage requirements.

## Project Structure

```
autonomy_health_assessment/
├── demo/                        # Spring Boot backend (Java 17)
│   ├── pom.xml
│   └── src/main/
│       ├── resources/
│       │   └── application.properties
│       └── java/com/example/
│           ├── Main.java
│           ├── model/
│           │   ├── Patient.java
│           │   ├── Condition.java
│           │   ├── Observation.java
│           │   ├── Procedure.java
│           │   └── PatientRecord.java
│           ├── fhir/
│           │   ├── FhirParser.java
│           │   └── FhirNormalizer.java
│           ├── service/
│           │   └── PatientService.java
│           └── api/
│               └── PatientController.java
└── sample-bulk-fhir-datasets-1000-patients/   # unzipped NDJSON data (gitignored)
```

---

### `Main.java`

Spring Boot application entry point. Bootstraps the application context, which triggers `PatientService` to parse all FHIR data on startup.

---

### `model/`

Normalized internal data model. Each class is a Java record representing a single FHIR resource type, containing only the fields relevant to this application. Raw FHIR JSON is never exposed outside the `fhir/` layer.

| File | Purpose |
|---|---|
| `Patient.java` | Demographics: id, full name, family name, given names, gender, birth sex, birth date, deceased date |
| `Condition.java` | A diagnosis linked to a patient: display name, SNOMED code, clinical status, onset and abatement dates |
| `Observation.java` | A clinical measurement linked to a patient: display name, LOINC code, numeric value and unit (or text value), date |
| `Procedure.java` | A procedure performed on a patient: display name, SNOMED/CPT code, status, date |
| `PatientRecord.java` | Aggregate of one `Patient` and all their associated `Condition`, `Observation`, and `Procedure` lists. This is the primary unit consumed by the frontend and eligibility logic |

---

### `fhir/`

Responsible for reading raw FHIR NDJSON files from disk and converting them into normalized model objects. Nothing outside this package deals with raw JSON.

| File | Purpose |
|---|---|
| `FhirParser.java` | Reads all NDJSON shards for each resource type (`Patient`, `Condition`, `Observation`, `Procedure`) line by line. Resolves cross-references (e.g. `Condition.subject.reference → Patient`) and groups all resources by patient ID into a `Map<String, PatientRecord>`. Contains timing instrumentation for the Part A performance benchmark |
| `FhirNormalizer.java` | Converts a single raw `JsonNode` into the corresponding model object. Handles missing or partial fields by returning `null` rather than throwing. Extracts nested values such as the first coding display, LOINC/SNOMED codes, and FHIR extensions (e.g. `us-core-birthsex`) |

---

### `service/`

Business logic layer between the parser and the REST API.

| File | Purpose |
|---|---|
| `PatientService.java` | Calls `FhirParser.parseAll()` once at startup via `@PostConstruct` and holds the resulting map in memory. Exposes `findAll()`, `findById()`, and `searchByName()` for the API layer to query |

---

### `api/`

REST controllers that expose parsed patient data to the Next.js frontend over HTTP.

| File | Purpose |
|---|---|
| `PatientController.java` | Handles three endpoints: `GET /api/patients` (all patients), `GET /api/patients/{id}` (single patient record), `GET /api/patients/search?name=` (name search for the patient selector). CORS is configured for `localhost:3000` |

---

### `application.properties`

Configures the server port (`8080`) and the path to the unzipped FHIR data directory via `fhir.data.directory`. The data path can be overridden with the `FHIR_DATA_DIR` environment variable.
