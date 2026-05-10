import { AgentOutput, ContradictionFinding, FhirContext, FhirReference } from "./types";

export interface EvidenceMatch {
  reference: FhirReference;
  matchType:
    | "system_code_match"
    | "code_match"
    | "display_match"
    | "terminology_synonym_match"
    | "value_aware_observation_match"
    | "status_aware_match";
  confidence: "high" | "medium" | "low";
  rationale: string;
}

const medicationSynonyms: Record<string, string[]> = {
  metformin: ["metformin hydrochloride", "glucophage"],
  lisinopril: ["prinivil", "zestril"],
  amlodipine: ["norvasc"],
  insulin: ["insulin therapy"]
};

const observationSynonyms: Record<string, string[]> = {
  "hemoglobin a1c": ["a1c", "hba1c", "glycated hemoglobin"],
  "blood pressure": ["bp", "systolic", "diastolic"],
  glucose: ["blood glucose", "serum glucose"],
  creatinine: ["serum creatinine"]
};

export function findEvidenceMatches(reference: FhirReference, claim: string): EvidenceMatch[] {
  const normalizedClaim = normalize(claim);
  const matches: EvidenceMatch[] = [];

  if (reference.system && reference.code && normalizedClaim.includes(normalize(reference.code))) {
    matches.push({
      reference,
      matchType: "system_code_match",
      confidence: "high",
      rationale: `Claim includes ${reference.system}|${reference.code}.`
    });
  } else if (reference.code && normalizedClaim.includes(normalize(reference.code))) {
    matches.push({
      reference,
      matchType: "code_match",
      confidence: "high",
      rationale: `Claim includes code ${reference.code}.`
    });
  }

  if (reference.display && containsTerm(normalizedClaim, reference.display)) {
    matches.push({
      reference,
      matchType: "display_match",
      confidence: "high",
      rationale: `Claim mentions FHIR display "${reference.display}".`
    });
  }

  for (const synonym of synonymsFor(reference)) {
    if (containsTerm(normalizedClaim, synonym)) {
      matches.push({
        reference,
        matchType: "terminology_synonym_match",
        confidence: "medium",
        rationale: `Claim matches terminology synonym "${synonym}" for ${reference.display ?? reference.code}.`
      });
    }
  }

  if (reference.resourceType === "Observation") {
    const observationMatch = observationValueMatch(reference, normalizedClaim);
    if (observationMatch) {
      matches.push(observationMatch);
    }
  }

  if (reference.status && normalizedClaim.includes(normalize(reference.status))) {
    matches.push({
      reference,
      matchType: "status_aware_match",
      confidence: "medium",
      rationale: `Claim references FHIR status "${reference.status}".`
    });
  }

  return dedupeMatches(matches);
}

export function bestEvidenceMatch(reference: FhirReference, claim: string): EvidenceMatch | undefined {
  return findEvidenceMatches(reference, claim).sort((first, second) => matchRank(second) - matchRank(first))[0];
}

export function findContextContradictions(
  fhirContext: FhirContext,
  agentOutputs: AgentOutput[]
): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  for (const agent of agentOutputs) {
    const output = normalize(agent.output);

    if (hasActiveEvidence(fhirContext.allergies) && /\b(no known allergies|nka|no allergies)\b/i.test(agent.output)) {
      findings.push({
        firstAgent: agent.agentName,
        secondAgent: "FHIR Context",
        topic: "allergy status",
        rationale: "Agent claims no known allergies, but FHIR context contains active AllergyIntolerance evidence."
      });
    }

    for (const medication of fhirContext.medications ?? []) {
      const terms = evidenceTerms(medication);
      if (terms.some((term) => containsTerm(output, term)) && negatesMedicationUse(output)) {
        findings.push({
          firstAgent: agent.agentName,
          secondAgent: "FHIR Context",
          topic: "active medication",
          rationale: `Agent denies medication use, but FHIR context contains ${medication.status ?? "known"} medication evidence for ${medication.display ?? medication.code}.`
        });
      }
    }

    for (const condition of fhirContext.conditions ?? []) {
      const terms = evidenceTerms(condition);
      if (terms.some((term) => containsTerm(output, term)) && negatesCondition(output)) {
        findings.push({
          firstAgent: agent.agentName,
          secondAgent: "FHIR Context",
          topic: "active condition",
          rationale: `Agent denies a condition, but FHIR context contains condition evidence for ${condition.display ?? condition.code}.`
        });
      }
    }

    for (const observation of fhirContext.observations ?? []) {
      const abnormality = observationAbnormality(observation);
      if (!abnormality) {
        continue;
      }

      const terms = evidenceTerms(observation);
      const mentionsObservation = terms.some((term) => containsTerm(output, term));
      if (mentionsObservation && output.includes("normal") && abnormality !== "normal") {
        findings.push({
          firstAgent: agent.agentName,
          secondAgent: "FHIR Context",
          topic: "observation interpretation",
          rationale: `Agent says observation is normal, but FHIR value ${observation.value} for ${observation.display ?? observation.code} is ${abnormality}.`
        });
      }
    }
  }

  return dedupeContradictions(findings);
}

export function evidenceTerms(reference: FhirReference): string[] {
  return [
    reference.display,
    reference.code,
    reference.status,
    reference.category,
    reference.value?.toString(),
    ...synonymsFor(reference)
  ]
    .filter((term): term is string => Boolean(term))
    .map(normalize)
    .filter((term) => term.length > 1);
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalize(term);

  if (normalizedTerm.length <= 2) {
    return false;
  }

  if (normalizedText.includes(normalizedTerm)) {
    return true;
  }

  const words = normalizedTerm.split(" ").filter((word) => word.length > 2);
  return words.length > 0 && words.every((word) => normalizedText.includes(word));
}

function synonymsFor(reference: FhirReference): string[] {
  const display = normalize(reference.display ?? "");
  const baseTerms =
    reference.resourceType === "Observation"
      ? observationSynonyms
      : reference.resourceType === "MedicationRequest" || reference.resourceType === "MedicationStatement"
        ? medicationSynonyms
        : {};

  return Object.entries(baseTerms)
    .filter(([canonical]) => display.includes(canonical) || canonical.includes(display))
    .flatMap(([canonical, synonyms]) => [canonical, ...synonyms]);
}

function observationValueMatch(reference: FhirReference, normalizedClaim: string): EvidenceMatch | undefined {
  if (reference.value === undefined) {
    return undefined;
  }

  const normalizedValue = normalize(reference.value.toString());
  const mentionsValue = normalizedValue.length > 0 && normalizedClaim.includes(normalizedValue);
  const abnormality = observationAbnormality(reference);
  const mentionsInterpretation =
    abnormality !== undefined &&
    ((abnormality === "high" && /\b(high|elevated|abnormal|uncontrolled)\b/.test(normalizedClaim)) ||
      (abnormality === "normal" && /\b(normal|within range)\b/.test(normalizedClaim)));

  if (!mentionsValue && !mentionsInterpretation) {
    return undefined;
  }

  return {
    reference,
    matchType: "value_aware_observation_match",
    confidence: mentionsValue ? "high" : "medium",
    rationale: `Claim matches observation value/interpretion for ${reference.display ?? reference.code}: ${reference.value}.`
  };
}

function observationAbnormality(reference: FhirReference): "high" | "normal" | undefined {
  const display = normalize(reference.display ?? "");
  const value = numericValue(reference.value);

  if (value === undefined) {
    return undefined;
  }

  if ((display.includes("a1c") || display.includes("hemoglobin")) && value >= 6.5) {
    return "high";
  }

  if ((display.includes("a1c") || display.includes("hemoglobin")) && value < 5.7) {
    return "normal";
  }

  return undefined;
}

function numericValue(value: FhirReference["value"]): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function hasActiveEvidence(references: FhirReference[] | undefined): boolean {
  return (references ?? []).some((reference) => !reference.status || /active|confirmed/i.test(reference.status));
}

function negatesMedicationUse(normalizedOutput: string): boolean {
  return /\b(not taking|stopped|discontinued|no longer taking|does not take|isn t taking)\b/.test(normalizedOutput);
}

function negatesCondition(normalizedOutput: string): boolean {
  return /\b(no history of|does not have|without|denies)\b/.test(normalizedOutput);
}

function matchRank(match: EvidenceMatch): number {
  const confidenceRank = { high: 30, medium: 20, low: 10 }[match.confidence];
  const typeRank: Record<EvidenceMatch["matchType"], number> = {
    system_code_match: 7,
    code_match: 6,
    value_aware_observation_match: 5,
    display_match: 4,
    terminology_synonym_match: 3,
    status_aware_match: 2
  };

  return confidenceRank + typeRank[match.matchType];
}

function dedupeMatches(matches: EvidenceMatch[]): EvidenceMatch[] {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const key = `${match.reference.resourceType}/${match.reference.id}/${match.matchType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeContradictions(findings: ContradictionFinding[]): ContradictionFinding[] {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.firstAgent}/${finding.secondAgent}/${finding.topic}/${finding.rationale}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
