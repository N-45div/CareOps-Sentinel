import { type InferSchema, type ToolMetadata } from "xmcp";
import { findContextContradictions } from "../domain/evidenceMatcher";
import { contextContradictionsInputSchema } from "../mcp/schemas";

export const schema = contextContradictionsInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "check_context_contradictions",
  description: "Detect contradictions between agent output and the supplied FHIR patient context.",
  annotations: {
    title: "Check Context Contradictions",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function checkContextContradictions(input: InferSchema<typeof schema>) {
  const parsed = contextContradictionsInputSchema.parse(input);

  return {
    structuredContent: {
      contradictions: findContextContradictions(parsed.fhirContext, parsed.agentOutputs)
    }
  };
}
