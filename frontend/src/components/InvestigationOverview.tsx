import type { InvestigationResult } from "../types/investigation";

interface Props {
  result: InvestigationResult;
}

function StatusBadge({ status }: { status?: string }) {
  const value = status ?? "UNKNOWN";

  return <span className={`severity-badge severity-${value.toLowerCase()}`}>{value}</span>;
}

export default function InvestigationOverview({ result }: Props) {
  const report = result.final_report;

  const riskDrivers = report?.top_risk_drivers ?? [];

  const recommendedActions = report?.recommended_actions ?? [];

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
        </div>

        <StatusBadge status={result.overall_severity} />
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
