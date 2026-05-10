import { ResolveTermOptions, TerminologyConcept } from "./types";

const loincSystem = "http://loinc.org";

const localObservationTerms: TerminologyConcept[] = [
  {
    system: loincSystem,
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    source: "local",
    synonyms: ["a1c", "hba1c", "hemoglobin a1c", "glycated hemoglobin"]
  },
  {
    system: loincSystem,
    display: "blood pressure",
    source: "local",
    synonyms: ["bp", "systolic", "diastolic", "blood pressure"]
  },
  {
    system: loincSystem,
    display: "glucose",
    source: "local",
    synonyms: ["blood glucose", "serum glucose", "glucose"]
  },
  {
    system: loincSystem,
    display: "creatinine",
    source: "local",
    synonyms: ["serum creatinine", "creatinine"]
  }
];

export async function resolveObservationTerm(
  term: string,
  options: ResolveTermOptions = {}
): Promise<TerminologyConcept[]> {
  const localMatches = localObservationTerms.filter((concept) => conceptMatches(concept, term));

  if (!options.useNetwork) {
    return localMatches;
  }

  const remote = await resolveClinicalTablesLoinc(term, options).catch(() => []);
  return mergeConcepts([...localMatches, ...remote]);
}

function conceptMatches(concept: TerminologyConcept, term: string): boolean {
  const normalizedTerm = normalize(term);
  return [concept.display, concept.code, ...concept.synonyms]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalize(value).includes(normalizedTerm) || normalizedTerm.includes(normalize(value)));
}

async function resolveClinicalTablesLoinc(
  term: string,
  options: ResolveTermOptions
): Promise<TerminologyConcept[]> {
  const url = new URL("https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search");
  url.searchParams.set("terms", term);
  url.searchParams.set("maxList", "5");

  const response = await fetchWithTimeout(url, options.timeoutMs ?? 8000);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown[];
  const rows = Array.isArray(payload[3]) ? payload[3] : [];

  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => ({
      system: loincSystem,
      code: typeof row[0] === "string" ? row[0] : undefined,
      display: typeof row[1] === "string" ? row[1] : term,
      source: "clinical_tables" as const,
      synonyms: [term]
    }));
}

function mergeConcepts(concepts: TerminologyConcept[]): TerminologyConcept[] {
  const seen = new Set<string>();
  return concepts.filter((concept) => {
    const key = `${concept.system}|${concept.code ?? concept.display}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchWithTimeout(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
