import { type InferSchema, type ToolMetadata } from "xmcp";
import { bestEvidenceMatch } from "../domain/evidenceMatcher";
import { FhirContext, FhirReference } from "../domain/types";
import { explainEvidenceMatchInputSchema } from "../mcp/schemas";

export const schema = explainEvidenceMatchInputSchema.shape;

export const metadata: ToolMetadata = {
  name: "explain_evidence_match",
  description: "Explain how a claim matches the supplied FHIR patient context and return match confidence.",
  annotations: {
    title: "Explain Evidence Match",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true
  }
};

export default async function explainEvidenceMatch(input: InferSchema<typeof schema>) {
  const parsed = explainEvidenceMatchInputSchema.parse(input);
  const references = flattenContext(parsed.fhirContext);
  const matches = references
    .map((reference) => bestEvidenceMatch(reference, parsed.claim))
    .filter((match): match is NonNullable<typeof match> => Boolean(match));

  return {
    structuredContent: {
      claim: parsed.claim,
      matches
    }
  };
}

function flattenContext(fhirContext: FhirContext): FhirReference[] {
  return [
    fhirContext.patient,
    ...(fhirContext.conditions ?? []),
    ...(fhirContext.medications ?? []),
    ...(fhirContext.observations ?? []),
    ...(fhirContext.allergies ?? []),
    ...(fhirContext.encounters ?? []),
    ...(fhirContext.procedures ?? []),
    ...(fhirContext.carePlans ?? []),
    ...(fhirContext.serviceRequests ?? [])
  ];
}
