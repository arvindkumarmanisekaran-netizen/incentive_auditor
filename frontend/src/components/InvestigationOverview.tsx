import type { InvestigationResult } from "../types/investigation";

interface Props {
  result: InvestigationResult;
}

function StatusBadge({ status }: { status?: string }) {
  const value = status ?? "UNKNOWN";

  return <span className={`severity-badge ${value.toLowerCase()}`}>{value}</span>;
}
export default function InvestigationOverview({ result }: Props) {
  const report = result.final_report;

  const riskDrivers = report?.top_risk_drivers ?? [];

  return (
    <section className="investigation-overview">
      {/* =============================
          HEADER
      ============================= */}

      <div className="overview-header centered">
        <div>
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

      <div className="overview-section">
        <h3>Key Findings</h3>

        {riskDrivers.length > 0 ? (
          <div className="risk-driver-list">
            {riskDrivers.map((item, index) => (
              <div key={index} className="risk-driver">
                <span>⚠</span>

                <p>{item}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No significant risk drivers identified.</p>
        )}
      </div>

      {/* =============================
          MODULE STATUS
      ============================= */}

      <div className="overview-grid">
        <div className="overview-card">
          <h4>Sales & Prescription</h4>

          <StatusBadge status={result.sales_rx_analysis?.severity} />

          <p>{result.sales_rx_analysis?.summary}</p>
        </div>

        <div className="overview-card">
          <h4>Doctor & Territory</h4>

          <StatusBadge status={result.doctor_territory_analysis?.severity} />

          <p>{result.doctor_territory_analysis?.summary}</p>
        </div>

        <div className="overview-card">
          <h4>Payout Validation</h4>

          <StatusBadge status={result.payout_analysis?.severity} />

          <p>{result.payout_analysis?.summary}</p>
        </div>
      </div>

      {/* =============================
          ACTION
      ============================= */}

      <div className="overview-action">
        <h3>Recommended Action</h3>

        <div className="action-list">
          {report?.recommended_actions?.map((item, index) => (
            <div key={index} className="action-item">
              <span>✓</span>

              <p>{item}</p>
            </div>
          ))}
        </div>

        {report?.human_review_required && (
          <div className="review-warning">Human review recommended</div>
        )}
      </div>
    </section>
  );
}
