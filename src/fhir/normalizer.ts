import { FhirContext, FhirReference } from "../domain/types";
import { FhirBundle, FhirResource } from "./types";

const supportedResourceTypes = new Set([
  "Patient",
  "Condition",
  "MedicationRequest",
  "MedicationStatement",
  "Observation",
  "AllergyIntolerance",
  "Encounter",
  "Procedure",
  "CarePlan",
  "ServiceRequest"
]);

export function normalizeFhirBundle(
  bundle: FhirBundle,
  source?: FhirContext["source"]
): FhirContext {
  const resources = extractResources(bundle).filter((resource) => supportedResourceTypes.has(resource.resourceType));
  const patient = resources.find((resource) => resource.resourceType === "Patient");

  if (!patient) {
    throw new Error("FHIR Bundle does not contain a Patient resource.");
  }

  return {
    patient: normalizePatient(patient),
    source: {
      mode: source?.mode ?? "bundle",
      baseUrl: source?.baseUrl,
      patientId: source?.patientId ?? getResourceId(patient),
      resourceCount: resources.length
    },
    conditions: normalizeResources(resources, "Condition"),
    medications: normalizeResources(resources, "MedicationRequest", "MedicationStatement"),
    observations: normalizeResources(resources, "Observation"),
    allergies: normalizeResources(resources, "AllergyIntolerance"),
    encounters: normalizeResources(resources, "Encounter"),
    procedures: normalizeResources(resources, "Procedure"),
    carePlans: normalizeResources(resources, "CarePlan"),
    serviceRequests: normalizeResources(resources, "ServiceRequest")
  };
}

export function extractResources(bundle: FhirBundle): FhirResource[] {
  if (bundle.resourceType !== "Bundle") {
    throw new Error("Expected a FHIR Bundle resource.");
  }

  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirResource => Boolean(resource?.resourceType));
}

function normalizeResources(resources: FhirResource[], ...resourceTypes: string[]): FhirReference[] {
  return resources
    .filter((resource) => resourceTypes.includes(resource.resourceType))
    .map((resource) => normalizeClinicalResource(resource));
}

function normalizePatient(resource: FhirResource): FhirReference {
  return {
    resourceType: "Patient",
    id: getResourceId(resource),
    display: patientDisplay(resource),
    status: stringField(resource, "active")
  };
}

function normalizeClinicalResource(resource: FhirResource): FhirReference {
  const coding = firstCoding(resource);
  const display = firstDisplay(resource) ?? coding?.display ?? stringField(resource, "description");
  const status = statusValue(resource);
  const value = observationValue(resource);

  return {
    resourceType: resource.resourceType,
    id: getResourceId(resource),
    display,
    system: coding?.system,
    code: coding?.code,
    status,
    category: categoryDisplay(resource),
    value
  };
}

function getResourceId(resource: FhirResource): string {
  return typeof resource.id === "string" && resource.id.length > 0
    ? resource.id
    : `${resource.resourceType.toLowerCase()}-unknown`;
}

function patientDisplay(resource: FhirResource): string | undefined {
  const names = Array.isArray(resource.name) ? resource.name : [];
  const firstName = names.find((name): name is Record<string, unknown> => isRecord(name));

  if (!firstName) {
    return undefined;
  }

  const given = Array.isArray(firstName.given) ? firstName.given.filter((part) => typeof part === "string") : [];
  const family = typeof firstName.family === "string" ? firstName.family : undefined;
  const fullName = [...given, family].filter(Boolean).join(" ");

  return fullName || undefined;
}

function firstDisplay(resource: FhirResource): string | undefined {
  const directFields = ["code", "medicationCodeableConcept", "allergyCodeableConcept"];

  for (const field of directFields) {
    const display = codeableConceptDisplay(resource[field]);
    if (display) {
      return display;
    }
  }

  return undefined;
}

function firstCoding(resource: FhirResource): { system?: string; code?: string; display?: string } | undefined {
  const codeableFields = ["code", "medicationCodeableConcept", "allergyCodeableConcept"];

  for (const field of codeableFields) {
    const coding = codingFromCodeableConcept(resource[field]);
    if (coding) {
      return coding;
    }
  }

  return undefined;
}

function statusValue(resource: FhirResource): string | undefined {
  const status =
    stringField(resource, "status") ??
    codeableConceptDisplay(resource.clinicalStatus) ??
    codeableConceptDisplay(resource.verificationStatus);

  return status;
}

function observationValue(resource: FhirResource): string | number | boolean | undefined {
  const quantity = recordField(resource, "valueQuantity");
  if (quantity) {
    const value = quantity.value;
    const unit = typeof quantity.unit === "string" ? quantity.unit : stringField(quantity, "code");
    return [value, unit].filter((part) => part !== undefined).join(" ");
  }

  const valueCodeableConcept = codeableConceptDisplay(resource.valueCodeableConcept);
  if (valueCodeableConcept) {
    return valueCodeableConcept;
  }

  for (const key of ["valueString", "valueBoolean", "valueInteger"]) {
    const value = resource[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function categoryDisplay(resource: FhirResource): string | undefined {
  const category = resource.category;
  if (Array.isArray(category)) {
    return category.map((item) => codeableConceptDisplay(item)).find(Boolean);
  }

  return codeableConceptDisplay(category);
}

function codeableConceptDisplay(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  const coding = codingFromCodeableConcept(value);
  return coding?.display ?? coding?.code;
}

function codingFromCodeableConcept(value: unknown): { system?: string; code?: string; display?: string } | undefined {
  if (!isRecord(value) || !Array.isArray(value.coding)) {
    return undefined;
  }

  const coding = value.coding.find((item): item is Record<string, unknown> => isRecord(item));
  if (!coding) {
    return undefined;
  }

  return {
    system: stringField(coding, "system"),
    code: stringField(coding, "code"),
    display: stringField(coding, "display")
  };
}

function recordField(resource: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = resource[key];
  return isRecord(value) ? value : undefined;
}

function stringField(resource: Record<string, unknown>, key: string): string | undefined {
  const value = resource[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
