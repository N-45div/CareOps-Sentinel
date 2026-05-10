import { type InferSchema, type ToolMetadata } from "xmcp";
import { validateAgentOutput } from "../domain/safetyEngine";
import { validationInputSchema } from "../mcp/schemas";

export const schema = validationInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "create_review_task_payload",
  description: "Create a FHIR Task-shaped payload for human review routing from a CareOps Sentinel validation run.",
  annotations: {
    title: "Create Review Task Payload",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function createReviewTaskPayload(input: InferSchema<typeof schema>) {
  const result = validateAgentOutput(validationInputSchema.parse(input));

  return {
    structuredContent: result.reviewTask
  };
}
