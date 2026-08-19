import { useEffect, useState } from "react";

import { runInvestigation } from "./api/investigation";

import { getRepresentatives } from "./api/masterData";

import type { Representative } from "./api/masterData";

import type { InvestigationResult } from "./types/investigation";

import InvestigationForm from "./components/InvestigationForm";

import RiskSummary from "./components/RiskSummary";

import FindingsList from "./components/FindingsList";

import InvestigationInsights from "./components/InvestigationInsights";

import InvestigationCharts from "./components/InvestigationCharts";

import DocumentProcessingCard from "./components/DocumentProcessingCard";

import "./App.css";

type DashboardTab = "analysis" | "database";

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

  // ==================================================
  // LOAD MASTER DATA
  // ==================================================

  useEffect(() => {
    async function loadMasterData() {
      setMasterDataLoading(true);

      setError(null);

      try {
        const representativeData = await getRepresentatives();

        setRepresentatives(representativeData);

        if (representativeData.length > 0) {
          setRepresentativeId(representativeData[0].representative_id);
        }
      } catch (err) {
        console.error("Master data loading failed:", err);

        setError(err instanceof Error ? err.message : "Failed to load master data");
      } finally {
        setMasterDataLoading(false);
      }
    }

    loadMasterData();
  }, []);

  // ==================================================
  // RUN INVESTIGATION
  // ==================================================

  async function handleInvestigation() {
    if (!representativeId || !startDate || !endDate) {
      setError("Please select representative and date range.");

      return;
    }

    setLoading(true);

    setError(null);

    setResult(null);

    try {
      const data = await runInvestigation(representativeId, startDate, endDate);

      console.log("API RESPONSE", data);

      setResult({
        representative_id: data.representative_id,

        start_date: data.start_date,

        end_date: data.end_date,

        products_analyzed: data.products_analyzed ?? [],

        findings: data.findings ?? [],

        overall_risk_score: data.overall_risk_score ?? 0,

        overall_severity: data.overall_severity ?? "NORMAL",

        sales_rx_analysis: data.sales_rx_analysis,

        doctor_territory_analysis: data.doctor_territory_analysis,

        payout_analysis: data.payout_analysis,

        final_report: data.final_report,
      });
    } catch (err) {
      console.error("Investigation failed:", err);

      setError(err instanceof Error ? err.message : "Unable to run investigation");
    } finally {
      setLoading(false);
    }
  }

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
          onClick={() => setActiveTab("analysis")}
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

          {/* ----------------------------------------------
              LOADING
          ---------------------------------------------- */}

          {loading && (
            <div className="investigation-loading">
              <span className="loading-spinner" />

              <span>Analyzing sales, prescriptions and incentive data...</span>
            </div>
          )}

          {/* ----------------------------------------------
              RESULTS
          ---------------------------------------------- */}

          {result && (
            <>
              <RiskSummary
                riskScore={result.overall_risk_score ?? 0}
                severity={result.overall_severity ?? "NORMAL"}
                salesChange={salesChange}
                rxChange={rxChange}
                payoutDifference={payoutDifference}
                findingCount={riskFindingCount}
              />

              <InvestigationCharts findings={findings} />

              <FindingsList findings={findings} />

              {result && <InvestigationInsights result={result} />}
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
            onClick={() => setShowDocumentProcessing(!showDocumentProcessing)}
            aria-label="Toggle document processing"
            title="Add Records"
          >
            <span className="folder-toggle-icon">
              📁
              <span className="folder-toggle-badge">{showDocumentProcessing ? "−" : "+"}</span>
            </span>

            <span className="folder-toggle-title">Add Records</span>
          </button>

          {showDocumentProcessing && (
            <div className="document-processing-expand">
              <DocumentProcessingCard />
            </div>
          )}

          <div className="database-management-center">
            <article className="admin-card database-management-card">
              <div className="admin-card-icon">🗄️</div>

              <div className="admin-card-content">
                <h3>Database Management</h3>

                <p>
                  Review and maintain representatives, products, doctors, territories, assignments,
                  targets, incentive rules and payout records.
                </p>

                <div className="admin-card-meta">
                  <span>Representatives</span>
                  <span>Doctors</span>
                  <span>Products</span>
                  <span>Territories</span>
                  <span>Assignments</span>
                  <span>Targets</span>
                  <span>Payouts</span>
                </div>

                <button type="button" className="secondary-button">
                  Manage Database
                </button>
              </div>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
