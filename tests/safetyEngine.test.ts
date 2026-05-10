import { describe, expect, it } from "vitest";
import sampleInput from "../src/fixtures/sampleValidationInput.json" with { type: "json" };
import {
  buildEvidenceGrounding,
  findContradictions,
  findUnsafeLanguage,
  validateAgentOutput
} from "../src/domain/safetyEngine.js";
import { validationInputSchema } from "../src/mcp/schemas.js";

const parsedSample = validationInputSchema.parse(sampleInput);

describe("CareOps Sentinel safety engine", () => {
  it("blocks unsafe medication action language with missing evidence", () => {
    const result = validateAgentOutput(parsedSample);

    expect(result.verdict).toBe("blocked");
    expect(result.riskScore).toBeGreaterThanOrEqual(75);
    expect(result.auditPacket.unsafeLanguage.length).toBeGreaterThan(0);
    expect(result.auditPacket.missingEvidenceChecklist).toContain(
      "Add FHIR evidence for: The patient should start amlodipine today"
    );
    expect(result.reviewTask).toMatchObject({
      resourceType: "Task",
      status: "requested",
      priority: "urgent"
    });
  });

  it("grounds claims against supplied synthetic FHIR context", () => {
    const findings = buildEvidenceGrounding(parsedSample.fhirContext, parsedSample.agentOutputs);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: "The patient has hypertension",
          status: "grounded"
        }),
        expect.objectContaining({
          claim: "The patient is taking lisinopril",
          status: "grounded"
        })
      ])
    );
  });

  it("detects unsafe language without making clinical recommendations", () => {
    const findings = findUnsafeLanguage(parsedSample.agentOutputs);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phrase: "Medication Review Agent: direct medication action",
          severity: "high"
        }),
        expect.objectContaining({
          phrase: "Medication Review Agent: bypasses human review",
          severity: "medium"
        })
      ])
    );
  });

  it("detects contradiction between no-known-allergies and allergy context statements", () => {
    const findings = findContradictions([
      {
        agentName: "Agent A",
        output: "The patient has no known allergies."
      },
      {
        agentName: "Agent B",
        output: "The patient has a penicillin allergy."
      }
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        firstAgent: "Agent A",
        secondAgent: "Agent B",
        topic: "allergy status"
      })
    ]);
  });
});
