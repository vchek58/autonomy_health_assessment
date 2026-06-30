import { CohortReport, UnknownReason } from "@/types/fhir";

const UNKNOWN_REASON_LABELS: Record<UnknownReason, string> = {
  MISSING_BMI_OBSERVATION: "Missing BMI observation",
  MISSING_PRIOR_WEIGHT_LOSS_EVIDENCE: "Missing prior weight-loss evidence",
  MISSING_PSYCH_EVAL_EVIDENCE: "Missing psychological evaluation",
};

const ALL_UNKNOWN_REASONS: UnknownReason[] = [
  "MISSING_BMI_OBSERVATION",
  "MISSING_PRIOR_WEIGHT_LOSS_EVIDENCE",
  "MISSING_PSYCH_EVAL_EVIDENCE",
];

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

interface Props {
  report: CohortReport;
}

export default function CohortReportPanel({ report }: Props) {
  const { totalPatients, eligibleCount, notEligibleCount, unknownCount, unknownReasonBreakdown } =
    report;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Cohort Eligibility Report</h2>
        <p className="text-sm text-gray-900 mt-0.5">{totalPatients} patients evaluated</p>
      </div>

      {/* Status breakdown */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Status Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-green-700">{eligibleCount}</div>
            <div className="text-xs text-green-700 font-medium mt-0.5">Eligible</div>
            <div className="text-xs text-gray-900 mt-0.5">{pct(eligibleCount, totalPatients)}</div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-red-700">{notEligibleCount}</div>
            <div className="text-xs text-red-700 font-medium mt-0.5">Not Eligible</div>
            <div className="text-xs text-gray-900 mt-0.5">{pct(notEligibleCount, totalPatients)}</div>
          </div>
          <div className="rounded-lg bg-yellow-50 border border-yellow-100 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-yellow-700">{unknownCount}</div>
            <div className="text-xs text-yellow-700 font-medium mt-0.5">Unknown</div>
            <div className="text-xs text-gray-900 mt-0.5">{pct(unknownCount, totalPatients)}</div>
          </div>
        </div>
      </div>

      {/* Unknown reason breakdown */}
      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Reasons for Unknown Status
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-900 border-b border-gray-100">
              <th className="pb-2 font-medium">Reason</th>
              <th className="pb-2 font-medium text-right">Patients</th>
              <th className="pb-2 font-medium text-right">% of Unknown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ALL_UNKNOWN_REASONS.map((reason) => {
              const count = unknownReasonBreakdown[reason] ?? 0;
              return (
                <tr key={reason}>
                  <td className="py-2.5 pr-4 text-gray-900">{UNKNOWN_REASON_LABELS[reason]}</td>
                  <td className="py-2.5 text-right text-gray-900 font-medium">{count}</td>
                  <td className="py-2.5 text-right text-gray-900">{pct(count, unknownCount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
