import { Observation, Procedure } from "@/types/fhir";

const BMI_LOINC = "39156-5";

type TimelineItem =
  | { kind: "observation"; data: Observation; date: string }
  | { kind: "procedure"; data: Procedure; date: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildTimeline(
  observations: Observation[],
  procedures: Procedure[]
): TimelineItem[] {
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

function ObservationRow({ item }: { item: Extract<TimelineItem, { kind: "observation" }> }) {
  const { data } = item;
  const isBmi = data.loincCode === BMI_LOINC;

  return (
    <tr className={`hover:bg-gray-50 ${isBmi ? "bg-yellow-50" : ""}`}>
      <td className="py-2.5 pr-4">
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          Observation
        </span>
      </td>
      <td className="py-2.5 pr-4 text-gray-800">
        {data.display ?? "—"}
        {isBmi && (
          <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
            BMI
          </span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-gray-700">
        {data.value != null
          ? `${data.value}${data.unit ? " " + data.unit : ""}`
          : data.valueString ?? "—"}
      </td>
      <td className="py-2.5 text-gray-500">{formatDate(data.date)}</td>
    </tr>
  );
}

function ProcedureRow({ item }: { item: Extract<TimelineItem, { kind: "procedure" }> }) {
  const { data } = item;
  return (
    <tr className="hover:bg-gray-50">
      <td className="py-2.5 pr-4">
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          Procedure
        </span>
      </td>
      <td className="py-2.5 pr-4 text-gray-800">{data.display ?? "—"}</td>
      <td className="py-2.5 pr-4 text-gray-500 capitalize">{data.status ?? "—"}</td>
      <td className="py-2.5 text-gray-500">{formatDate(data.date)}</td>
    </tr>
  );
}

interface Props {
  observations: Observation[];
  procedures: Procedure[];
}

export default function ObservationTimeline({ observations, procedures }: Props) {
  const timeline = buildTimeline(observations, procedures);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        Clinical Timeline
        <span className="ml-2 text-sm font-normal text-gray-400">
          ({observations.length} observations, {procedures.length} procedures)
        </span>
      </h3>

      {timeline.length === 0 ? (
        <p className="text-sm text-gray-500">No events recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium w-28">Type</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Value / Status</th>
                <th className="pb-2 font-medium w-32">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {timeline.map((item) =>
                item.kind === "observation" ? (
                  <ObservationRow key={`obs-${item.data.id}`} item={item} />
                ) : (
                  <ProcedureRow key={`proc-${item.data.id}`} item={item} />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
