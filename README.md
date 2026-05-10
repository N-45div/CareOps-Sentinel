# CareOps Sentinel

CareOps Sentinel is an A2A/MCP safety auditor for healthcare agents.

Prompt Opinion lets healthcare agents assemble from the marketplace. CareOps Sentinel makes sure their outputs are safe enough to enter a clinical workflow.

It does not diagnose, prescribe, approve treatments, or automate clinical action. It reviews what other agents produce, grounds their claims in FHIR context, detects unsupported or unsafe statements, and generates a clinician-ready audit packet.

## The Problem

Healthcare AI marketplaces are filling with powerful specialist agents: medication safety agents, prior-authorization agents, discharge agents, care-gap agents, handoff agents, and patient-navigation agents.

That creates a new operational risk:

> Who checks the output of these agents before it reaches a clinician, patient, payer, or downstream workflow?

Hospitals need a governance layer that can answer:

- Which claims were supported by the selected patient's FHIR record?
- Which claims were missing evidence?
- Did the agent use unsafe action language?
- Did the output bypass clinician review?
- Did it contradict another agent or the patient context?
- What should be handed to the clinician for review?

CareOps Sentinel is that review layer.

## What It Does

CareOps Sentinel receives:

- active patient FHIR context
- an output from a healthcare agent or MCP server
- an optional workflow type such as medication safety, discharge review, prior authorization, referral review, or care-gap review

It returns:

- safety verdict
- risk score
- FHIR evidence grounding table
- missing-evidence checklist
- unsafe clinical-action language findings
- contradiction findings
- safe rewrite
- clinician-review recommendation
- FHIR Task-shaped review payload
- audit packet suitable for a human-in-the-loop workflow

## Product Position

CareOps Sentinel is not competing as another medication, prior-auth, or discharge tool.

It is the governance layer for those tools.

Any marketplace agent can produce a draft. CareOps Sentinel audits that draft before it is trusted.

## Prompt Opinion Integration

Published MCP endpoint:

```txt
https://careops-sentinel.vercel.app/mcp
```

Prompt Opinion orchestrator MCP endpoint:

```txt
https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/mcp
```

A2A agent card:

```txt
https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/.well-known/agent-card.json
```

FHIR context is supplied through Prompt Opinion's FHIR context extension or explicit test configuration. The production path does not use hidden fallback patients or hardcoded FHIR servers.

## Hospital Audit Console

The included Next.js console demonstrates the product experience outside the Prompt Opinion chat surface.

It lets a reviewer:

1. paste output from an upstream marketplace MCP server or A2A agent;
2. provide real FHIR context for the selected patient;
3. run a CareOps Sentinel audit;
4. inspect verdict, risk score, grounding, unsafe language, safe rewrite, and review task payload.

Production deployment:

```txt
https://careops-sentinel-console.vercel.app
```

Run locally:

```bash
npm install
npm run web:dev
```

Open:

```txt
http://localhost:3000
```

## MCP Server

Run the MCP server locally:

```bash
npm install
npm run build
npm start
```

Endpoint:

```txt
POST /mcp
```

Default local port:

```txt
3001
```

## Tools

CareOps Sentinel exposes these MCP tools:

- `validate_patient_agent_output`
- `validate_agent_output`
- `fetch_patient_context`
- `validate_fhir_bundle`
- `check_fhir_grounding`
- `check_context_contradictions`
- `detect_agent_contradictions`
- `rewrite_unsafe_language`
- `generate_audit_packet`
- `create_review_task_payload`
- `explain_evidence_match`
- `resolve_medication_term`
- `resolve_observation_term`
- `list_demo_patients`

## Safety Boundary

CareOps Sentinel may say:

- "Needs clinician review"
- "Evidence is missing"
- "This statement is not grounded in FHIR"
- "This language should be rewritten for safety"
- "This output conflicts with patient context"

CareOps Sentinel must not say:

- "Start this medication"
- "Diagnose the patient with X"
- "Approve this treatment"
- "Submit this authorization automatically"
- "No clinician review is needed"

## Verification

```bash
npm run typecheck
npm run test
npm run web:build
npm run build
```
