import { type InferSchema, type ToolMetadata } from "xmcp";
import { validateAgentOutput } from "../domain/safetyEngine";
import { validationInputSchema } from "../mcp/schemas";

export const schema = validationInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "validate_agent_output",
  description:
    "Validate healthcare agent output against synthetic FHIR context and return a safety verdict, risk score, audit packet, and review task.",
  annotations: {
    title: "Validate Agent Output",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function validateAgentOutputTool(input: InferSchema<typeof schema>) {
  return {
    structuredContent: validateAgentOutput(validationInputSchema.parse(input))
  };
}
