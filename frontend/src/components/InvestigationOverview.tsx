import { useState } from "react";

import type { InvestigationResult } from "../types/investigation";

interface Props {
  result: InvestigationResult;
}

function StatusBadge({ status }: { status?: string }) {
  const value = status ?? "UNKNOWN";

  return <span className={`severity-badge severity-${value.toLowerCase()}`}>{value}</span>;
}
type DetailedAnalysisCardProps = {
  title: string;
  severity?: string;
  evidenceSummary?: string[];
  observations?: string[];
  limitations?: string[];
};

function DetailedAnalysisCard({
  title,
  severity,
  evidenceSummary = [],
  observations = [],
  limitations = [],
}: DetailedAnalysisCardProps) {
  return (
    <article className="overview-detail-card">
      <div className="overview-detail-header">
        <h4>{title}</h4>

        <StatusBadge status={severity} />
      </div>

      {evidenceSummary.length > 0 && (
        <div className="overview-detail-block">
          <h5>Evidence</h5>

          <ul>
            {evidenceSummary.map((item, index) => (
              <li key={`evidence-${title}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {observations.length > 0 && (
        <div className="overview-detail-block">
          <h5>Key Observations</h5>

          <ul>
            {observations.map((item, index) => (
              <li key={`observation-${title}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="overview-detail-block">
          <h5>Limitations</h5>

          <ul>
            {limitations.map((item, index) => (
              <li key={`limitation-${title}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function InvestigationOverview({ result }: Props) {
  const report = result.final_report;

  const riskDrivers = report?.top_risk_drivers ?? [];

  const recommendedActions = report?.recommended_actions ?? [];

  const [detailsExpanded, setDetailsExpanded] = useState(false);

  return (
    <section className="investigation-overview">
      {/* =============================
          HEADER
      ============================= */}

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

      {/* =============================
          KEY FINDINGS
      ============================= */}

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

      {/* =============================
          MODULE STATUS
      ============================= */}

      <div className="overview-grid">
        <div className="overview-card">
          <h4>Sales &amp; Prescription</h4>

          <StatusBadge status={result.sales_rx_analysis?.severity} />

          <p>{result.sales_rx_analysis?.summary || "No analysis summary available."}</p>
        </div>

        <div className="overview-card">
          <h4>Doctor &amp; Territory</h4>

          <StatusBadge status={result.doctor_territory_analysis?.severity} />

          <p>{result.doctor_territory_analysis?.summary || "No analysis summary available."}</p>
        </div>

        <div className="overview-card">
          <h4>Payout Validation</h4>

          <StatusBadge status={result.payout_analysis?.severity} />

          <p>{result.payout_analysis?.summary || "No analysis summary available."}</p>
        </div>
      </div>

      {/* =============================
    DETAILED ANALYSIS
============================= */}

      <div className="overview-detailed-analysis">
        <button
          type="button"
          className="overview-details-toggle"
          onClick={() => setDetailsExpanded((current) => !current)}
          aria-expanded={detailsExpanded}
        >
          <div>
            <h3>Detailed Analysis</h3>

            <p>Specialist evidence, observations and analysis limitations</p>
          </div>

          <span aria-hidden="true">{detailsExpanded ? "▲" : "▼"}</span>
        </button>

        {detailsExpanded && (
          <div className="overview-details-content">
            {/* SALES / RX */}

            <DetailedAnalysisCard
              title="Sales & Prescription"
              severity={result.sales_rx_analysis?.severity}
              evidenceSummary={result.sales_rx_analysis?.evidence_summary}
              observations={result.sales_rx_analysis?.key_observations}
              limitations={result.sales_rx_analysis?.limitations}
            />

            {/* DOCTOR / TERRITORY */}

            <DetailedAnalysisCard
              title="Doctor & Territory"
              severity={result.doctor_territory_analysis?.severity}
              evidenceSummary={result.doctor_territory_analysis?.evidence_summary}
              observations={result.doctor_territory_analysis?.key_observations}
              limitations={result.doctor_territory_analysis?.limitations}
            />

            {/* PAYOUT */}

            <DetailedAnalysisCard
              title="Payout Validation"
              severity={result.payout_analysis?.severity}
              evidenceSummary={result.payout_analysis?.evidence_summary}
              observations={result.payout_analysis?.key_observations}
              limitations={result.payout_analysis?.limitations}
            />
          </div>
        )}
      </div>

      {/* =============================
          ACTION
      ============================= */}

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
    </section>
  );
}
