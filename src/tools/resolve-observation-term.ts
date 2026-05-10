import { type InferSchema, type ToolMetadata } from "xmcp";
import { resolveTerminologyInputSchema } from "../mcp/schemas";
import { resolveObservationTerm } from "../terminology/loincAdapter";

export const schema = resolveTerminologyInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "resolve_observation_term",
  description: "Resolve a lab or vital-sign term to local and optionally NLM Clinical Tables/LOINC concepts.",
  annotations: {
    title: "Resolve Observation Term",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false
  }
};

export default async function resolveObservationTermTool(input: InferSchema<typeof schema>) {
  const parsed = resolveTerminologyInputSchema.parse(input);
  const concepts = await resolveObservationTerm(parsed.term, { useNetwork: parsed.useNetwork });

  return {
    structuredContent: {
      term: parsed.term,
      concepts
    }
  };
}
