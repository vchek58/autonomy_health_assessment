import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/api";
import ClinicalSnapshot from "@/components/ClinicalSnapshot";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientPage({ params }: Props) {
  const { id } = await params;

  let record;
  try {
    record = await getPatient(id);
  } catch {
    notFound();
  }

  const { patient, conditions, observations, procedures } = record;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/patients" className="text-sm text-blue-600 hover:underline">
            ← All Patients
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-semibold text-gray-900">
            {patient.fullName ?? "Unknown Patient"}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <ClinicalSnapshot
          patient={patient}
          conditions={conditions}
          observations={observations}
          procedures={procedures}
        />
      </main>
    </div>
  );
}
