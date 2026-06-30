"use client";

import { useState } from "react";
import { postAiReview } from "@/lib/api";
import { AiReview, ChecklistStatus } from "@/types/fhir";

const CHECKLIST_STATUS_CONFIG: Record<ChecklistStatus, { label: string; badge: string }> = {
  MET: { label: "Met", badge: "bg-green-100 text-green-700 border border-green-200" },
  NOT_MET: { label: "Not Met", badge: "bg-red-100 text-red-700 border border-red-200" },
  UNKNOWN: { label: "N/A", badge: "bg-gray-100 text-gray-500 border border-gray-200" },
};

interface Props {
  patientId: string;
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "loaded"; review: AiReview }
  | { phase: "error"; message: string };

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AiReviewPanel({ patientId }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function handleGenerate() {
    setState({ phase: "loading" });
    try {
      const review = await postAiReview(patientId);
      setState({ phase: "loaded", review });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate review.";
      setState({ phase: "error", message });
    }
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state.phase === "idle") {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI-Assisted Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">Claude narrates the eligibility assessment</p>
          </div>
        </div>
        <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-500 max-w-sm">
            Generate a clinical narrative and requirement checklist grounded in this patient&apos;s FHIR record.
          </p>
          <button
            onClick={handleGenerate}
            className="mt-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate AI Review
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state.phase === "loading") {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">AI-Assisted Review</h2>
          <p className="text-sm text-gray-500 mt-0.5">Claude narrates the eligibility assessment</p>
        </div>
        <div className="px-6 py-10 flex items-center justify-center gap-3 text-sm text-gray-500">
          <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Reviewing clinical record…
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state.phase === "error") {
    const isUnconfigured = state.message.includes("ANTHROPIC_API_KEY");
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">AI-Assisted Review</h2>
          <p className="text-sm text-gray-500 mt-0.5">Claude narrates the eligibility assessment</p>
        </div>
        <div className="px-6 py-6">
          {isUnconfigured ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-amber-800">AI review is not configured</p>
              <p className="text-sm text-amber-700 mt-1">
                Set the <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> environment
                variable and restart the backend to enable this feature.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {state.message}
              </div>
              <button
                onClick={handleGenerate}
                className="self-start px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────
  const { review } = state;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI-Assisted Review</h2>
          <p className="text-sm text-gray-500 mt-0.5">Claude narrates the eligibility assessment</p>
        </div>
        <button
          onClick={handleGenerate}
          className="text-xs text-blue-600 hover:underline"
        >
          Regenerate
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Degraded banner */}
        {review.degraded && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-sm text-amber-800">
              <span className="font-medium">AI review could not be completed.</span>{" "}
              The checklist below reflects the deterministic assessment from Part C.
            </p>
          </div>
        )}

        {/* Clinical summary */}
        {!review.degraded && (
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Clinical Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{review.clinicalSummary}</p>
          </div>
        )}

        {/* Requirement checklist */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Requirements Checklist</h3>
          <div className="space-y-3">
            {review.checklist.map((item, i) => {
              const config = CHECKLIST_STATUS_CONFIG[item.status];
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-900">{item.requirement}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${config.badge}`}>
                      {config.label}
                    </span>
                  </div>
                  {item.evidenceIds.length > 0 && (
                    <ul className="ml-0 space-y-0.5">
                      {item.evidenceIds.map((id) => (
                        <li key={id} className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                          {id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended next steps */}
        {review.recommendedNextSteps.length > 0 && (
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Recommended Next Steps</h3>
            <ul className="space-y-1.5">
              {review.recommendedNextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer timestamp */}
        <div className="px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400">
            Generated {formatTimestamp(review.generatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
