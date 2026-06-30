import Link from "next/link";
import { getCohortReport } from "@/lib/api";
import CohortReportPanel from "@/components/CohortReportPanel";

export default async function CohortPage() {
  let report;
  try {
    report = await getCohortReport();
  } catch {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-red-600">
          Could not load cohort report. Is Spring Boot running on port 8080?
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/patients" className="text-sm text-blue-600 hover:underline">
            ← All Patients
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-semibold text-gray-900">Cohort Report</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <CohortReportPanel report={report} />
      </main>
    </div>
  );
}
