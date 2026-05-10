import { type InferSchema, type ToolMetadata } from "xmcp";
import { validateAgentOutput } from "../domain/safetyEngine";
import { validationInputSchema } from "../mcp/schemas";

export const schema = validationInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "generate_audit_packet",
  description: "Generate a clinician-ready CareOps Sentinel audit packet from agent outputs and synthetic FHIR context.",
  annotations: {
    title: "Generate Audit Packet",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function generateAuditPacket(input: InferSchema<typeof schema>) {
  const result = validateAgentOutput(validationInputSchema.parse(input));

  return {
    structuredContent: result.auditPacket
  };
}
