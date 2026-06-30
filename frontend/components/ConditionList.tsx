"use client";

import { useState } from "react";
import { Condition } from "@/types/fhir";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  resolved: "bg-blue-50 text-blue-600",
};

export default function ConditionList({ conditions }: { conditions: Condition[] }) {
  const [activeOnly, setActiveOnly] = useState(false);

  const displayed = activeOnly
    ? conditions.filter((c) => c.status === "active")
    : conditions;

  const sorted = [...displayed].sort((a, b) => {
    if (!a.onsetDate && !b.onsetDate) return 0;
    if (!a.onsetDate) return 1;
    if (!b.onsetDate) return -1;
    return b.onsetDate.localeCompare(a.onsetDate);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          Conditions
          <span className="ml-2 text-sm font-normal text-gray-400">({conditions.length})</span>
        </h3>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded"
          />
          Active only
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No conditions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Condition</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Onset</th>
                <th className="pb-2 font-medium">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-2.5 pr-4 text-gray-800">{c.display ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-gray-500 font-mono text-xs">{c.code ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[c.status ?? ""] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status ?? "unknown"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">{formatDate(c.onsetDate)}</td>
                  <td className="py-2.5 text-gray-500">{formatDate(c.abatementDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
