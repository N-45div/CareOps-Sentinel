import { describe, expect, it } from "vitest";
import sampleBundle from "../src/fixtures/sampleFhirBundle.json" with { type: "json" };
import { buildEvidenceGrounding, validateAgentOutput } from "../src/domain/safetyEngine";
import { bestEvidenceMatch, findContextContradictions, findEvidenceMatches } from "../src/domain/evidenceMatcher";
import { normalizeFhirBundle } from "../src/fhir/normalizer";
import { fhirBundleSchema } from "../src/mcp/schemas";
import { resolveObservationTerm } from "../src/terminology/loincAdapter";
import { resolveMedicationTerm } from "../src/terminology/rxNormAdapter";

const context = normalizeFhirBundle(fhirBundleSchema.parse(sampleBundle));

describe("terminology-aware evidence matching", () => {
  it("resolves medication terms with deterministic RxNorm-style concepts", async () => {
    const concepts = await resolveMedicationTerm("metformin");

    expect(concepts).toEqual([
      expect.objectContaining({
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: "860975",
        display: "metformin hydrochloride 500 MG Oral Tablet",
        source: "local"
      })
    ]);
  });

  it("resolves observation terms with deterministic LOINC-style concepts", async () => {
    const concepts = await resolveObservationTerm("A1c");

    expect(concepts).toEqual([
      expect.objectContaining({
        system: "http://loinc.org",
        code: "4548-4",
        source: "local"
      })
    ]);
  });

  it("grounds A1c claim through terminology and value-aware matching", () => {
    const observation = context.observations?.[0];
    expect(observation).toBeDefined();

    const match = bestEvidenceMatch(observation!, "A1c is elevated");
    const matches = findEvidenceMatches(observation!, "A1c is elevated");

    expect(match).toMatchObject({
      matchType: "value_aware_observation_match",
      confidence: "medium"
    });
    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          matchType: "terminology_synonym_match",
          confidence: "medium"
        })
      ])
    );
  });

  it("grounds medication claims with match metadata", () => {
    const findings = buildEvidenceGrounding(context, [
      {
        agentName: "Medication Review Agent",
        output: "The patient is taking metformin.",
        claims: ["The patient is taking metformin"]
      }
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        claim: "The patient is taking metformin",
        status: "grounded",
        matchType: "display_match",
        confidence: "high"
      })
    ]);
  });

  it("detects no-known-allergies contradiction against active FHIR allergy", () => {
    const contradictions = findContextContradictions(context, [
      {
        agentName: "Discharge Agent",
        output: "The patient has no known allergies and is ready for discharge."
      }
    ]);

    expect(contradictions).toEqual([
      expect.objectContaining({
        firstAgent: "Discharge Agent",
        secondAgent: "FHIR Context",
        topic: "allergy status"
      })
    ]);
  });

  it("detects normal A1c contradiction against elevated FHIR value", () => {
    const contradictions = findContextContradictions(context, [
      {
        agentName: "Care Gap Agent",
        output: "The patient's A1c is normal."
      }
    ]);

    expect(contradictions).toEqual([
      expect.objectContaining({
        topic: "observation interpretation"
      })
    ]);
  });

  it("rolls context contradictions into validation risk", () => {
    const result = validateAgentOutput({
      workflowType: "care_gap_review",
      fhirContext: context,
      agentOutputs: [
        {
          agentName: "Care Gap Agent",
          output: "The patient's A1c is normal. The patient has no known allergies.",
          claims: ["The patient's A1c is normal"]
        }
      ]
    });

    expect(result.auditPacket.contradictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ topic: "observation interpretation" }),
        expect.objectContaining({ topic: "allergy status" })
      ])
    );
    expect(result.verdict).toBe("needs_revision");
  });
});
