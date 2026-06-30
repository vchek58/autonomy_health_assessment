export interface Patient {
  id: string;
  fullName: string | null;
  familyName: string | null;
  givenNames: string[];
  gender: string | null;
  birthSex: string | null;
  birthDate: string | null;
  deceasedDate: string | null;
}

export interface Condition {
  id: string;
  patientId: string;
  display: string | null;
  code: string | null;
  codeSystem: string | null;
  status: string | null;
  onsetDate: string | null;
  abatementDate: string | null;
}

export interface Observation {
  id: string;
  patientId: string;
  display: string | null;
  loincCode: string | null;
  value: number | null;
  unit: string | null;
  valueString: string | null;
  date: string | null;
}

export interface Procedure {
  id: string;
  patientId: string;
  display: string | null;
  code: string | null;
  codeSystem: string | null;
  status: string | null;
  date: string | null;
}

export interface PatientRecord {
  patient: Patient;
  conditions: Condition[];
  observations: Observation[];
  procedures: Procedure[];
}

export type EligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN";

export type UnknownReason =
  | "MISSING_BMI_OBSERVATION"
  | "MISSING_PRIOR_WEIGHT_LOSS_EVIDENCE"
  | "MISSING_PSYCH_EVAL_EVIDENCE";

export interface EligibilityResult {
  status: EligibilityStatus;
  bmiValue: number | null;
  bmiObservationId: string | null;
  matchedComorbidityIds: string[];
  weightLossEvidenceIds: string[];
  psychEvalEvidenceIds: string[];
  unknownReasons: UnknownReason[];
}

export interface CohortReport {
  totalPatients: number;
  eligibleCount: number;
  notEligibleCount: number;
  unknownCount: number;
  unknownReasonBreakdown: Partial<Record<UnknownReason, number>>;
}
