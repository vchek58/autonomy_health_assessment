# Autonomy Health Assessment

A clinician-facing prior authorization review tool that ingests raw FHIR bulk data, presents a patient clinical view, and uses AI-assisted reasoning to determine whether a patient is likely to meet bariatric surgery coverage requirements.

The system is split into two services: a Spring Boot backend that parses and serves FHIR data over a REST API, and a Next.js frontend that provides the clinician-facing UI.

## Running the Application

**Backend** (port 8080):
```bash
cd demo
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home mvn spring-boot:run
```

To enable Part D AI-assisted review, export your Anthropic API key before starting the backend:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
cd demo
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home mvn spring-boot:run
```

If `ANTHROPIC_API_KEY` is not set, all other features (Parts A–C) continue to work normally. The AI Review panel on each patient view will show a configuration notice instead.

**Frontend** (port 3000):
```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` to use the application.

---

## Part A: Data Ingestion

The dataset contains 18 FHIR resource types across 49 NDJSON shards. The largest by volume:

| Resource | Shards | Notes |
|---|---|---|
| Observation | 14 | Labs, vitals, BMI — most parsing time |
| DiagnosticReport | 7 | Clinical notes |
| DocumentReference | 6 | Psych evaluations, clinical documents |
| Procedure | 3 | Weight-loss and other procedures |
| MedicationRequest | 3 | Prescriptions |

Observation files are where most of the parsing time is spent. Because each shard contains independent data with no required ordering, they can be parsed concurrently.

**Sequential parsing:**
```
Conditions parsed in 212 ms
[Sequential] Observations parsed in 1865 ms
Procedures parsed in 442 ms
Total: parsed 1132 patients in 2591 ms
```

**Parallel parsing (10 threads):**
```
Conditions parsed in 164 ms
[Parallel]   Observations parsed in 1049 ms using 10 threads
Procedures parsed in 497 ms
Total: parsed 1132 patients in 1779 ms
```

Parallelizing the 14 Observation shards reduced observation parse time from 1865 ms to 1049 ms — a 44% improvement.

---

## Part B: Clinical Frontend

The frontend is a Next.js 16 application (TypeScript, Tailwind CSS, App Router) served on port 3000.

**Patient Selector** (`/patients`) — search bar that queries the backend as you type. Results show patient name, date of birth, and sex. Clicking a patient navigates to their clinical view.

**Patient View** (`/patients/[id]`) — two panels rendered for the selected patient:

- **Clinical Snapshot** — demographics (age, date of birth, sex), followed by paginated tables for active conditions, recent procedures, and key observations. Each table shows 10 rows at a time with Previous/Next controls. Missing data fields are highlighted with a red **Missing** badge.

- **Timeline View** — all observations and procedures combined into a single chronological list (most recent first), paginated at 10 rows. Each row shows the resource type, name, date, and source FHIR resource ID.

---

## Part C: Eligibility Logic & Cohort Report

Deterministic bariatric surgery eligibility evaluation applied to every patient record in memory, with a per-patient panel and a cohort-level summary.

**Eligibility criteria:**
- BMI ≥ 40 with prior weight-loss evidence and a psychological evaluation → **Eligible**
- BMI 35–40 with at least one qualifying comorbidity, weight-loss evidence, and a psychological evaluation → **Eligible**
- BMI < 35 → **Not Eligible**
- Any qualifying BMI without complete documentation, or no BMI recorded → **Unknown** (with specific reasons listed)

Comorbidities accepted: essential hypertension, type 2 diabetes, hyperlipidemia, sleep apnea, and diabetic retinopathy (all verified against SNOMED codes present in this dataset).

Every factual claim in the eligibility result carries the source FHIR resource ID.

**Finding the Eligibility Assessment (per patient):**
Open any patient from the selector page. The **Eligibility Assessment** panel appears at the bottom of the Patient View, below the Timeline View. It shows:
- A color-coded status badge (green = Eligible, red = Not Eligible, yellow = Unknown)
- BMI value and its source FHIR observation ID in a two-column layout
- Comorbidities matched, each with its source Condition FHIR ID
- A documentation checklist (prior weight-loss evidence and psychological evaluation), each with evidence FHIR IDs or a Missing indicator
- If Unknown: an explicit list of which requirements are unmet

**Finding the Cohort Report:**
Click **Cohort Report →** in the top-right corner of the Patient Selector page, or navigate directly to `http://localhost:3000/cohort`. The report shows:
- Total patients evaluated with a breakdown by status (count + percentage)
- A table of the top reasons patients are classified Unknown, with patient counts

---

## Part D: AI-Assisted Review

On-demand clinical narrative generated by Claude, grounded in the Part C eligibility assessment. Claude acts as a narrator — it explains the assessment and lists recommended next steps, but does not override the deterministic eligibility decision.

**What the review contains:**
- **Clinical Summary** — 2–3 sentences describing the patient's clinical picture as it relates to bariatric eligibility, citing only evidence present in the FHIR record
- **Requirements Checklist** — one row per policy requirement (BMI, comorbidity, weight-loss evidence, psych eval), each with a Met / Not Met / N/A badge and the source FHIR IDs Claude cited
- **Recommended Next Steps** — actionable items for requirements that are unmet or missing documentation

**Failure handling:**
- If `ANTHROPIC_API_KEY` is not set, the panel shows a configuration notice and the endpoint returns 503. The rest of the patient view is unaffected.
- If the API call times out or returns an error, the panel shows a degraded view: the checklist is populated deterministically from Part C (no AI involvement) and a banner explains that the AI review could not be completed.
- All FHIR IDs cited by Claude are validated against the patient's scoped evidence list before the response is returned. IDs not in scope are silently dropped.

**Finding the AI Review panel:**
Open any patient view. The **AI-Assisted Review** panel appears at the bottom, below the Eligibility Assessment. Click **Generate AI Review** to trigger the call on demand.

**Configuration:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
# then restart the backend
cd demo
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home mvn spring-boot:run
```

---

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
├── frontend/                    # Next.js frontend (TypeScript, Tailwind)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # redirects → /patients
│   │   └── patients/
│   │       ├── page.tsx         # Patient Selector
│   │       └── [id]/
│   │           └── page.tsx     # Patient View
│   ├── components/
│   │   ├── ClinicalSnapshot.tsx
│   │   ├── ObservationTimeline.tsx
│   │   └── Missing.tsx
│   ├── lib/
│   │   └── api.ts               # typed fetch client → Spring Boot
│   └── types/
│       └── fhir.ts              # TypeScript mirrors of Java records
└── sample-bulk-fhir-datasets-1000-patients/   # unzipped NDJSON data (gitignored)
```

---

## Backend Components

### `Main.java`

Spring Boot application entry point. Bootstraps the application context, which triggers `PatientService` to parse all FHIR data on startup.

### `model/`

Normalized internal data model. Each class is a Java record representing a single FHIR resource type, containing only the fields relevant to this application. Raw FHIR JSON is never exposed outside the `fhir/` layer.

| File | Purpose |
|---|---|
| `Patient.java` | Demographics: id, full name, family name, given names, gender, birth sex, birth date, deceased date |
| `Condition.java` | A diagnosis linked to a patient: display name, SNOMED code, clinical status, onset and abatement dates |
| `Observation.java` | A clinical measurement linked to a patient: display name, LOINC code, numeric value and unit (or text value), date |
| `Procedure.java` | A procedure performed on a patient: display name, SNOMED/CPT code, status, date |
| `PatientRecord.java` | Aggregate of one `Patient` and all their associated `Condition`, `Observation`, and `Procedure` lists. This is the primary unit consumed by the frontend and eligibility logic |

### `fhir/`

Responsible for reading raw FHIR NDJSON files from disk and converting them into normalized model objects. Nothing outside this package deals with raw JSON.

| File | Purpose |
|---|---|
| `FhirParser.java` | Reads all NDJSON shards for each resource type (`Patient`, `Condition`, `Observation`, `Procedure`) line by line. Resolves cross-references (e.g. `Condition.subject.reference → Patient`) and groups all resources by patient ID into a `Map<String, PatientRecord>`. Observation shards are parsed in parallel using a fixed thread pool. |
| `FhirNormalizer.java` | Converts a single raw `JsonNode` into the corresponding model object. Handles missing or partial fields by returning `null` rather than throwing. Extracts nested values such as the first coding display, LOINC/SNOMED codes, and FHIR extensions (e.g. `us-core-birthsex`) |

### `service/`

Business logic layer between the parser and the REST API.

| File | Purpose |
|---|---|
| `PatientService.java` | Calls `FhirParser.parseAll()` once at startup via `@PostConstruct` and holds the resulting map in memory. Exposes `findAll()`, `findById()`, and `searchByName()` for the API layer to query |

### `api/`

REST controllers that expose parsed patient data to the Next.js frontend over HTTP.

| File | Purpose |
|---|---|
| `PatientController.java` | `GET /api/patients` — all patient records. `GET /api/patients/{id}` — single patient record. `GET /api/patients/search?name=` — name search returning up to 15 matching patients. CORS configured for `localhost:3000`. |

### `application.properties`

Configures the server port (`8080`) and the path to the unzipped FHIR data directory via `fhir.data.directory`. The data path can be overridden with the `FHIR_DATA_DIR` environment variable.

---

## Frontend Components

### `types/fhir.ts`

TypeScript interfaces that mirror the Java record classes. Shared across all pages and components to ensure the API response shape is typed end-to-end.

### `lib/api.ts`

Typed fetch client for the Spring Boot API. All HTTP calls go through here so the base URL is configured in one place via `NEXT_PUBLIC_API_BASE` (defaults to `http://localhost:8080`).

### `components/ClinicalSnapshot.tsx`

Displays a full clinical summary for one patient. Contains four sections: a demographics bar (age, DOB, sex, alive/deceased status) and three paginated tables — active conditions, recent procedures, and key observations. Each table paginates at 10 rows. Null fields are flagged with a red `Missing` badge via `Missing.tsx`.

### `components/ObservationTimeline.tsx`

Combines all observations and procedures into a single chronological timeline sorted by most recent date. Paginated at 10 rows per page. Each row shows resource type (color-coded badge), name, date, and the source FHIR resource ID. BMI observations (LOINC `39156-5`) are highlighted in yellow.

### `components/Missing.tsx`

Small shared component that renders a red `Missing` badge. Used in both `ClinicalSnapshot` and `ObservationTimeline` wherever a FHIR field is null.
