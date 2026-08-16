import {
  useEffect,
  useState,
} from "react";

import {
  runInvestigation,
} from "./api/investigation";

import {
  getRepresentatives,
  getProducts,
} from "./api/masterData";

import type {
  Representative,
  Product,
} from "./api/masterData";

import type {
  InvestigationResult,
} from "./types/investigation";

import InvestigationForm
  from "./components/InvestigationForm";

import RiskSummary
  from "./components/RiskSummary";

import FindingsList
  from "./components/FindingsList";

import InvestigationInsights
  from "./components/InvestigationInsights";

import InvestigationCharts
  from "./components/InvestigationCharts";

import "./App.css";


type DashboardTab =
  | "analysis"
  | "documents";


function App() {

  // ==================================================
  // DASHBOARD TAB
  // ==================================================

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<DashboardTab>(
      "analysis"
    );


  // ==================================================
  // FILTERS
  // ==================================================

  const [
    representativeId,
    setRepresentativeId,
  ] = useState("");


  const [
    productId,
    setProductId,
  ] = useState("");


  const [
    month,
    setMonth,
  ] = useState("2026-07");


  // ==================================================
  // MASTER DATA
  // ==================================================

  const [
    representatives,
    setRepresentatives,
  ] = useState<Representative[]>([]);


  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);


  // ==================================================
  // INVESTIGATION STATE
  // ==================================================

  const [
    result,
    setResult,
  ] =
    useState<InvestigationResult | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    masterDataLoading,
    setMasterDataLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  // ==================================================
  // LOAD MASTER DATA
  // ==================================================

  useEffect(() => {

    async function loadMasterData() {

      setMasterDataLoading(true);

      setError(null);


      try {

        const [
          representativeData,
          productData,
        ] =
          await Promise.all([
            getRepresentatives(),
            getProducts(),
          ]);


        setRepresentatives(
          representativeData
        );


        setProducts(
          productData
        );


        if (
          representativeData.length > 0
        ) {
          setRepresentativeId(
            representativeData[0]
              .representative_id
          );
        }


        if (
          productData.length > 0
        ) {
          setProductId(
            productData[0]
              .product_id
          );
        }

      } catch (err) {

        console.error(
          "Master data loading failed:",
          err
        );


        setError(
          err instanceof Error
            ? err.message
            : "Failed to load master data"
        );

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

    if (
      !representativeId ||
      !productId ||
      !month
    ) {

      setError(
        "Please select representative, product and month."
      );

      return;
    }


    setLoading(true);

    setError(null);

    setResult(null);


    try {

      const data =
        await runInvestigation(
          representativeId,
          productId,
          month
        );


      setResult(data);

    } catch (err) {

      console.error(
        "Investigation failed:",
        err
      );


      setError(
        err instanceof Error
          ? err.message
          : "Unable to run investigation"
      );

    } finally {

      setLoading(false);

    }
  }


  // ==================================================
  // FIND INDIVIDUAL FINDINGS
  // ==================================================

  const salesFinding =
    result?.findings.find(
      (finding) =>
        finding.type ===
        "sales_deviation"
    );


  const mismatchFinding =
    result?.findings.find(
      (finding) =>
        finding.type ===
        "sales_prescription_mismatch"
    );


  const payoutFinding =
    result?.findings.find(
      (finding) =>
        finding.type ===
        "payout_discrepancy"
    );


  // ==================================================
  // SALES CHANGE
  // ==================================================

  const salesChange =
    salesFinding
      ? Number(
          salesFinding.evidence
            .deviation_percent ??
          salesFinding.evidence
            .sales_change_percent ??
          salesFinding.evidence
            .percentage_deviation
        )
      : null;


  // ==================================================
  // PRESCRIPTION CHANGE
  // ==================================================

  const rxChange =
    mismatchFinding
      ? Number(
          mismatchFinding.evidence
            .prescription_change_percent ??
          mismatchFinding.evidence
            .rx_change_percent ??
          mismatchFinding.evidence
            .prescription_deviation_percent
        )
      : null;


  // ==================================================
  // PAYOUT DIFFERENCE
  // ==================================================

  const payoutDifference =
    payoutFinding
      ? Number(
          payoutFinding.evidence
            .payout_difference
        )
      : null;


  // ==================================================
  // RISK FINDING COUNT
  // ==================================================

  const riskFindingCount =
    result?.findings.filter(
      (finding) => {

        const severity =
          finding.severity.toUpperCase();

        return (
          severity !== "NORMAL" &&
          severity !== "UNKNOWN"
        );
      }
    ).length ?? 0;


  // ==================================================
  // UI
  // ==================================================

  return (
    <main className="dashboard">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="dashboard-header">

        <h1>
          Incentive Auditor
        </h1>

        <p>
          Review incentive anomalies,
          supporting evidence and
          AI-assisted investigation insights.
        </p>

      </header>


      {/* ==================================================
          TOP NAVIGATION
      ================================================== */}

      <nav className="dashboard-tabs">

        <button
          type="button"
          className={
            activeTab === "analysis"
              ? "dashboard-tab active"
              : "dashboard-tab"
          }
          onClick={() =>
            setActiveTab("analysis")
          }
        >
          Analysis
        </button>


        <button
          type="button"
          className={
            activeTab === "documents"
              ? "dashboard-tab active"
              : "dashboard-tab"
          }
          onClick={() =>
            setActiveTab("documents")
          }
        >
          Documents & Database
        </button>

      </nav>


      {/* ==================================================
          ANALYSIS TAB
      ================================================== */}

      {activeTab === "analysis" && (

        <section className="dashboard-tab-content">

          {/* ----------------------------------------------
              INVESTIGATION CONTROLS
          ---------------------------------------------- */}

          {masterDataLoading ? (

            <div className="loading-message">
              Loading representatives
              and products...
            </div>

          ) : (

            <InvestigationForm
              representativeId={
                representativeId
              }

              productId={
                productId
              }

              month={
                month
              }

              loading={
                loading
              }

              representatives={
                representatives
              }

              products={
                products
              }

              onRepresentativeChange={
                setRepresentativeId
              }

              onProductChange={
                setProductId
              }

              onMonthChange={
                setMonth
              }

              onSubmit={
                handleInvestigation
              }
            />

          )}


          {/* ----------------------------------------------
              ERROR
          ---------------------------------------------- */}

          {error && (

            <div className="error-message">
              {error}
            </div>

          )}


          {/* ----------------------------------------------
              LOADING
          ---------------------------------------------- */}

          {loading && (

            <div className="investigation-loading">

              <span
                className="loading-spinner"
              />

              <span>
                Analyzing sales,
                prescriptions and
                incentive data...
              </span>

            </div>

          )}


          {/* ----------------------------------------------
              RESULTS
          ---------------------------------------------- */}

          {result && (

            <>

              <RiskSummary
                riskScore={
                  result.overall_risk_score
                }

                severity={
                  result.overall_severity
                }

                salesChange={
                  salesChange
                }

                rxChange={
                  rxChange
                }

                payoutDifference={
                  payoutDifference
                }

                findingCount={
                  riskFindingCount
                }
              />


              <InvestigationCharts
                findings={
                  result.findings
                }
              />


              <FindingsList
                findings={
                  result.findings
                }
              />


              <InvestigationInsights
                result={
                  result
                }
              />

            </>

          )}

        </section>

      )}


      {/* ==================================================
          DOCUMENTS + DATABASE TAB
      ================================================== */}

      {activeTab === "documents" && (

        <section className="dashboard-tab-content">

          <div className="admin-header">

            <div>
              <span className="admin-eyebrow">
                Data Management
              </span>

              <h2>
                Documents & Database
              </h2>

              <p>
                Process supporting documents and
                maintain investigation data.
              </p>
            </div>

          </div>


          <div className="admin-grid">

            {/* ============================================
                DOCUMENT PROCESSING
            ============================================ */}

            <article className="admin-card">

              <div className="admin-card-icon">
                📁
              </div>

              <div className="admin-card-content">

                <h3>
                  Document Processing
                </h3>

                <p>
                  Select a folder containing supporting
                  investigation documents. The system
                  will scan supported files and extract
                  relevant evidence.
                </p>


                <div className="admin-card-meta">

                  <span>
                    PDF
                  </span>

                  <span>
                    DOCX
                  </span>

                  <span>
                    XLSX
                  </span>

                  <span>
                    CSV
                  </span>

                  <span>
                    TXT
                  </span>

                </div>


                <button
                  type="button"
                  className="primary-button"
                >
                  Select Document Folder
                </button>

              </div>

            </article>


            {/* ============================================
                DATABASE MANAGEMENT
            ============================================ */}

            <article className="admin-card">

              <div className="admin-card-icon">
                🗄️
              </div>


              <div className="admin-card-content">

                <h3>
                  Database Management
                </h3>

                <p>
                  Review and maintain representatives,
                  products, doctor assignments,
                  territories, targets, incentive rules
                  and payout records.
                </p>


                <div className="admin-card-meta">

                  <span>
                    Representatives
                  </span>

                  <span>
                    Products
                  </span>

                  <span>
                    Rules
                  </span>

                  <span>
                    Targets
                  </span>

                  <span>
                    Payouts
                  </span>

                </div>


                <button
                  type="button"
                  className="secondary-button"
                >
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