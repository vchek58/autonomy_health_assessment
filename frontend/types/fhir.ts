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
