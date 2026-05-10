"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  Database,
  FileCheck2,
  Loader2,
  Network,
  Play,
  ShieldCheck,
  Stethoscope,
  UserCheck
} from "lucide-react";

const sentinelMcpUrl = "https://careops-sentinel.vercel.app/mcp";
const orchestratorMcpUrl =
  "https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/mcp";
const a2aAgentCardUrl =
  "https://app.promptopinion.ai/api/workspaces/019de1fa-ebc5-7e5e-b6ea-abe36ed0ad33/ai-agents/019e0dd0-f471-7e72-bf83-a476c244ac42/.well-known/agent-card.json";

type EvidenceFinding = {
  claim: string;
  status: "grounded" | "missing_evidence" | "conflicts_with_fhir";
  rationale: string;
  confidence?: "high" | "medium" | "low";
  matchType?: string;
};

type ReviewResponse = {
  result: {
    verdict: "pass_with_review" | "needs_revision" | "blocked";
    riskScore: number;
    auditPacket: {
      summary: string;
      evidenceGrounding: EvidenceFinding[];
      contradictions: Array<{ topic: string; rationale: string; firstAgent: string; secondAgent: string }>;
      unsafeLanguage: Array<{ phrase: string; severity: "medium" | "high"; rationale: string; saferAlternative: string }>;
      missingEvidenceChecklist: string[];
      safeRewrite: string;
      humanReviewRecommendation: string;
    };
    reviewTask: Record<string, unknown>;
  };
  patient: {
    id: string;
    display?: string;
  };
  source?: {
    baseUrl?: string;
    patientId?: string;
    resourceCount: number;
  };
};

const marketplaceSources = [
  "Any Prompt Opinion marketplace MCP output",
  "Any Prompt Opinion marketplace A2A agent output",
  "CareOps Sentinel Orchestrator",
  "Medication safety agent",
  "Prior authorization agent",
  "Clinical handoff agent",
  "Care gap agent"
];

export default function Page() {
  const [fhirBaseUrl, setFhirBaseUrl] = useState("");
  const [patientId, setPatientId] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [agentName, setAgentName] = useState(marketplaceSources[0]);
  const [draftOutput, setDraftOutput] = useState("");
  const [workflowType, setWorkflowType] = useState("medication_safety_review");
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const verdictLabel = useMemo(() => {
    if (!review) {
      return "Waiting";
    }

    return review.result.verdict.replaceAll("_", " ");
  }, [review]);

  async function runReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setError("");
    setReview(null);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fhirBaseUrl,
          patientId,
          bearerToken,
          workflowType,
          agentName,
          draftOutput
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Review failed");
      }

      setReview(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main>
      <header className="appHeader">
        <div className="brandBlock">
          <div className="brandMark">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">CareOps Sentinel</p>
            <h1>Marketplace Agent Audit Console</h1>
          </div>
        </div>
        <div className="headerActions" aria-label="Platform status">
          <a className="statusPill" href={sentinelMcpUrl} target="_blank" rel="noreferrer">
            <BadgeCheck size={16} aria-hidden="true" />
            Sentinel MCP
          </a>
          <a className="statusPill secondary" href={orchestratorMcpUrl} target="_blank" rel="noreferrer">
            <Network size={16} aria-hidden="true" />
            Orchestrator MCP
          </a>
          <a className="statusPill secondary" href={a2aAgentCardUrl} target="_blank" rel="noreferrer">
            <Database size={16} aria-hidden="true" />
            A2A card
          </a>
        </div>
      </header>

      <section className="missionBand">
        <div>
          <p className="sectionKicker">Hospital AI governance workflow</p>
          <h2>Audit outputs from any marketplace MCP server or A2A agent.</h2>
          <p>
            The marketplace gives hospitals many specialized healthcare agents. This console shows the missing
            governance layer: paste the output from any upstream agent, bind it to real FHIR patient context, and run
            CareOps Sentinel before that output reaches a clinical workflow.
          </p>
        </div>
        <div className="missionStats" aria-label="CareOps capabilities">
          <Metric value="FHIR" label="required context" />
          <Metric value="A2A" label="agent output intake" />
          <Metric value={review ? String(review.result.riskScore) : "--"} label="latest risk score" tone="danger" />
        </div>
      </section>

      <section className="consoleGrid">
        <form className="panel auditForm" onSubmit={runReview}>
          <div className="panelTitle">
            <Stethoscope size={18} aria-hidden="true" />
            <h3>Run Sentinel Review</h3>
          </div>

          <label>
            Upstream marketplace source
            <select value={agentName} onChange={(event) => setAgentName(event.target.value)}>
              {marketplaceSources.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>

          <label>
            Workflow type
            <select value={workflowType} onChange={(event) => setWorkflowType(event.target.value)}>
              <option value="medication_safety_review">Medication safety review</option>
              <option value="discharge_review">Discharge review</option>
              <option value="prior_authorization_packet_review">Prior authorization packet review</option>
              <option value="care_gap_review">Care gap review</option>
              <option value="referral_review">Referral review</option>
            </select>
          </label>

          <div className="fieldGrid">
            <label>
              FHIR base URL
              <input
                required
                value={fhirBaseUrl}
                onChange={(event) => setFhirBaseUrl(event.target.value)}
                placeholder="https://app.promptopinion.ai/api/workspaces/.../fhir"
              />
            </label>
            <label>
              Patient ID
              <input
                required
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                placeholder="Patient/... or raw patient id"
              />
            </label>
          </div>

          <label>
            FHIR access token, if required
            <input
              value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)}
              placeholder="Paste token from Prompt Opinion FHIR Context only when testing locally"
              type="password"
            />
          </label>

          <label>
            Agent or MCP output to audit
            <textarea
              required
              rows={9}
              value={draftOutput}
              onChange={(event) => setDraftOutput(event.target.value)}
              placeholder="Paste a draft from any marketplace MCP server or A2A agent. Example: a medication safety note, prior-auth letter, discharge handoff, or care-gap recommendation."
            />
          </label>

          {error && (
            <div className="formError">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button className="primaryButton" disabled={isRunning} type="submit">
            {isRunning ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
            Run audit
          </button>
        </form>

        <section className="workspace">
          <section className="reviewHeader">
            <div>
              <p className="sectionKicker">Live Sentinel result</p>
              <h2>{review ? review.result.auditPacket.summary : "No review run yet"}</h2>
              <p className="muted">
                {review
                  ? `${review.patient.display ?? review.patient.id} | ${review.source?.resourceCount ?? 0} FHIR resources reviewed`
                  : "Enter real FHIR context and an upstream agent output to generate an audit packet."}
              </p>
            </div>
            <div className={review?.result.verdict === "blocked" ? "verdictBox" : "verdictBox neutral"}>
              <span>Verdict</span>
              <strong>{verdictLabel}</strong>
            </div>
          </section>

          <section className="reviewGrid">
            <article className="panel">
              <div className="panelTitle">
                <FileCheck2 size={18} aria-hidden="true" />
                <h3>FHIR Grounding</h3>
              </div>
              <ResultList
                empty="FHIR grounding findings will appear after a review."
                items={review?.result.auditPacket.evidenceGrounding.map((finding) => ({
                  title: finding.claim,
                  detail: `${finding.status.replaceAll("_", " ")} | ${finding.rationale}`
                }))}
              />
            </article>

            <article className="panel">
              <div className="panelTitle">
                <AlertTriangle size={18} aria-hidden="true" />
                <h3>Unsafe Language</h3>
              </div>
              <ResultList
                empty="Unsafe action language will appear after a review."
                items={review?.result.auditPacket.unsafeLanguage.map((finding) => ({
                  title: `${finding.phrase} (${finding.severity})`,
                  detail: `${finding.rationale} Safer: ${finding.saferAlternative}`
                }))}
              />
            </article>
          </section>

          <section className="bottomGrid">
            <article className="panel">
              <div className="panelTitle">
                <UserCheck size={18} aria-hidden="true" />
                <h3>Clinician Review Recommendation</h3>
              </div>
              <p className="largeText">
                {review?.result.auditPacket.humanReviewRecommendation ??
                  "CareOps will generate a human-review recommendation from the actual audit result."}
              </p>
            </article>

            <article className="panel">
              <div className="panelTitle">
                <ClipboardCheck size={18} aria-hidden="true" />
                <h3>Safe Rewrite</h3>
              </div>
              <p className="largeText">
                {review?.result.auditPacket.safeRewrite ??
                  "Safe rewrite appears here after Sentinel validates the upstream output."}
              </p>
            </article>
          </section>

          <section className="panel">
            <div className="panelTitle rowBetween">
              <div>
                <p className="sectionKicker">Review task payload</p>
                <h3>FHIR-shaped audit handoff</h3>
              </div>
              <span className="riskBadge">Risk {review ? review.result.riskScore : "--"}</span>
            </div>
            <pre className="jsonBlock">
              {review ? JSON.stringify(review.result.reviewTask, null, 2) : "Run a review to generate a FHIR Task-shaped payload."}
            </pre>
          </section>
        </section>

        <aside className="rightColumn">
          <section className="panel compact">
            <p className="sectionKicker">How this competes</p>
            <div className="agentList">
              <div className="agentItem">
                <strong>Marketplace agents create output</strong>
                <span>Medication, discharge, prior-auth, handoff, care-gap, and trial agents can all be audited.</span>
                <em>input</em>
              </div>
              <div className="agentItem">
                <strong>CareOps Sentinel reviews output</strong>
                <span>Grounds claims in FHIR, detects missing evidence, unsafe language, and contradiction risk.</span>
                <em>governance</em>
              </div>
              <div className="agentItem">
                <strong>Clinician gets a packet</strong>
                <span>Verdict, risk score, safe rewrite, missing-evidence checklist, and review task.</span>
                <em>handoff</em>
              </div>
            </div>
          </section>

          <section className="panel compact">
            <p className="sectionKicker">Platform Integration</p>
            <div className="integrationList">
              <div>
                <strong>CareOps MCP</strong>
                <a href={sentinelMcpUrl} target="_blank" rel="noreferrer">
                  {sentinelMcpUrl}
                </a>
              </div>
              <div>
                <strong>Orchestrator MCP</strong>
                <a href={orchestratorMcpUrl} target="_blank" rel="noreferrer">
                  Prompt Opinion endpoint
                </a>
              </div>
              <div>
                <strong>A2A agent card</strong>
                <a href={a2aAgentCardUrl} target="_blank" rel="noreferrer">
                  Open agent-card.json
                </a>
              </div>
            </div>
          </section>

          <section className="panel compact">
            <p className="sectionKicker">Safety boundary</p>
            <p className="largeText small">
              The console audits upstream output only. It does not diagnose, prescribe, approve treatment, submit prior
              authorizations, or bypass clinician review.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: "danger" }) {
  return (
    <div className={tone === "danger" ? "metric dangerMetric" : "metric"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ResultList({ empty, items }: { empty: string; items?: Array<{ title: string; detail: string }> }) {
  if (!items?.length) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <div className="resultList">
      {items.map((item) => (
        <div className="resultItem" key={`${item.title}-${item.detail}`}>
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
      ))}
    </div>
  );
}
