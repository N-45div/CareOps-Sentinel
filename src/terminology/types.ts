export interface TerminologyConcept {
  system: string;
  code?: string;
  display: string;
  source: "local" | "rxnav" | "clinical_tables";
  synonyms: string[];
}

export interface ResolveTermOptions {
  useNetwork?: boolean;
  timeoutMs?: number;
}
