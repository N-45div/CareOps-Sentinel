import {
  AgentOutput,
  AuditPacket,
  ContradictionFinding,
  EvidenceFinding,
  FhirContext,
  FhirReference,
  UnsafeLanguageFinding,
  ValidationInput,
  ValidationResult
} from "./types.js";
import { bestEvidenceMatch, findContextContradictions } from "./evidenceMatcher";

const unsafePatterns: Array<{
  pattern: RegExp;
  phrase: string;
  severity: UnsafeLanguageFinding["severity"];
  saferAlternative: string;
  rationale: string;
}> = [
  {
    pattern: /\b(start|stop|increase|decrease|prescribe|discontinue)\b/i,
    phrase: "direct medication action",
    severity: "high",
    saferAlternative: "Recommend clinician review of the medication plan.",
    rationale: "Medication changes require licensed clinical review."
  },
  {
    pattern: /\b(diagnose|definitely has|confirmed diagnosis)\b/i,
    phrase: "diagnostic certainty",
    severity: "high",
    saferAlternative: "State that the finding may warrant clinician evaluation.",
    rationale: "The agent must not make final diagnostic determinations."
  },
  {
    pattern: /\b(approve|submit automatically|authorization is approved)\b/i,
    phrase: "automated approval",
    severity: "high",
    saferAlternative: "Prepare materials for human review and submission.",
    rationale: "Administrative or clinical approvals must not be automated by this tool."
  },
  {
    pattern: /\b(no review needed|safe to proceed without review)\b/i,
    phrase: "bypasses human review",
    severity: "medium",
    saferAlternative: "Proceed only after appropriate clinician review.",
    rationale: "The MVP is explicitly human-in-the-loop."
  }
];

const contradictionTopics = [
  {
    topic: "allergy status",
    positive: /\b(no known allergies|nka)\b/i,
    negative: /\ballerg(y|ic|ies)\b/i
  },
  {
    topic: "discharge readiness",
    positive: /\bready for discharge|stable for discharge\b/i,
    negative: /\bnot ready for discharge|unstable|needs admission\b/i
  },
  {
    topic: "medication adherence",
    positive: /\badherent|taking as directed\b/i,
    negative: /\bnonadherent|missed doses|not taking\b/i
  }
];

export function validateAgentOutput(input: ValidationInput): ValidationResult {
  const evidenceGrounding = buildEvidenceGrounding(input.fhirContext, input.agentOutputs);
  const unsafeLanguage = findUnsafeLanguage(input.agentOutputs);
  const contradictions = [...findContradictions(input.agentOutputs), ...findContextContradictions(input.fhirContext, input.agentOutputs)];
  const missingEvidenceChecklist = buildMissingEvidenceChecklist(evidenceGrounding);
  const safeRewrite = buildSafeRewrite(input.agentOutputs, unsafeLanguage, missingEvidenceChecklist);
  const riskScore = scoreRisk(evidenceGrounding, unsafeLanguage, contradictions);
  const verdict = riskScore >= 75 ? "blocked" : riskScore >= 35 ? "needs_revision" : "pass_with_review";
  const humanReviewRecommendation = buildHumanReviewRecommendation(verdict, riskScore);

  const auditPacket: AuditPacket = {
    summary: `Reviewed ${input.agentOutputs.length} agent output(s) for ${input.workflowType ?? "unspecified workflow"}.`,
    evidenceGrounding,
    contradictions,
    unsafeLanguage,
    missingEvidenceChecklist,
    safeRewrite,
    humanReviewRecommendation
  };

  return {
    verdict,
    riskScore,
    auditPacket,
    reviewTask: createReviewTaskPayload(input, verdict, riskScore, humanReviewRecommendation)
  };
}

export function buildEvidenceGrounding(
  fhirContext: FhirContext,
  agentOutputs: AgentOutput[]
): EvidenceFinding[] {
  const evidenceIndex = flattenFhirContext(fhirContext);
  const claims = agentOutputs.flatMap((agent) =>
    extractClaims(agent).map((claim) => ({ claim, agentName: agent.agentName }))
  );

  return claims.map(({ claim, agentName }) => {
    const matches = evidenceIndex
      .map((item) => bestEvidenceMatch(item, claim))
      .filter((match): match is NonNullable<typeof match> => Boolean(match));

    if (matches.length > 0) {
      const bestMatch = matches[0];
      return {
        claim,
        status: "grounded",
        evidence: matches.map((match) => match.reference),
        matchType: bestMatch.matchType,
        confidence: bestMatch.confidence,
        rationale: `${agentName} claim is supported by ${bestMatch.matchType}: ${bestMatch.rationale}`
      };
    }

    return {
      claim,
      status: "missing_evidence",
      evidence: [],
      rationale: `${agentName} claim was not found in the supplied FHIR context.`
    };
  });
}

export function findUnsafeLanguage(agentOutputs: AgentOutput[]): UnsafeLanguageFinding[] {
  const findings: UnsafeLanguageFinding[] = [];

  for (const agent of agentOutputs) {
    for (const rule of unsafePatterns) {
      if (rule.pattern.test(agent.output)) {
        findings.push({
          phrase: `${agent.agentName}: ${rule.phrase}`,
          severity: rule.severity,
          rationale: rule.rationale,
          saferAlternative: rule.saferAlternative
        });
      }
    }
  }

  return findings;
}

export function findContradictions(agentOutputs: AgentOutput[]): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  for (let i = 0; i < agentOutputs.length; i += 1) {
    for (let j = i + 1; j < agentOutputs.length; j += 1) {
      const first = agentOutputs[i];
      const second = agentOutputs[j];

      for (const topic of contradictionTopics) {
        const firstPositive = topic.positive.test(first.output);
        const firstNegative = topic.negative.test(first.output);
        const secondPositive = topic.positive.test(second.output);
        const secondNegative = topic.negative.test(second.output);

        if ((firstPositive && secondNegative) || (firstNegative && secondPositive)) {
          findings.push({
            firstAgent: first.agentName,
            secondAgent: second.agentName,
            topic: topic.topic,
            rationale: "Agent outputs make opposing statements on the same clinical workflow topic."
          });
        }
      }
    }
  }

  return findings;
}

function extractClaims(agentOutput: AgentOutput): string[] {
  if (agentOutput.claims?.length) {
    return agentOutput.claims;
  }

  return agentOutput.output
    .split(/[.;\n]/)
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 12);
}

function flattenFhirContext(fhirContext: FhirContext): FhirReference[] {
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

function buildMissingEvidenceChecklist(evidenceGrounding: EvidenceFinding[]): string[] {
  return evidenceGrounding
    .filter((finding) => finding.status !== "grounded")
    .map((finding) => `Add FHIR evidence for: ${finding.claim}`);
}

function buildSafeRewrite(
  agentOutputs: AgentOutput[],
  unsafeLanguage: UnsafeLanguageFinding[],
  missingEvidenceChecklist: string[]
): string {
  const sourceSummary = agentOutputs.map((agent) => `${agent.agentName}: ${agent.output}`).join(" ");
  const needsReview =
    unsafeLanguage.length > 0 || missingEvidenceChecklist.length > 0
      ? "This output needs clinician review before workflow use."
      : "This output may proceed to clinician review with the available evidence.";

  return `${needsReview} Evidence-supported statements should be retained, unsupported statements should be marked as missing evidence, and any direct clinical actions should be rewritten as review recommendations. Source: ${sourceSummary}`;
}

function scoreRisk(
  evidenceGrounding: EvidenceFinding[],
  unsafeLanguage: UnsafeLanguageFinding[],
  contradictions: ContradictionFinding[]
): number {
  const missingEvidenceRisk = evidenceGrounding.filter((finding) => finding.status !== "grounded").length * 15;
  const unsafeRisk = unsafeLanguage.reduce((total, finding) => total + (finding.severity === "high" ? 30 : 15), 0);
  const contradictionRisk = contradictions.length * 18;

  return Math.min(100, missingEvidenceRisk + unsafeRisk + contradictionRisk);
}

function buildHumanReviewRecommendation(verdict: ValidationResult["verdict"], riskScore: number): string {
  if (verdict === "blocked") {
    return `Block workflow progression until clinician review is complete. Risk score: ${riskScore}.`;
  }

  if (verdict === "needs_revision") {
    return `Revise unsafe or unsupported language, then route to clinician review. Risk score: ${riskScore}.`;
  }

  return `Route audit packet to clinician review before use. Risk score: ${riskScore}.`;
}

function createReviewTaskPayload(
  input: ValidationInput,
  verdict: ValidationResult["verdict"],
  riskScore: number,
  recommendation: string
): Record<string, unknown> {
  return {
    resourceType: "Task",
    status: "requested",
    intent: "order",
    code: {
      text: "CareOps Sentinel human review"
    },
    for: {
      reference: `${input.fhirContext.patient.resourceType}/${input.fhirContext.patient.id}`,
      display: input.fhirContext.patient.display
    },
    priority: verdict === "blocked" ? "urgent" : "routine",
    description: recommendation,
    input: [
      {
        type: {
          text: "workflowType"
        },
        valueString: input.workflowType ?? "unspecified"
      },
      {
        type: {
          text: "riskScore"
        },
        valueInteger: riskScore
      }
    ]
  };
}
