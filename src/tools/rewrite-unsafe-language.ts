import { type InferSchema, type ToolMetadata } from "xmcp";
import { findUnsafeLanguage } from "../domain/safetyEngine";
import { rewriteInputSchema } from "../mcp/schemas";

export const schema = rewriteInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "rewrite_unsafe_language",
  description:
    "Identify unsafe clinical-action wording and return safer human-review alternatives without issuing medical orders.",
  annotations: {
    title: "Rewrite Unsafe Language",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function rewriteUnsafeLanguage(input: InferSchema<typeof schema>) {
  const parsed = rewriteInputSchema.parse(input);

  return {
    structuredContent: {
      unsafeLanguage: findUnsafeLanguage(parsed.agentOutputs),
      policy:
        "Rewrite direct diagnosis, medication, approval, or no-review language as clinician-review recommendations."
    }
  };
}
