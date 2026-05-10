import { type InferSchema, type ToolMetadata } from "xmcp";
import { normalizeFhirBundle } from "../fhir/normalizer";
import { validateFhirBundleInputSchema } from "../mcp/schemas";

export const schema = validateFhirBundleInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "validate_fhir_bundle",
  description: "Normalize a FHIR R4 Bundle and report the resources CareOps Sentinel can use for grounding.",
  annotations: {
    title: "Validate FHIR Bundle",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function validateFhirBundle(input: InferSchema<typeof schema>) {
  const parsed = validateFhirBundleInputSchema.parse(input);
  const context = normalizeFhirBundle(parsed.bundle);

  return {
    structuredContent: {
      context,
      supportedResourceCounts: {
        conditions: context.conditions?.length ?? 0,
        medications: context.medications?.length ?? 0,
        observations: context.observations?.length ?? 0,
        allergies: context.allergies?.length ?? 0,
        encounters: context.encounters?.length ?? 0,
        procedures: context.procedures?.length ?? 0,
        carePlans: context.carePlans?.length ?? 0,
        serviceRequests: context.serviceRequests?.length ?? 0
      }
    }
  };
}
