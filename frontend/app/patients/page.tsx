"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchPatients, getAllPatients } from "@/lib/api";
import { PatientRecord } from "@/types/fhir";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PatientSelectorPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(
    debounce(async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = q.trim().length >= 2
          ? await searchPatients(q.trim())
          : await getAllPatients();
        setResults(data);
      } catch {
        setError("Could not reach the backend. Is Spring Boot running on port 8080?");
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    fetchPatients(query);
  }, [query, fetchPatients]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Prior Authorization Review</h1>
        <p className="text-sm text-gray-500 mt-0.5">Select a patient to review their clinical record</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <input
          type="text"
          placeholder="Search by patient name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />

        <p className="text-xs text-gray-400 mt-2 mb-4">
          {loading ? "Loading…" : `${results.length} patient${results.length !== 1 ? "s" : ""} found`}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <ul className="space-y-2">
          {results.map(({ patient }, i) => (
            <li key={patient.id ?? i}>
              <button
                onClick={() => router.push(`/patients/${patient.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {patient.fullName ?? "Unknown"}
                  </span>
                  {patient.deceasedDate && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Deceased</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1 flex gap-4">
                  <span>DOB: {formatDate(patient.birthDate)}</span>
                  <span>Sex: {patient.birthSex ?? patient.gender ?? "—"}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
