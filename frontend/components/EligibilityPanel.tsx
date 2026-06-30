import React from "react";
import { Condition, EligibilityResult, EligibilityStatus, UnknownReason } from "@/types/fhir";

const STATUS_CONFIG: Record<EligibilityStatus, { label: string; badge: string; header: string }> = {
  ELIGIBLE: {
    label: "Eligible",
    badge: "bg-green-100 text-green-700 border border-green-200",
    header: "bg-green-50 border-b border-green-100",
  },
  NOT_ELIGIBLE: {
    label: "Not Eligible",
    badge: "bg-red-100 text-red-700 border border-red-200",
    header: "bg-red-50 border-b border-red-100",
  },
  UNKNOWN: {
    label: "Unknown",
    badge: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    header: "bg-yellow-50 border-b border-yellow-100",
  },
};

const UNKNOWN_REASON_LABELS: Record<UnknownReason, string> = {
  MISSING_BMI_OBSERVATION: "No BMI observation recorded",
  MISSING_PRIOR_WEIGHT_LOSS_EVIDENCE: "No prior weight-loss evidence found",
  MISSING_PSYCH_EVAL_EVIDENCE: "No psychological evaluation found",
};

interface Props {
  eligibility: EligibilityResult;
  conditions: Condition[];
}

function EvidenceList({ ids, emptyLabel }: { ids: string[]; emptyLabel: string }) {
  if (ids.length === 0) {
    return <span className="text-red-600 font-medium">{emptyLabel}</span>;
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {ids.map((id) => (
        <li key={id} className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
          {id}
        </li>
      ))}
    </ul>
  );
}

export default function EligibilityPanel({ eligibility, conditions }: Props) {
  const config = STATUS_CONFIG[eligibility.status];
  const conditionMap = new Map(conditions.map((c) => [c.id, c.display]));

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 flex items-center justify-between ${config.header}`}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Eligibility Assessment</h2>
          <p className="text-sm text-gray-900 mt-0.5">Bariatric surgery prior authorization</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.badge}`}>
          {config.label}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {/* BMI */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">BMI</h3>
          {eligibility.bmiValue != null ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-900 mb-1">BMI</dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {eligibility.bmiValue.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-900 mb-1">Source FHIR ID</dt>
                <dd className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded break-all">
                  {eligibility.bmiObservationId}
                </dd>
              </div>
            </div>
          ) : (
            <span className="text-sm text-red-600 font-medium">No BMI observation recorded</span>
          )}
        </div>

        {/* Comorbidities */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Comorbidities Matched
            <span className="ml-2 font-normal text-gray-900">
              ({eligibility.matchedComorbidityIds.length})
            </span>
          </h3>
          {eligibility.matchedComorbidityIds.length === 0 ? (
            <p className="text-sm text-gray-900">None matched</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-gray-900">Condition</div>
              <div className="text-xs uppercase tracking-wide text-gray-900">Source FHIR ID</div>
              {eligibility.matchedComorbidityIds.map((id) => (
                <React.Fragment key={id}>
                  <div className="text-gray-900">
                    {conditionMap.get(id) ?? "Unknown condition"}
                  </div>
                  <div className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded break-all">
                    {id}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Documentation */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Documentation</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium ${eligibility.weightLossEvidenceIds.length > 0 ? "text-green-700" : "text-red-600"}`}>
                  {eligibility.weightLossEvidenceIds.length > 0 ? "✓" : "✗"} Prior weight-loss evidence
                </span>
                {eligibility.weightLossEvidenceIds.length > 0 && (
                  <span className="text-xs text-gray-900">
                    ({eligibility.weightLossEvidenceIds.length} record{eligibility.weightLossEvidenceIds.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <EvidenceList ids={eligibility.weightLossEvidenceIds} emptyLabel="Missing" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium ${eligibility.psychEvalEvidenceIds.length > 0 ? "text-green-700" : "text-red-600"}`}>
                  {eligibility.psychEvalEvidenceIds.length > 0 ? "✓" : "✗"} Psychological evaluation
                </span>
                {eligibility.psychEvalEvidenceIds.length > 0 && (
                  <span className="text-xs text-gray-900">
                    ({eligibility.psychEvalEvidenceIds.length} record{eligibility.psychEvalEvidenceIds.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <EvidenceList ids={eligibility.psychEvalEvidenceIds} emptyLabel="Missing" />
            </div>
          </div>
        </div>

        {/* Unknown reasons — only shown when status is UNKNOWN */}
        {eligibility.status === "UNKNOWN" && eligibility.unknownReasons.length > 0 && (
          <div className="px-6 py-4 bg-yellow-50">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Missing information</h3>
            <ul className="space-y-1">
              {eligibility.unknownReasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm text-yellow-800">
                  <span className="mt-0.5">•</span>
                  <span>{UNKNOWN_REASON_LABELS[reason]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
