export type ClinicalWorkflow =
  | "discharge_review"
  | "prior_authorization_packet_review"
  | "medication_safety_review"
  | "care_gap_review"
  | "referral_review";

export type SafetyVerdict = "pass_with_review" | "needs_revision" | "blocked";

export interface FhirReference {
  resourceType: string;
  id: string;
  display?: string;
  system?: string;
  code?: string;
  status?: string;
  category?: string;
  value?: string | number | boolean;
}

export interface FhirContext {
  patient: FhirReference;
  source?: {
    mode: "bundle" | "fhir_server";
    baseUrl?: string;
    patientId?: string;
    resourceCount: number;
  };
  conditions?: FhirReference[];
  medications?: FhirReference[];
  observations?: FhirReference[];
  allergies?: FhirReference[];
  encounters?: FhirReference[];
  procedures?: FhirReference[];
  carePlans?: FhirReference[];
  serviceRequests?: FhirReference[];
}

export interface AgentOutput {
  agentName: string;
  role?: string;
  output: string;
  claims?: string[];
}

export interface ValidationInput {
  workflowType?: ClinicalWorkflow;
  fhirContext: FhirContext;
  agentOutputs: AgentOutput[];
}

export interface EvidenceFinding {
  claim: string;
  status: "grounded" | "missing_evidence" | "conflicts_with_fhir";
  evidence: FhirReference[];
  matchType?: string;
  confidence?: "high" | "medium" | "low";
  rationale: string;
}

export interface UnsafeLanguageFinding {
  phrase: string;
  severity: "medium" | "high";
  rationale: string;
  saferAlternative: string;
}

export interface ContradictionFinding {
  firstAgent: string;
  secondAgent: string;
  topic: string;
  rationale: string;
}

export interface AuditPacket {
  summary: string;
  evidenceGrounding: EvidenceFinding[];
  contradictions: ContradictionFinding[];
  unsafeLanguage: UnsafeLanguageFinding[];
  missingEvidenceChecklist: string[];
  safeRewrite: string;
  humanReviewRecommendation: string;
}

export interface ValidationResult {
  verdict: SafetyVerdict;
  riskScore: number;
  auditPacket: AuditPacket;
  reviewTask: Record<string, unknown>;
}
