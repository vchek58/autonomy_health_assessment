"use client";

import React, { useState } from "react";
import { Patient, Condition, Observation, Procedure } from "@/types/fhir";
import Missing from "@/components/Missing";

const PAGE_SIZE = 10;

function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return {
    pageItems,
    page,
    totalPages,
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
  };
}

function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
      <span className="text-xs text-gray-900">
        {start}–{end} of {total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page === 0}
          className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={page === totalPages - 1}
          className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string | null | undefined): React.ReactNode {
  if (!iso) return <Missing />;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function age(birthDate: string | null): React.ReactNode {
  if (!birthDate) return <Missing />;
  const birth = new Date(birthDate);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return `${years} yrs`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-900",
  resolved: "bg-blue-50 text-blue-600",
};

interface Props {
  patient: Patient;
  conditions: Condition[];
  observations: Observation[];
  procedures: Procedure[];
}

export default function ClinicalSnapshot({ patient, conditions, observations, procedures }: Props) {
  const activeConditions = conditions
    .filter((c) => c.status === "active")
    .sort((a, b) => (b.onsetDate ?? "").localeCompare(a.onsetDate ?? ""));

  const sortedProcedures = [...procedures].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );

  const sortedObservations = [...observations].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );

  const conditionPagination = usePagination(activeConditions);
  const procedurePagination = usePagination(sortedProcedures);
  const observationPagination = usePagination(sortedObservations);

  const sex = patient.birthSex ?? patient.gender;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Clinical Snapshot</h2>
        <p className="text-sm text-gray-900 mt-0.5">
          {patient.fullName ?? <Missing />}
        </p>
      </div>

      {/* Demographics */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-900 uppercase text-xs tracking-wide">Age</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{age(patient.birthDate)}</dd>
          </div>
          <div>
            <dt className="text-gray-900 uppercase text-xs tracking-wide">Date of Birth</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{formatDate(patient.birthDate)}</dd>
          </div>
          <div>
            <dt className="text-gray-900 uppercase text-xs tracking-wide">Sex</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {sex ?? <Missing />}
            </dd>
          </div>
          <div>
            <dt className="text-gray-900 uppercase text-xs tracking-wide">Status</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {patient.deceasedDate ? (
                <span className="text-red-600">Deceased {formatDate(patient.deceasedDate)}</span>
              ) : (
                "Active"
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Active Conditions */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Active Conditions
          <span className="ml-2 font-normal text-gray-900">({activeConditions.length})</span>
        </h3>
        {activeConditions.length === 0 ? (
          <p className="text-sm text-gray-900">None recorded</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-900 border-b border-gray-100">
                  <th className="pb-2 font-medium">Condition</th>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Onset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conditionPagination.pageItems.map((c, i) => (
                  <tr key={c.id ?? i} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 text-gray-900">{c.display ?? <Missing />}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-900">
                      {c.code ?? <Missing />}
                    </td>
                    <td className="py-2.5 text-gray-900">{formatDate(c.onsetDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={conditionPagination.page}
              totalPages={conditionPagination.totalPages}
              total={activeConditions.length}
              onPrev={conditionPagination.prev}
              onNext={conditionPagination.next}
            />
          </>
        )}
      </div>

      {/* Recent Procedures */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Recent Procedures
          <span className="ml-2 font-normal text-gray-900">({sortedProcedures.length})</span>
        </h3>
        {sortedProcedures.length === 0 ? (
          <p className="text-sm text-gray-900">None recorded</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-900 border-b border-gray-100">
                  <th className="pb-2 font-medium">Procedure</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {procedurePagination.pageItems.map((p, i) => (
                  <tr key={p.id ?? i} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 text-gray-900">{p.display ?? <Missing />}</td>
                    <td className="py-2.5 pr-4">
                      {p.status ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-900"}`}>
                          {p.status}
                        </span>
                      ) : (
                        <Missing />
                      )}
                    </td>
                    <td className="py-2.5 text-gray-900">{formatDate(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={procedurePagination.page}
              totalPages={procedurePagination.totalPages}
              total={sortedProcedures.length}
              onPrev={procedurePagination.prev}
              onNext={procedurePagination.next}
            />
          </>
        )}
      </div>

      {/* Key Observations */}
      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Key Observations
          <span className="ml-2 font-normal text-gray-900">({sortedObservations.length})</span>
        </h3>
        {sortedObservations.length === 0 ? (
          <p className="text-sm text-gray-900">None recorded</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-900 border-b border-gray-100">
                  <th className="pb-2 font-medium">Observation</th>
                  <th className="pb-2 font-medium">Value</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {observationPagination.pageItems.map((o, i) => (
                  <tr key={o.id ?? i} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4 text-gray-900">{o.display ?? <Missing />}</td>
                    <td className="py-2.5 pr-4 text-gray-900">
                      {o.value != null
                        ? `${o.value}${o.unit ? " " + o.unit : ""}`
                        : o.valueString ?? <Missing />}
                    </td>
                    <td className="py-2.5 text-gray-900">{formatDate(o.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={observationPagination.page}
              totalPages={observationPagination.totalPages}
              total={sortedObservations.length}
              onPrev={observationPagination.prev}
              onNext={observationPagination.next}
            />
          </>
        )}
      </div>
    </div>
  );
}
