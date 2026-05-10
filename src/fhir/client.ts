import { FhirBundle, FhirClientOptions, FhirResource, PatientListItem } from "./types";

export class FhirClient {
  private readonly baseUrl: string;
  private readonly bearerToken?: string;
  private readonly timeoutMs: number;

  constructor(options?: Partial<FhirClientOptions>) {
    const baseUrl = options?.baseUrl ?? process.env.FHIR_BASE_URL;

    if (!baseUrl) {
      throw new Error("Missing FHIR base URL. Provide fhirBaseUrl, FHIR_BASE_URL, or Prompt Opinion SHARP FHIR context.");
    }

    this.baseUrl = trimTrailingSlash(baseUrl);
    this.bearerToken = options?.bearerToken ?? process.env.FHIR_BEARER_TOKEN;
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  async capabilityStatement(): Promise<FhirResource> {
    return this.fetchJson("metadata");
  }

  async listPatients(count = 10): Promise<PatientListItem[]> {
    const bundle = await this.fetchJson<FhirBundle>(`Patient?_count=${encodeURIComponent(String(count))}`);

    return (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is FhirResource => resource?.resourceType === "Patient" && typeof resource.id === "string")
      .map((patient) => ({
        id: patient.id ?? "",
        display: patientDisplay(patient),
        gender: stringField(patient, "gender"),
        birthDate: stringField(patient, "birthDate")
      }));
  }

  async fetchPatientContext(patientId: string): Promise<FhirBundle> {
    const normalizedPatientId = normalizePatientId(patientId);

    try {
      return await this.fetchJson<FhirBundle>(`Patient/${encodeURIComponent(normalizedPatientId)}/$everything`);
    } catch (error) {
      return this.fetchPatientCompartment(normalizedPatientId, error);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchPatientCompartment(patientId: string, everythingError: unknown): Promise<FhirBundle> {
    const patient = await this.fetchJson<FhirResource>(`Patient/${encodeURIComponent(patientId)}`);
    const searchTypes = [
      "Condition",
      "MedicationRequest",
      "MedicationStatement",
      "Observation",
      "AllergyIntolerance",
      "Encounter",
      "Procedure",
      "CarePlan",
      "ServiceRequest"
    ];
    const entries: NonNullable<FhirBundle["entry"]> = [{ resource: patient }];

    for (const resourceType of searchTypes) {
      const bundle = await this.fetchJson<FhirBundle>(
        `${resourceType}?patient=${encodeURIComponent(patientId)}&_count=50`
      ).catch(() => undefined);

      for (const entry of bundle?.entry ?? []) {
        if (entry.resource) {
          entries.push({ resource: entry.resource });
        }
      }
    }

    if (entries.length === 1) {
      const message = everythingError instanceof Error ? everythingError.message : "Patient/$everything failed";
      throw new Error(`Unable to fetch patient compartment after $everything failure: ${message}`);
    }

    return {
      resourceType: "Bundle",
      type: "searchset",
      entry: entries
    };
  }

  private async fetchJson<T = FhirResource>(path: string): Promise<T> {
    const response = await fetchWithTimeout(joinUrl(this.baseUrl, path), {
      headers: {
        accept: "application/fhir+json, application/json",
        ...(this.bearerToken ? { authorization: `Bearer ${this.bearerToken}` } : {})
      },
      timeoutMs: this.timeoutMs
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`.trim());
    }

    const body = await response.text();

    try {
      return JSON.parse(body) as T;
    } catch {
      const contentType = response.headers.get("content-type") ?? "unknown content type";
      throw new Error(
        `FHIR server returned non-JSON content (${contentType}). Check that the FHIR base URL, patient ID, and access token came from the same Prompt Opinion FHIR Context modal.`
      );
    }
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const { timeoutMs: _timeoutMs, ...requestOptions } = options;

  try {
    return await fetch(url, {
      ...requestOptions,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${baseUrl}/${path.replace(/^\/+/, "")}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizePatientId(patientId: string): string {
  return patientId.trim().replace(/^Patient\//i, "");
}

function patientDisplay(patient: FhirResource): string | undefined {
  const names = Array.isArray(patient.name) ? patient.name : [];
  const firstName = names.find((name): name is Record<string, unknown> => isRecord(name));

  if (!firstName) {
    return undefined;
  }

  const given = Array.isArray(firstName.given) ? firstName.given.filter((part) => typeof part === "string") : [];
  const family = typeof firstName.family === "string" ? firstName.family : undefined;
  return [...given, family].filter(Boolean).join(" ") || undefined;
}

function stringField(resource: Record<string, unknown>, key: string): string | undefined {
  const value = resource[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
