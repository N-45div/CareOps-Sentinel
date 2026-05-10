import { type InferSchema, type ToolMetadata } from "xmcp";
import { resolveTerminologyInputSchema } from "../mcp/schemas";
import { resolveMedicationTerm } from "../terminology/rxNormAdapter";

export const schema = resolveTerminologyInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "resolve_medication_term",
  description: "Resolve a medication term to local and optionally RxNav/RxNorm terminology concepts.",
  annotations: {
    title: "Resolve Medication Term",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false
  }
};

export default async function resolveMedicationTermTool(input: InferSchema<typeof schema>) {
  const parsed = resolveTerminologyInputSchema.parse(input);
  const concepts = await resolveMedicationTerm(parsed.term, { useNetwork: parsed.useNetwork });

  return {
    structuredContent: {
      term: parsed.term,
      concepts
    }
  };
}
