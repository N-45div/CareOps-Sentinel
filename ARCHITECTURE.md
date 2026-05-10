# CareOps Sentinel Architecture

CareOps Sentinel is a safety and governance layer for healthcare agents running inside Prompt Opinion.

The system has two product surfaces:

- an MCP server that Prompt Opinion and agents can invoke;
- a hospital-facing audit console that demonstrates how teams can review outputs from marketplace agents.

Both surfaces use the same safety engine.

## End-To-End System

```mermaid
flowchart LR
  subgraph PO[Prompt Opinion Workspace]
    P[Selected Patient Context]
    M[Marketplace MCP Servers]
    A[Marketplace A2A Agents]
    O[CareOps Sentinel Orchestrator]
  end

  subgraph COS[CareOps Sentinel]
    MCP[xMCP Server /mcp]
    API[Next.js Review API /api/review]
    UI[Hospital Audit Console]
    ENGINE[Safety Engine]
    FHIR[FHIR Client + Bundle Normalizer]
  end

  subgraph DATA[FHIR R4 Context]
    FHIRSERVER[Prompt Opinion FHIR Proxy or Authorized FHIR Server]
    BUNDLE[Patient Bundle]
  end

  M -->|draft output| O
  A -->|draft output| O
  P -->|SHARP/FHIR headers| O
  O -->|MCP tool call| MCP
  MCP --> ENGINE
  MCP --> FHIR
  FHIR -->|Patient/$everything or compartment search| FHIRSERVER
  FHIRSERVER --> BUNDLE
  BUNDLE --> FHIR
  FHIR --> ENGINE
  ENGINE -->|verdict + audit packet + review task| O

  M -. paste output .-> UI
  A -. paste output .-> UI
  UI --> API
  API --> FHIR
  API --> ENGINE
  ENGINE --> UI
```

## Core Product Flow

```mermaid
sequenceDiagram
  participant Upstream as Upstream Healthcare Agent
  participant Prompt as Prompt Opinion
  participant Sentinel as CareOps Sentinel MCP
  participant FHIR as FHIR R4 Server
  participant Engine as Safety Engine
  participant Clinician as Clinician Review

  Upstream->>Prompt: Draft clinical output
  Prompt->>Sentinel: validate_patient_agent_output + FHIR context headers
  Sentinel->>FHIR: Fetch selected patient context
  FHIR-->>Sentinel: FHIR Bundle
  Sentinel->>Engine: Normalize bundle + validate agent output
  Engine-->>Sentinel: Verdict, risk score, evidence, rewrite, task payload
  Sentinel-->>Prompt: Structured audit packet
  Prompt-->>Clinician: Human-review handoff
```

## Deployment Topology

```mermaid
flowchart TB
  subgraph Vercel[Vercel Deployment]
    HTTP[dist/http.js]
    NEXT[Next.js App]
  end

  subgraph Runtime[Runtime Entrypoints]
    MCPPOST[POST /mcp]
    WEBROOT[GET /]
    REVIEW[POST /api/review]
  end

  subgraph Code[Shared TypeScript Core]
    TOOLS[src/tools/*]
    DOMAIN[src/domain/*]
    FHIRC[src/fhir/*]
    TERMS[src/terminology/*]
  end

  HTTP --> MCPPOST
  NEXT --> WEBROOT
  NEXT --> REVIEW
  MCPPOST --> TOOLS
  REVIEW --> DOMAIN
  REVIEW --> FHIRC
  TOOLS --> DOMAIN
  TOOLS --> FHIRC
  DOMAIN --> TERMS
```

## Runtime Components

### Prompt Opinion Orchestrator

The orchestrator is configured inside Prompt Opinion as the A2A-facing agent. It receives user requests, can be called by other agents, and delegates safety work to the CareOps Sentinel MCP tools.

Relevant endpoints:

```txt
https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/mcp
https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/.well-known/agent-card.json
```

### CareOps Sentinel MCP Server

The MCP server is built with `xmcp`. Each tool is a file under `src/tools`.

Primary tool:

```txt
validate_patient_agent_output
```

This tool is the preferred Prompt Opinion path because it receives FHIR context through SHARP-style headers and validates the upstream agent output against the selected patient.

### Hospital Audit Console

The Next.js console is a product demonstration surface. It does not replace Prompt Opinion.

It shows the hospital workflow:

1. choose the upstream marketplace source;
2. paste the output to audit;
3. provide real FHIR context;
4. run a Sentinel audit;
5. inspect evidence, unsafe language, safe rewrite, and review task payload.

The console intentionally fails closed when FHIR context is missing or invalid.

### Safety Engine

The safety engine is deterministic TypeScript under `src/domain`.

Responsibilities:

- split and evaluate agent claims;
- ground claims against normalized FHIR references;
- detect unsafe clinical-action language;
- detect contradictions between agent outputs;
- detect contradictions against patient context;
- generate missing-evidence checklists;
- produce a safe rewrite;
- produce a human-review recommendation;
- produce a FHIR Task-shaped review payload.

## FHIR Context Flow

```mermaid
flowchart TD
  H[Prompt Opinion FHIR Headers] --> R[resolveFhirConnection]
  I[Explicit Local Test Input] --> R
  ENV[FHIR_BASE_URL / FHIR_BEARER_TOKEN] --> R
  R --> C[FHIR Client]
  C --> E1[Patient/id/$everything]
  E1 -->|success| N[normalizeFhirBundle]
  E1 -->|unsupported| E2[Patient compartment searches]
  E2 --> N
  N --> REF[CareOps FHIR References]
  REF --> S[Safety Engine]
```

Header precedence:

1. Prompt Opinion FHIR headers
2. explicit tool/API input
3. environment variables for local controlled testing

There is no hidden production FHIR fallback.

## Validation Model

```mermaid
flowchart LR
  OUT[Agent Output] --> CLAIMS[Claim Extraction]
  CLAIMS --> GROUND[FHIR Grounding]
  CLAIMS --> UNSAFE[Unsafe Language Detection]
  CLAIMS --> CONTRA[Contradiction Detection]
  GROUND --> SCORE[Risk Score]
  UNSAFE --> SCORE
  CONTRA --> SCORE
  SCORE --> VERDICT[Safety Verdict]
  VERDICT --> PACKET[Audit Packet]
  PACKET --> TASK[FHIR Task-shaped Review Payload]
```

Verdicts:

- `pass_with_review`
- `needs_revision`
- `blocked`

The system is conservative by design. Unsupported direct clinical action should be blocked or sent to clinician review.

## MCP Tool Surface

| Tool | Purpose |
| --- | --- |
| `validate_patient_agent_output` | Fetch selected patient FHIR context and audit an upstream output |
| `validate_agent_output` | Audit an output against supplied FHIR context |
| `fetch_patient_context` | Fetch and normalize selected patient context |
| `validate_fhir_bundle` | Validate a supplied FHIR Bundle shape |
| `check_fhir_grounding` | Check claims against FHIR references |
| `check_context_contradictions` | Detect contradictions against patient context |
| `detect_agent_contradictions` | Detect contradictions between agents |
| `rewrite_unsafe_language` | Rewrite unsafe action language into review-safe wording |
| `generate_audit_packet` | Create structured audit output |
| `create_review_task_payload` | Create FHIR Task-shaped human-review payload |
| `explain_evidence_match` | Explain why a claim matched or failed to match evidence |
| `resolve_medication_term` | Resolve medication synonyms for matching |
| `resolve_observation_term` | Resolve observation synonyms for matching |
| `list_demo_patients` | Controlled patient listing for sandbox testing only |

## Data Boundary

CareOps Sentinel is built for synthetic or de-identified FHIR R4 data in this hackathon.

The server should not store PHI. FHIR data is fetched for the active request, normalized into evidence references, and used to produce an audit packet.

## Safety Boundary

Allowed outputs:

- clinician-review recommendation
- missing-evidence finding
- FHIR grounding explanation
- contradiction finding
- safe rewrite
- review task payload

Disallowed outputs:

- diagnosis
- medication order
- treatment approval
- automatic prior-auth submission
- any instruction that bypasses clinician review

## Why This Architecture Fits The Hackathon

The hackathon is about MCP, A2A, and FHIR interoperability.

CareOps Sentinel uses all three:

- MCP exposes reusable safety tools;
- A2A lets the orchestrator be called by other agents;
- FHIR context grounds the audit in selected patient data.

The product thesis is simple:

> As the healthcare-agent marketplace grows, hospitals need an agent that audits agents.
