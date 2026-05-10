import { type InferSchema, type ToolExtraArguments, type ToolMetadata } from "xmcp";
import { validateAgentOutput } from "../domain/safetyEngine";
import { FhirClient } from "../fhir/client";
import { normalizeFhirBundle } from "../fhir/normalizer";
import { requireResolvedFhirBaseUrl, requireResolvedPatientId, resolveFhirConnection } from "../mcp/sharpContext";
import { validatePatientAgentOutputInputSchema } from "../mcp/schemas";

export const schema = validatePatientAgentOutputInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "validate_patient_agent_output",
  description:
    "Validate healthcare agent output against the active Prompt Opinion patient FHIR context. Prefer SHARP FHIR headers over manually supplied fhirBaseUrl or patientId.",
  annotations: {
    title: "Validate Patient Agent Output",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false
  }
};

export default async function validatePatientAgentOutput(input: InferSchema<typeof schema>, extra?: ToolExtraArguments) {
  const parsed = validatePatientAgentOutputInputSchema.parse(input);
  const fhirConnection = resolveFhirConnection(parsed, extra);
  const patientId = requireResolvedPatientId(fhirConnection.patientId);
  const client = new FhirClient({
    baseUrl: requireResolvedFhirBaseUrl(fhirConnection.fhirBaseUrl),
    bearerToken: fhirConnection.bearerToken
  });
  const bundle = await client.fetchPatientContext(patientId);
  const fhirContext = normalizeFhirBundle(bundle, {
    mode: "fhir_server",
    baseUrl: client.getBaseUrl(),
    patientId,
    resourceCount: 0
  });
  const result = validateAgentOutput({
    workflowType: parsed.workflowType,
    fhirContext,
    agentOutputs: parsed.agentOutputs
  });

  return {
    structuredContent: result
  };
}
