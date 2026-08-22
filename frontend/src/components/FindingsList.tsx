import "../styles/index.css";
import type { Finding } from "../types/investigation";

type Props = {
  findings: Finding[];
};

function formatMoney(value: unknown) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: unknown) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "—";
  }

  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function FindingContent({ finding }: { finding: Finding }) {
  const e = finding.evidence;

  switch (finding.type) {
    case "sales_deviation":
      return (
        <>
          <div className="finding-metrics">
            <div>
              <span>Current Sales</span>
              <strong>{formatMoney(e.current_sales)}</strong>
            </div>

            <div>
              <span>Historical Average</span>
              <strong>{formatMoney(e.historical_average)}</strong>
            </div>

            <div>
              <span>Sales Change</span>
              <strong>{formatPercent(e.deviation_percent)}</strong>
            </div>
          </div>
        </>
      );

    case "sales_prescription_mismatch":
      return (
        <div className="finding-metrics">
          <div>
            <span>Sales Change</span>
            <strong>{formatPercent(e.sales_change_percent)}</strong>
          </div>

          <div>
            <span>Prescription Change</span>
            <strong>{formatPercent(e.prescription_change_percent)}</strong>
          </div>

          <div>
            <span>Mismatch Score</span>
            <strong>{Number(e.mismatch_score).toFixed(2)}</strong>
          </div>
        </div>
      );

    case "doctor_concentration":
      return (
        <>
          <div className="finding-metrics">
            <div>
              <span>Top Doctor Share</span>
              <strong>{formatPercent(e.top_doctor_share_percent)}</strong>
            </div>

            <div>
              <span>Top 3 Share</span>
              <strong>{formatPercent(e.top_3_share_percent)}</strong>
            </div>

            <div>
              <span>Total Sales</span>
              <strong>{formatMoney(e.total_sales)}</strong>
            </div>
          </div>

          {Array.isArray(e.doctor_breakdown) && (
            <div className="breakdown-list">
              {e.doctor_breakdown.map((doctor: any) => (
                <div className="breakdown-row" key={doctor.doctor_id}>
                  <span>{doctor.doctor_name}</span>

                  <strong>{formatMoney(doctor.sales)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      );

    case "cross_territory_concentration":
      return (
        <>
          <div className="finding-metrics">
            <div>
              <span>Home Territory</span>
              <strong>{formatMoney(e.home_territory_sales)}</strong>
            </div>

            <div>
              <span>Cross Territory</span>
              <strong>{formatMoney(e.cross_territory_sales)}</strong>
            </div>

            <div>
              <span>Cross Territory Share</span>
              <strong>{formatPercent(e.cross_territory_share_percent)}</strong>
            </div>
          </div>
        </>
      );

    case "payout_discrepancy":
      return (
        <div className="finding-metrics">
          <div>
            <span>Expected Payout</span>
            <strong>{formatMoney(e.expected_payout)}</strong>
          </div>

          <div>
            <span>Actual Payout</span>
            <strong>{formatMoney(e.actual_payout)}</strong>
          </div>

          <div>
            <span>Difference</span>
            <strong>{formatMoney(e.payout_difference)}</strong>
          </div>
        </div>
      );

    default:
      return <p className="muted-text">Detailed evidence is not available for this finding.</p>;
  }
}

function getTitle(type: string) {
  switch (type) {
    case "sales_deviation":
      return "Sales Performance";

    case "sales_prescription_mismatch":
      return "Sales vs Prescription Trend";

    case "doctor_concentration":
      return "Doctor Concentration";

    case "cross_territory_concentration":
      return "Territory Distribution";

    case "payout_discrepancy":
      return "Payout Validation";

    default:
      return "Investigation Finding";
  }
}

function FindingsList({ findings }: Props) {
  if (!findings.length) {
    return (
      <section className="findings-section">
        <h2>Risk Signals</h2>

        <div className="empty-card">No anomaly signals detected.</div>
      </section>
    );
  }

  return (
    <section className="findings-section">
      <div className="section-heading">
        <div>
          <h2>Risk Signals</h2>
          <p>Deterministic indicators detected during the investigation</p>
        </div>
      </div>

      <div className="findings-grid">
        {findings.map((finding, index) => (
          <article className="finding-card" key={`${finding.type}-${index}`}>
            <div className="finding-header">
              <h3>{getTitle(finding.type)}</h3>

              <span className={`severity-badge severity-${finding.severity.toLowerCase()}`}>
                {finding.severity}
              </span>
            </div>

            <FindingContent finding={finding} />
          </article>
        ))}
      </div>
    </section>
  );
}

export default FindingsList;
