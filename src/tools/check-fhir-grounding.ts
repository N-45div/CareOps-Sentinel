import { type InferSchema, type ToolMetadata } from "xmcp";
import { buildEvidenceGrounding } from "../domain/safetyEngine";
import { groundingInputSchema } from "../mcp/schemas";

export const schema = groundingInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "check_fhir_grounding",
  description: "Map agent claims to supplied synthetic FHIR context and flag claims with missing evidence.",
  annotations: {
    title: "Check FHIR Grounding",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function checkFhirGrounding(input: InferSchema<typeof schema>) {
  const parsed = groundingInputSchema.parse(input);

  return {
    structuredContent: {
      findings: buildEvidenceGrounding(parsed.fhirContext, parsed.agentOutputs)
    }
  };
}
