import { NextResponse } from "next/server";
import { z, ZodError } from "zod/v4";
import { validateAgentOutput } from "../../../src/domain/safetyEngine";
import { FhirClient } from "../../../src/fhir/client";
import { normalizeFhirBundle } from "../../../src/fhir/normalizer";
import { clinicalWorkflowSchema } from "../../../src/mcp/schemas";

const reviewRequestSchema = z.object({
  fhirBaseUrl: z.string().url(),
  patientId: z.string().min(1),
  bearerToken: z.string().optional(),
  workflowType: clinicalWorkflowSchema.default("medication_safety_review"),
  agentName: z.string().min(1).default("Healthcare Agent Draft"),
  draftOutput: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const parsed = reviewRequestSchema.parse(await request.json());
    const client = new FhirClient({
      baseUrl: parsed.fhirBaseUrl,
      bearerToken: parsed.bearerToken || undefined
    });

    const bundle = await client.fetchPatientContext(parsed.patientId);
    const fhirContext = normalizeFhirBundle(bundle, {
      mode: "fhir_server",
      baseUrl: client.getBaseUrl(),
      patientId: parsed.patientId,
      resourceCount: 0
    });

    const result = validateAgentOutput({
      workflowType: parsed.workflowType,
      fhirContext,
      agentOutputs: [
        {
          agentName: parsed.agentName,
          role: "draft",
          output: parsed.draftOutput,
          claims: extractClaims(parsed.draftOutput)
        }
      ]
    });

    return NextResponse.json({
      result,
      source: fhirContext.source,
      patient: fhirContext.patient
    });
  } catch (error) {
    const message = formatReviewError(error);
    const status = error instanceof ZodError ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

function extractClaims(output: string): string[] {
  return output
    .split(/(?<=[.!?])\s+|\n+/)
    .map((claim) => claim.trim())
    .filter(Boolean);
}

function formatReviewError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
  }

  return error instanceof Error ? error.message : "Unknown review failure";
}
