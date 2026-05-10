import { type InferSchema, type ToolExtraArguments, type ToolMetadata } from "xmcp";
import { FhirClient } from "../fhir/client";
import { requireResolvedFhirBaseUrl, resolveFhirConnection } from "../mcp/sharpContext";
import { listPatientsInputSchema } from "../mcp/schemas";

export const schema = listPatientsInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "list_demo_patients",
  description:
    "List patients from an explicitly configured public or sandbox FHIR R4 server. Do not use this during active Patient-context safety review; use fetch_patient_context or validate_patient_agent_output instead.",
  annotations: {
    title: "List Demo Patients",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false
  }
};

export default async function listDemoPatients(input: InferSchema<typeof schema>, extra?: ToolExtraArguments) {
  const parsed = listPatientsInputSchema.parse(input);
  const fhirConnection = resolveFhirConnection(parsed, extra);
  const client = new FhirClient({
    baseUrl: requireResolvedFhirBaseUrl(fhirConnection.fhirBaseUrl),
    bearerToken: fhirConnection.bearerToken
  });
  const patients = await client.listPatients(parsed.count);

  return {
    structuredContent: {
      fhirBaseUrl: client.getBaseUrl(),
      patients
    }
  };
}
