import { PatientRecord } from "@/types/fhir";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
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
