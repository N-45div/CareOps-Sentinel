import { describe, expect, it } from "vitest";
import sampleBundle from "../src/fixtures/sampleFhirBundle.json" with { type: "json" };
import { validateAgentOutput } from "../src/domain/safetyEngine";
import { normalizeFhirBundle } from "../src/fhir/normalizer";
import { fhirBundleSchema } from "../src/mcp/schemas";

describe("FHIR Bundle normalization", () => {
  it("normalizes real FHIR R4 Bundle structure into grounding context", () => {
    const bundle = fhirBundleSchema.parse(sampleBundle);
    const context = normalizeFhirBundle(bundle);

    expect(context.patient).toMatchObject({
      resourceType: "Patient",
      id: "synthetic-patient-002",
      display: "Jordan Rivera"
    });
    expect(context.source).toMatchObject({
      mode: "bundle",
      patientId: "synthetic-patient-002",
      resourceCount: 6
    });
    expect(context.conditions).toEqual([
      expect.objectContaining({
        display: "Type 2 diabetes mellitus",
        system: "http://snomed.info/sct",
        code: "44054006"
      })
    ]);
    expect(context.medications).toEqual([
      expect.objectContaining({
        display: "metformin",
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: "860975"
      })
    ]);
    expect(context.observations).toEqual([
      expect.objectContaining({
        display: "Hemoglobin A1c",
        system: "http://loinc.org",
        code: "4548-4",
        value: "8.4 %"
      })
    ]);
  });

  it("validates agent output against normalized FHIR Bundle evidence", () => {
    const context = normalizeFhirBundle(fhirBundleSchema.parse(sampleBundle));
    const result = validateAgentOutput({
      workflowType: "medication_safety_review",
      fhirContext: context,
      agentOutputs: [
        {
          agentName: "Medication Review Agent",
          output:
            "The patient has Type 2 diabetes mellitus and is taking metformin. Start insulin today.",
          claims: [
            "The patient has Type 2 diabetes mellitus",
            "The patient is taking metformin",
            "The patient should start insulin today"
          ]
        }
      ]
    });

    expect(result.auditPacket.evidenceGrounding).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: "The patient has Type 2 diabetes mellitus",
          status: "grounded"
        }),
        expect.objectContaining({
          claim: "The patient is taking metformin",
          status: "grounded"
        }),
        expect.objectContaining({
          claim: "The patient should start insulin today",
          status: "missing_evidence"
        })
      ])
    );
    expect(result.auditPacket.unsafeLanguage).toEqual([
      expect.objectContaining({
        phrase: "Medication Review Agent: direct medication action"
      })
    ]);
    expect(result.verdict).toBe("needs_revision");
  });
});
