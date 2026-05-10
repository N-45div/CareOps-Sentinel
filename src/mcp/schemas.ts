import { z } from "zod/v4";

export const clinicalWorkflowSchema = z.enum([
  "discharge_review",
  "prior_authorization_packet_review",
  "medication_safety_review",
  "care_gap_review",
  "referral_review"
]);

export const fhirReferenceSchema = z.object({
  resourceType: z.string(),
  id: z.string(),
  display: z.string().optional(),
  system: z.string().optional(),
  code: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const fhirContextSchema = z.object({
  patient: fhirReferenceSchema,
  source: z
    .object({
      mode: z.enum(["bundle", "fhir_server"]),
      baseUrl: z.string().url().optional(),
      patientId: z.string().optional(),
      resourceCount: z.number().int().nonnegative()
    })
    .optional(),
  conditions: z.array(fhirReferenceSchema).optional(),
  medications: z.array(fhirReferenceSchema).optional(),
  observations: z.array(fhirReferenceSchema).optional(),
  allergies: z.array(fhirReferenceSchema).optional(),
  encounters: z.array(fhirReferenceSchema).optional(),
  procedures: z.array(fhirReferenceSchema).optional(),
  carePlans: z.array(fhirReferenceSchema).optional(),
  serviceRequests: z.array(fhirReferenceSchema).optional()
});

export const agentOutputSchema = z.object({
  agentName: z.string(),
  role: z.string().optional(),
  output: z.string(),
  claims: z.array(z.string()).optional()
});

export const validationInputSchema = z.object({
  workflowType: clinicalWorkflowSchema.optional(),
  fhirContext: fhirContextSchema,
  agentOutputs: z.array(agentOutputSchema).min(1)
});

export const contradictionInputSchema = z.object({
  agentOutputs: z.array(agentOutputSchema).min(2)
});

export const groundingInputSchema = z.object({
  fhirContext: fhirContextSchema,
  agentOutputs: z.array(agentOutputSchema).min(1)
});

export const rewriteInputSchema = z.object({
  agentOutputs: z.array(agentOutputSchema).min(1)
});

export const fhirBaseUrlSchema = z.string().url();

export const listPatientsInputSchema = z.object({
  fhirBaseUrl: fhirBaseUrlSchema.optional(),
  count: z.number().int().min(1).max(50).default(10)
});

export const fetchPatientContextInputSchema = z.object({
  fhirBaseUrl: fhirBaseUrlSchema.optional(),
  patientId: z.string().min(1).optional()
});

export const fhirBundleSchema = z
  .object({
    resourceType: z.literal("Bundle"),
    type: z.string().optional(),
    entry: z
    .array(
      z
        .object({
          fullUrl: z.string().optional(),
          resource: z
            .object({
              resourceType: z.string()
            })
            .passthrough()
            .optional()
        })
        .passthrough()
    )
      .optional()
  })
  .passthrough();

export const validateFhirBundleInputSchema = z.object({
  bundle: fhirBundleSchema
});

export const validatePatientAgentOutputInputSchema = z.object({
  fhirBaseUrl: fhirBaseUrlSchema.optional(),
  patientId: z.string().min(1).optional(),
  workflowType: clinicalWorkflowSchema.optional(),
  agentOutputs: z.array(agentOutputSchema).min(1)
});

export const resolveTerminologyInputSchema = z.object({
  term: z.string().min(1),
  useNetwork: z.boolean().default(false)
});

export const contextContradictionsInputSchema = z.object({
  fhirContext: fhirContextSchema,
  agentOutputs: z.array(agentOutputSchema).min(1)
});

export const explainEvidenceMatchInputSchema = z.object({
  fhirContext: fhirContextSchema,
  claim: z.string().min(1)
});
