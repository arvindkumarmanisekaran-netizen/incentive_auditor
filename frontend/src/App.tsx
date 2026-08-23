import { useCallback, useEffect, useRef, useState } from "react";

import { runInvestigationStream, type WorkflowEvent } from "./api/investigation";

import { getRepresentatives } from "./api/masterData";

import type { Representative } from "./api/masterData";

import type { InvestigationResult } from "./types/investigation";

import InvestigationForm from "./components/InvestigationForm";

import RiskSummary from "./components/RiskSummary";

import FindingsList from "./components/FindingsList";

import InvestigationInsights from "./components/InvestigationInsights";

import InvestigationCharts from "./components/InvestigationCharts";

import DocumentProcessingCard from "./components/DocumentProcessingCard";

import DatabaseManagementCard from "./components/DatabaseManagementCard";

import AIChatAssistant from "./components/AIChatAssistant";

import InvestigationWorkflow from "./components/InvestigationWorkflow";

import InvestigationOverview from "./components/InvestigationOverview";
import type { WorkflowAgent } from "./types/workflow";

import "./styles/index.css";

type DashboardTab = "analysis" | "database";

/**
 * Creates a fresh workflow whenever a new
 * investigation starts.
 */
function createInitialWorkflowAgents(): WorkflowAgent[] {
  return [
    {
      id: "investigation_planner",
      title: "Investigation Planner",
      status: "waiting",
      commentary: [],
    },

    {
      id: "sales_rx",
      title: "Sales / Rx",
      status: "waiting",
      commentary: [],
    },

    {
      id: "doctor_territory",
      title: "Doctor / Territory",
      status: "waiting",
      commentary: [],
    },

    {
      id: "payout",
      title: "Payout",
      status: "waiting",
      commentary: [],
    },

    {
      id: "risk_synthesizer",
      title: "Risk Synthesizer",
      status: "waiting",
      commentary: [],
    },

    {
      id: "investigation_summary",
      title: "Investigation Summary",
      status: "waiting",
      commentary: [],
    },
  ];
}

function App() {
  // ==================================================
  // DASHBOARD TAB
  // ==================================================

  const [activeTab, setActiveTab] = useState<DashboardTab>("analysis");

  // ==================================================
  // FILTERS
  // ==================================================

  const [representativeId, setRepresentativeId] = useState("");

  const [startDate, setStartDate] = useState("2026-07-01");

  const [endDate, setEndDate] = useState("2026-07-31");

  // ==================================================
  // MASTER DATA
  // ==================================================

  const [representatives, setRepresentatives] = useState<Representative[]>([]);

  // ==================================================
  // INVESTIGATION STATE
  // ==================================================

  const [result, setResult] = useState<InvestigationResult | null>(null);

  const [loading, setLoading] = useState(false);

  const [masterDataLoading, setMasterDataLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [showDocumentProcessing, setShowDocumentProcessing] = useState(false);

  const [pendingChatRun, setPendingChatRun] = useState(false);

  // ==================================================
  // LIVE WORKFLOW STATE
  // ==================================================

  const [workflowVisible, setWorkflowVisible] = useState(false);

  const [workflowAgents, setWorkflowAgents] = useState<WorkflowAgent[]>(
    createInitialWorkflowAgents,
  );

  const [workflowStatusMessage, setWorkflowStatusMessage] = useState("");

  // ==================================================
  // CHAT INVESTIGATION PROMISE
  // ==================================================

  const chatInvestigationResolveRef = useRef<((result: InvestigationResult) => void) | null>(null);

  const chatInvestigationRejectRef = useRef<((error: Error) => void) | null>(null);

  // ==================================================
  // LOAD MASTER DATA
  // ==================================================

  async function loadRepresentatives(preferredId?: string) {
    setMasterDataLoading(true);

    const currentId = preferredId ?? representativeId;

    setError(null);

    try {
      const representativeData = await getRepresentatives();

      setRepresentatives(representativeData);

      if (representativeData.length > 0) {
        const stillExists = representativeData.some((rep) => rep.representative_id === currentId);

        if (!stillExists) {
          setRepresentativeId(representativeData[0].representative_id);
        }
      } else {
        setRepresentativeId("");
      }
    } catch (err) {
      console.error("Representative loading failed:", err);

      setError(err instanceof Error ? err.message : "Failed to load representatives");
    } finally {
      setMasterDataLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "analysis") {
      void loadRepresentatives();
    }
  }, [activeTab]);

  // ==================================================
  // LIVE WORKFLOW EVENT HANDLER
  // ==================================================

  const handleWorkflowEvent = useCallback((event: WorkflowEvent) => {
    // ------------------------------------------
    // Overall investigation status
    // ------------------------------------------

    if (event.type === "investigation_status") {
      setWorkflowStatusMessage(event.message ?? "");

      return;
    }

    // Agent-specific events must contain
    // an agent identifier.
    if (!("agent" in event)) {
      return;
    }

    setWorkflowAgents((currentAgents) =>
      currentAgents.map((agent) => {
        if (agent.id !== event.agent) {
          return agent;
        }

        // ----------------------------------
        // AGENT STATUS
        // ----------------------------------

        if (event.type === "agent_status") {
          return {
            ...agent,
            status: event.status,
          };
        }

        // ----------------------------------
        // LIVE COMMENTARY
        // ----------------------------------

        if (event.type === "commentary") {
          return {
            ...agent,

            commentary: [
              ...agent.commentary,

              {
                message: event.message,

                timestamp: event.timestamp,
              },
            ],
          };
        }

        // ----------------------------------
        // STRUCTURED AGENT RESULT
        // ----------------------------------

        if (event.type === "agent_result") {
          return {
            ...agent,

            output: event.output,
          };
        }

        return agent;
      }),
    );
  }, []);

  // ==================================================
  // RUN INVESTIGATION
  // ==================================================

  const handleInvestigation = useCallback(async (): Promise<InvestigationResult> => {
    if (!representativeId || !startDate || !endDate) {
      const validationError = new Error("Please select representative and date range.");

      setError(validationError.message);

      chatInvestigationRejectRef.current?.(validationError);

      chatInvestigationResolveRef.current = null;

      chatInvestigationRejectRef.current = null;

      throw validationError;
    }

    // ------------------------------------------
    // RESET INVESTIGATION
    // ------------------------------------------

    setLoading(true);

    setError(null);

    setResult(null);

    // ------------------------------------------
    // RESET AND SHOW LIVE WORKFLOW
    // ------------------------------------------

    setWorkflowVisible(true);

    setWorkflowAgents(createInitialWorkflowAgents());

    setWorkflowStatusMessage("Starting investigation...");

    try {
      // ----------------------------------------
      // STREAM INVESTIGATION
      // ----------------------------------------

      const data = await runInvestigationStream(
        representativeId,
        startDate,
        endDate,
        handleWorkflowEvent,
      );

      // ----------------------------------------
      // BUILD FINAL RESULT
      // ----------------------------------------

      const investigationResult: InvestigationResult = {
        representative_id: data.representative_id,

        start_date: data.start_date,

        end_date: data.end_date,

        products_analyzed: data.products_analyzed ?? [],

        findings: data.findings ?? [],

        overall_risk_score: data.overall_risk_score ?? 0,

        overall_severity: data.overall_severity ?? "UNKNOWN",

        investigation_plan: data.investigation_plan,

        sales_rx_analysis: data.sales_rx_analysis,

        doctor_territory_analysis: data.doctor_territory_analysis,

        payout_analysis: data.payout_analysis,

        final_report: data.final_report,

        investigation_summary: data.investigation_summary,
      };

      // ----------------------------------------
      // SHOW FINAL DASHBOARD
      // ----------------------------------------

      setResult(investigationResult);

      setWorkflowStatusMessage("Investigation completed.");

      // ----------------------------------------
      // RESOLVE CHATBOT REQUEST
      // ----------------------------------------

      chatInvestigationResolveRef.current?.(investigationResult);

      chatInvestigationResolveRef.current = null;

      chatInvestigationRejectRef.current = null;

      return investigationResult;
    } catch (err) {
      console.error("Investigation failed:", err);

      const investigationError =
        err instanceof Error ? err : new Error("Unable to run investigation");

      setError(investigationError.message);

      setWorkflowStatusMessage("Investigation failed.");

      chatInvestigationRejectRef.current?.(investigationError);

      chatInvestigationResolveRef.current = null;

      chatInvestigationRejectRef.current = null;

      throw investigationError;
    } finally {
      setLoading(false);
    }
  }, [representativeId, startDate, endDate, handleWorkflowEvent]);

  // ==================================================
  // RUN CHAT-TRIGGERED INVESTIGATION
  // ==================================================

  useEffect(() => {
    if (!pendingChatRun || !representativeId || !startDate || !endDate) {
      return;
    }

    setPendingChatRun(false);

    void handleInvestigation();
  }, [pendingChatRun, representativeId, startDate, endDate, handleInvestigation]);

  // ==================================================
  // FINDINGS SAFE ACCESS
  // ==================================================

  const findings = result?.findings ?? [];

  // ==================================================
  // FIND INDIVIDUAL FINDINGS
  // ==================================================

  const salesFinding = findings.find((finding) => finding.type === "sales_deviation");

  const mismatchFinding = findings.find(
    (finding) => finding.type === "sales_prescription_mismatch",
  );

  const payoutFinding = findings.find((finding) => finding.type === "payout_discrepancy");

  // ==================================================
  // SALES CHANGE
  // ==================================================

  const salesChange = salesFinding
    ? Number(
        salesFinding.evidence?.deviation_percent ??
          salesFinding.evidence?.sales_change_percent ??
          salesFinding.evidence?.percentage_deviation ??
          0,
      )
    : null;

  // ==================================================
  // PRESCRIPTION CHANGE
  // ==================================================

  const rxChange = mismatchFinding
    ? Number(
        mismatchFinding.evidence?.prescription_change_percent ??
          mismatchFinding.evidence?.rx_change_percent ??
          mismatchFinding.evidence?.prescription_deviation_percent ??
          0,
      )
    : null;

  // ==================================================
  // PAYOUT DIFFERENCE
  // ==================================================

  const payoutDifference = payoutFinding
    ? Number(payoutFinding.evidence?.payout_difference ?? 0)
    : null;

  // ==================================================
  // RISK FINDING COUNT
  // ==================================================

  const riskFindingCount = findings.filter((finding) => {
    const severity = finding.severity?.toUpperCase() ?? "UNKNOWN";

    return severity !== "NORMAL" && severity !== "UNKNOWN";
  }).length;

  // ==================================================
  // UI
  // ==================================================

  return (
    <main className="dashboard">
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="dashboard-header">
        <h1>Incentive Auditor</h1>

        <p>
          Review incentive anomalies, supporting evidence and AI-assisted investigation insights.
        </p>
      </header>

      {/* ==================================================
          TOP NAVIGATION
      ================================================== */}

      <nav className="dashboard-tabs">
        <button
          type="button"
          className={activeTab === "analysis" ? "dashboard-tab active" : "dashboard-tab"}
          onClick={() => {
            setActiveTab("analysis");
          }}
        >
          Analysis
        </button>

        <button
          type="button"
          className={activeTab === "database" ? "dashboard-tab active" : "dashboard-tab"}
          onClick={() => setActiveTab("database")}
        >
          Database Management
        </button>
      </nav>

      {/* ==================================================
          ANALYSIS TAB
      ================================================== */}

      {activeTab === "analysis" && (
        <section className="dashboard-tab-content">
          {masterDataLoading ? (
            <div className="loading-message">Loading representatives...</div>
          ) : (
            <InvestigationForm
              representativeId={representativeId}
              startDate={startDate}
              endDate={endDate}
              loading={loading}
              representatives={representatives}
              onRepresentativeChange={setRepresentativeId}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onSubmit={handleInvestigation}
            />
          )}

          {/* ----------------------------------------------
              ERROR
          ---------------------------------------------- */}

          {error && <div className="error-message">{error}</div>}

          {/* ==================================================
              LIVE INVESTIGATION WORKFLOW

              IMPORTANT:
              This is intentionally OUTSIDE result &&
              so it appears while the stream is running.
          ================================================== */}

          {workflowVisible && (
            <InvestigationWorkflow
              agents={workflowAgents}
              loading={loading}
              statusMessage={workflowStatusMessage}
            />
          )}

          {/* ==================================================
              FINAL INVESTIGATION RESULTS
          ================================================== */}

          {result && (
            <>
              {/* ------------------------------------------
                  RISK SUMMARY
              ------------------------------------------ */}

              <RiskSummary
                riskScore={result.overall_risk_score ?? 0}
                severity={result.overall_severity ?? "NORMAL"}
                salesChange={salesChange}
                rxChange={rxChange}
                payoutDifference={payoutDifference}
                findingCount={riskFindingCount}
              />

              {/* ------------------------------------------
                  INVESTIGATION OVERVIEW
              ------------------------------------------ */}

              <InvestigationOverview result={result} />

              {/* ------------------------------------------
                  CHARTS
              ------------------------------------------ */}

              <InvestigationCharts findings={findings} />

              {/* ------------------------------------------
                  RISK SIGNALS
              ------------------------------------------ */}

              <FindingsList findings={findings} />

              {/* ------------------------------------------
                  AI INSIGHTS
              ------------------------------------------ */}

              <InvestigationInsights result={result} />
            </>
          )}
        </section>
      )}

      {/* ==================================================
          DOCUMENTS + DATABASE TAB
      ================================================== */}

      {activeTab === "database" && (
        <section className="dashboard-tab-content database-page">
          <button
            type="button"
            className={`document-plus-button ${
              showDocumentProcessing ? "minus-state" : "plus-state"
            }`}
            onClick={() => setShowDocumentProcessing((current) => !current)}
            title={showDocumentProcessing ? "Hide Add Records" : "Add Records"}
            aria-expanded={showDocumentProcessing}
          >
            <span className="folder-toggle-icon" aria-hidden="true">
              📁
              <span className="folder-toggle-badge">{showDocumentProcessing ? "−" : "+"}</span>
            </span>

            <span className="folder-toggle-title">
              {showDocumentProcessing ? "Close Records" : "Add Records"}
            </span>
          </button>

          {showDocumentProcessing && (
            <div className="document-processing-expand">
              <DocumentProcessingCard />
            </div>
          )}

          <div className="database-management-center">
            <DatabaseManagementCard />
          </div>
        </section>
      )}

      {/* ==================================================
          AI CHAT ASSISTANT
      ================================================== */}

      <AIChatAssistant
        onInvestigationRequest={(chatRepresentativeId, chatStartDate, chatEndDate) => {
          return new Promise<InvestigationResult>((resolve, reject) => {
            chatInvestigationResolveRef.current = resolve;

            chatInvestigationRejectRef.current = reject;

            setResult(null);

            setError(null);

            setWorkflowVisible(false);

            setRepresentativeId(chatRepresentativeId);

            setStartDate(chatStartDate);

            setEndDate(chatEndDate);

            setActiveTab("analysis");

            void loadRepresentatives(chatRepresentativeId);

            setPendingChatRun(true);
          });
        }}
      />
    </main>
  );
}

export default App;
