import { type InferSchema, type ToolExtraArguments, type ToolMetadata } from "xmcp";
import { FhirClient } from "../fhir/client";
import { normalizeFhirBundle } from "../fhir/normalizer";
import { requireResolvedFhirBaseUrl, requireResolvedPatientId, resolveFhirConnection } from "../mcp/sharpContext";
import { fetchPatientContextInputSchema } from "../mcp/schemas";

export const schema = fetchPatientContextInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "fetch_patient_context",
  description:
    "Fetch Patient/$everything or patient-compartment data from the active Prompt Opinion patient FHIR context and normalize it for CareOps Sentinel.",
  annotations: {
    title: "Fetch Patient Context",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false
  }
};

export default async function fetchPatientContext(input: InferSchema<typeof schema>, extra?: ToolExtraArguments) {
  const parsed = fetchPatientContextInputSchema.parse(input);
  const fhirConnection = resolveFhirConnection(parsed, extra);
  const patientId = requireResolvedPatientId(fhirConnection.patientId);
  const client = new FhirClient({
    baseUrl: requireResolvedFhirBaseUrl(fhirConnection.fhirBaseUrl),
    bearerToken: fhirConnection.bearerToken
  });
  const bundle = await client.fetchPatientContext(patientId);
  const context = normalizeFhirBundle(bundle, {
    mode: "fhir_server",
    baseUrl: client.getBaseUrl(),
    patientId,
    resourceCount: 0
  });

  return {
    structuredContent: context
  };
}
