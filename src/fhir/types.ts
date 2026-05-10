export interface FhirBundle {
  resourceType: "Bundle";
  type?: string;
  entry?: Array<{
    fullUrl?: string;
    resource?: FhirResource;
  }>;
  link?: Array<{
    relation?: string;
    url?: string;
  }>;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface FhirClientOptions {
  baseUrl: string;
  bearerToken?: string;
  timeoutMs?: number;
}

export interface PatientListItem {
  id: string;
  display?: string;
  gender?: string;
  birthDate?: string;
}
