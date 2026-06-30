"use client";

import React, { useState } from "react";
import { Observation, Procedure } from "@/types/fhir";
import Missing from "@/components/Missing";

const BMI_LOINC = "39156-5";
const PAGE_SIZE = 10;

type TimelineItem =
  | { kind: "observation"; data: Observation; date: string }
  | { kind: "procedure"; data: Procedure; date: string };

function formatDate(iso: string | null): React.ReactNode {
  if (!iso) return <Missing />;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildTimeline(observations: Observation[], procedures: Procedure[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...observations
      .filter((o) => o.date)
      .map((o) => ({ kind: "observation" as const, data: o, date: o.date! })),
    ...procedures
      .filter((p) => p.date)
      .map((p) => ({ kind: "procedure" as const, data: p, date: p.date! })),
  ];
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

interface Props {
  observations: Observation[];
  procedures: Procedure[];
}

export default function ObservationTimeline({ observations, procedures }: Props) {
  const [page, setPage] = useState(0);

  const timeline = buildTimeline(observations, procedures);
  const totalPages = Math.max(1, Math.ceil(timeline.length / PAGE_SIZE));
  const pageItems = timeline.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, timeline.length);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Timeline View</h2>
        <p className="text-sm text-gray-900 mt-0.5">
          {observations.length} observations · {procedures.length} procedures · sorted by most recent
        </p>
      </div>

      {timeline.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-900">No events recorded.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-900 border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 font-medium w-28">Type</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium w-36">Date</th>
                  <th className="px-6 py-3 font-medium">Source FHIR ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((item) => {
                  const isBmi =
                    item.kind === "observation" && item.data.loincCode === BMI_LOINC;

                  return (
                    <tr
                      key={`${item.kind}-${item.data.id}`}
                      className={`hover:bg-gray-50 ${isBmi ? "bg-yellow-50 hover:bg-yellow-100" : ""}`}
                    >
                      <td className="px-6 py-3">
                        {item.kind === "observation" ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            Observation
                          </span>
                        ) : (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            Procedure
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-900">
                        {item.data.display ?? <Missing />}
                        {isBmi && (
                          <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
                            BMI
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-900 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs break-all text-gray-900">
                        {item.data.id ?? <Missing />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-900">
              {start}–{end} of {timeline.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
