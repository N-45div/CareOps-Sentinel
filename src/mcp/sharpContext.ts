import { type ToolExtraArguments } from "xmcp";

export const promptOpinionFhirContextExtension = {
  scopes: [
    { name: "patient/Patient.rs", required: true },
    { name: "patient/Condition.rs" },
    { name: "patient/MedicationRequest.rs" },
    { name: "patient/MedicationStatement.rs" },
    { name: "patient/Observation.rs" },
    { name: "patient/AllergyIntolerance.rs" },
    { name: "patient/Encounter.rs" },
    { name: "patient/Procedure.rs" },
    { name: "patient/CarePlan.rs" },
    { name: "patient/ServiceRequest.rs" }
  ]
} as const;

export interface SharpFhirContext {
  fhirBaseUrl?: string;
  bearerToken?: string;
  patientId?: string;
}

export function getSharpFhirContext(extra?: ToolExtraArguments): SharpFhirContext {
  const headers = extra?.requestInfo?.headers ?? {};

  return {
    fhirBaseUrl: headerValue(headers, "x-fhir-server-url") ?? headerValue(headers, "x-fhir-base-url"),
    bearerToken: stripBearerPrefix(
      headerValue(headers, "x-fhir-access-token") ?? headerValue(headers, "authorization")
    ),
    patientId:
      headerValue(headers, "x-patient-id") ??
      headerValue(headers, "x-fhir-patient-id") ??
      headerValue(headers, "x-inc-sd")
  };
}

export function resolveFhirConnection(
  input: { fhirBaseUrl?: string; patientId?: string },
  extra?: ToolExtraArguments
) {
  const context = getSharpFhirContext(extra);

  return {
    fhirBaseUrl: context.fhirBaseUrl ?? input.fhirBaseUrl ?? process.env.FHIR_BASE_URL,
    bearerToken: context.bearerToken ?? process.env.FHIR_BEARER_TOKEN,
    patientId: context.patientId ?? input.patientId,
    source: context
  };
}

export function requireResolvedFhirBaseUrl(fhirBaseUrl?: string): string {
  if (!fhirBaseUrl) {
    throw new Error(
      "Missing FHIR base URL. Provide fhirBaseUrl in tool input, set FHIR_BASE_URL, or pass Prompt Opinion SHARP header X-FHIR-Server-URL."
    );
  }

  return fhirBaseUrl;
}

export function requireResolvedPatientId(patientId?: string): string {
  if (!patientId) {
    throw new Error("Missing patientId. Provide patientId in tool input or via Prompt Opinion SHARP header X-Patient-ID.");
  }

  return patientId;
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return value && value.trim() ? value.trim() : undefined;
}

function stripBearerPrefix(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/^Bearer\s+/i, "");
}
