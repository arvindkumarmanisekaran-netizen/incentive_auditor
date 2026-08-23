import { useState } from "react";

import type { InvestigationResult } from "../types/investigation";

import FinalAssessment from "./FinalAssessment";

interface Props {
  result: InvestigationResult;
}

function StatusBadge({ status }: { status?: string }) {
  const value = status ?? "UNKNOWN";

  return <span className={`severity-badge severity-${value.toLowerCase()}`}>{value}</span>;
}

export default function InvestigationOverview({ result }: Props) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const report = result.final_report;

  const riskDrivers = report?.top_risk_drivers ?? [];

  const recommendedActions = report?.recommended_actions ?? [];

  const plan = result.investigation_plan;

  const sales = result.sales_rx_analysis;

  const doctor = result.doctor_territory_analysis;

  const payout = result.payout_analysis;

  return (
    <section className="investigation-overview">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="overview-header">
        <div className="overview-header-copy">
          <h2>AI Investigation Summary</h2>

          <p>
            Representative {result.representative_id} | {result.start_date} to {result.end_date}
          </p>

          <div className="overview-header-status">
            <StatusBadge status={result.overall_severity} />
          </div>
        </div>
      </div>

      {/* ==================================================
          KEY FINDINGS
      ================================================== */}

      <div className="overview-section key-findings-section">
        <h3>Key Findings</h3>

        {riskDrivers.length > 0 ? (
          <div className="risk-driver-list">
            {riskDrivers.map((item, index) => (
              <div key={`${index}-${item}`} className="risk-driver">
                <span className="risk-driver-icon" aria-hidden="true">
                  ⚠
                </span>

                <p>{item}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="overview-empty-text">No significant risk drivers identified.</p>
        )}
      </div>

      {/* ==================================================
          MODULE STATUS
      ================================================== */}

      <div className="overview-grid">
        <div className="overview-card">
          <h4>Sales &amp; Prescription</h4>

          <StatusBadge status={sales?.severity} />

          <p>{sales?.summary || "No analysis summary available."}</p>
        </div>

        <div className="overview-card">
          <h4>Doctor &amp; Territory</h4>

          <StatusBadge status={doctor?.severity} />

          <p>{doctor?.summary || "No analysis summary available."}</p>
        </div>

        <div className="overview-card">
          <h4>Payout Validation</h4>

          <StatusBadge status={payout?.severity} />

          <p>{payout?.summary || "No analysis summary available."}</p>
        </div>
      </div>

      {/* ==================================================
          RECOMMENDED ACTION
      ================================================== */}

      <div className="overview-action">
        <h3>Recommended Action</h3>

        {recommendedActions.length > 0 ? (
          <div className="action-list">
            {recommendedActions.map((item, index) => (
              <div key={`${index}-${item}`} className="action-item">
                <span className="action-item-icon" aria-hidden="true">
                  ✓
                </span>

                <p>{item}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="overview-empty-text">No recommended actions available.</p>
        )}

        {report?.human_review_required && (
          <div className="review-warning">Human review recommended</div>
        )}
      </div>

      {/* ==================================================
          DETAILED AI INVESTIGATION
      ================================================== */}

      <div className="overview-detailed-investigation">
        <button
          type="button"
          className="overview-detailed-toggle"
          onClick={() => setDetailsExpanded((current) => !current)}
          aria-expanded={detailsExpanded}
        >
          <div>
            <h3>Detailed AI Investigation</h3>

            <p>Investigation plan, specialist reviews and final assessment</p>
          </div>

          <span aria-hidden="true" className="overview-detailed-chevron">
            {detailsExpanded ? "▲" : "▼"}
          </span>
        </button>

        {detailsExpanded && (
          <div className="overview-detailed-content">
            {/* ============================================
                EXECUTIVE SUMMARY
            ============================================ */}

            <section className="workflow-summary-card">
              <div>
                <h3>Overall Risk</h3>

                <StatusBadge status={result.overall_severity} />
              </div>

              <div>
                <h3>Representative</h3>

                <p>{result.representative_id}</p>
              </div>

              <div>
                <h3>Investigation Period</h3>

                <p>
                  {result.start_date} to {result.end_date}
                </p>
              </div>
            </section>

            {/* ============================================
                INVESTIGATION PLAN
            ============================================ */}

            <section className="workflow-card">
              <h3>Investigation Areas Reviewed</h3>

              <p>
                Priority: <strong>{plan?.priority ?? "N/A"}</strong>
              </p>

              <div className="tag-container">
                {plan?.focus_areas?.map((area) => (
                  <span key={area} className="workflow-tag">
                    {area.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </span>
                ))}
              </div>
            </section>

            {/* ============================================
                SPECIALIST REVIEWS
            ============================================ */}

            <section className="workflow-grid">
              <div className="workflow-card">
                <h3>Sales &amp; Prescription Review</h3>

                <StatusBadge status={sales?.severity} />

                <p>{sales?.summary}</p>

                <h4>Key Observations</h4>

                <ul>
                  {sales?.key_observations?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="workflow-card">
                <h3>Doctor &amp; Territory Review</h3>

                <StatusBadge status={doctor?.severity} />

                <p>{doctor?.summary}</p>

                <h4>Key Observations</h4>

                <ul>
                  {doctor?.key_observations?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="workflow-card">
                <h3>Payout Validation</h3>

                <StatusBadge status={payout?.severity} />

                <p>{payout?.summary}</p>

                <h4>Key Observations</h4>

                <ul>
                  {payout?.key_observations?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ============================================
                FINAL ASSESSMENT
            ============================================ */}

            <FinalAssessment result={result} />
          </div>
        )}
      </div>
    </section>
  );
}
