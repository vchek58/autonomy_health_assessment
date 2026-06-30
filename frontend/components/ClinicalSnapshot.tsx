import { Patient, Condition } from "@/types/fhir";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function age(birthDate: string | null): string {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return String(years);
}

interface Props {
  patient: Patient;
  conditions: Condition[];
}

export default function ClinicalSnapshot({ patient, conditions }: Props) {
  const activeConditions = conditions.filter((c) => c.status === "active");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {patient.fullName ?? "Unknown Patient"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {patient.familyName}, {patient.givenNames.join(" ")}
          </p>
        </div>
        {patient.deceasedDate && (
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
            Deceased {formatDate(patient.deceasedDate)}
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-400 uppercase text-xs tracking-wide">Date of Birth</dt>
          <dd className="mt-0.5 font-medium text-gray-800">{formatDate(patient.birthDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 uppercase text-xs tracking-wide">Age</dt>
          <dd className="mt-0.5 font-medium text-gray-800">{age(patient.birthDate)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 uppercase text-xs tracking-wide">Birth Sex</dt>
          <dd className="mt-0.5 font-medium text-gray-800">{patient.birthSex ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-400 uppercase text-xs tracking-wide">Gender</dt>
          <dd className="mt-0.5 font-medium text-gray-800 capitalize">{patient.gender ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-5 pt-5 border-t border-gray-100">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Active Conditions</p>
        {activeConditions.length === 0 ? (
          <p className="text-sm text-gray-500">None recorded</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeConditions.map((c) => (
              <span
                key={c.id}
                className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full"
              >
                {c.display ?? c.code ?? "Unknown"}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
