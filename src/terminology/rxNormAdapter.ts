import { ResolveTermOptions, TerminologyConcept } from "./types";

const rxNormSystem = "http://www.nlm.nih.gov/research/umls/rxnorm";

const localMedicationTerms: TerminologyConcept[] = [
  {
    system: rxNormSystem,
    code: "860975",
    display: "metformin hydrochloride 500 MG Oral Tablet",
    source: "local",
    synonyms: ["metformin", "metformin hydrochloride", "glucophage"]
  },
  {
    system: rxNormSystem,
    display: "lisinopril",
    source: "local",
    synonyms: ["lisinopril", "prinivil", "zestril"]
  },
  {
    system: rxNormSystem,
    display: "amlodipine",
    source: "local",
    synonyms: ["amlodipine", "norvasc"]
  },
  {
    system: rxNormSystem,
    display: "insulin",
    source: "local",
    synonyms: ["insulin", "insulin therapy"]
  }
];

export async function resolveMedicationTerm(
  term: string,
  options: ResolveTermOptions = {}
): Promise<TerminologyConcept[]> {
  const localMatches = localMedicationTerms.filter((concept) => conceptMatches(concept, term));

  if (!options.useNetwork) {
    return localMatches;
  }

  const remote = await resolveRxNav(term, options).catch(() => []);
  return mergeConcepts([...localMatches, ...remote]);
}

function conceptMatches(concept: TerminologyConcept, term: string): boolean {
  const normalizedTerm = normalize(term);
  return [concept.display, concept.code, ...concept.synonyms]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalize(value).includes(normalizedTerm) || normalizedTerm.includes(normalize(value)));
}

async function resolveRxNav(term: string, options: ResolveTermOptions): Promise<TerminologyConcept[]> {
  const url = new URL("https://rxnav.nlm.nih.gov/REST/rxcui.json");
  url.searchParams.set("name", term);

  const response = await fetchWithTimeout(url, options.timeoutMs ?? 8000);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    idGroup?: {
      name?: string;
      rxnormId?: string[];
    };
  };

  return (payload.idGroup?.rxnormId ?? []).slice(0, 5).map((code) => ({
    system: rxNormSystem,
    code,
    display: payload.idGroup?.name ?? term,
    source: "rxnav" as const,
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
