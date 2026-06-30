import { AiReview, CohortReport, EligibilityResult, PatientRecord } from "@/types/fhir";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json();
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string }).error ?? `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return res.json();
}

export function getAllPatients(): Promise<PatientRecord[]> {
  return get("/api/patients");
}

export function getPatient(id: string): Promise<PatientRecord> {
  return get(`/api/patients/${encodeURIComponent(id)}`);
}

export function searchPatients(name: string): Promise<PatientRecord[]> {
  return get(`/api/patients/search?name=${encodeURIComponent(name)}`);
}

export function getPatientEligibility(id: string): Promise<EligibilityResult> {
  return get(`/api/patients/${encodeURIComponent(id)}/eligibility`);
}

export function getCohortReport(): Promise<CohortReport> {
  return get("/api/eligibility/cohort");
}

export function postAiReview(id: string): Promise<AiReview> {
  return post(`/api/patients/${encodeURIComponent(id)}/ai-review`);
}
