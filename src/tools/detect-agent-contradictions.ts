import { type InferSchema, type ToolMetadata } from "xmcp";
import { findContradictions } from "../domain/safetyEngine";
import { contradictionInputSchema } from "../mcp/schemas";

export const schema = contradictionInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "detect_agent_contradictions",
  description: "Detect contradictions between two or more healthcare agent outputs.",
  annotations: {
    title: "Detect Agent Contradictions",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function detectAgentContradictions(input: InferSchema<typeof schema>) {
  const parsed = contradictionInputSchema.parse(input);

  return {
    structuredContent: {
      contradictions: findContradictions(parsed.agentOutputs)
    }
  };
}
