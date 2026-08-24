import type { Finding } from "../../types/investigation";

type Props = {
  findings: Finding[];
};

function formatMoney(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HistoricalAnalysis({ findings }: Props) {
  const salesFinding = findings.find((finding) => finding.type === "sales_deviation");

  const historicalAverage = Number(salesFinding?.evidence?.historical_average ?? 0);

  const currentSales = Number(salesFinding?.evidence?.current_sales ?? 0);

  const deviation = Number(
    salesFinding?.evidence?.deviation_percent ?? salesFinding?.evidence?.sales_change_percent ?? 0,
  );

  const direction =
    deviation > 0
      ? "Above historical average"
      : deviation < 0
        ? "Below historical average"
        : "Aligned with historical average";

  return (
    <section className="historical-analysis-section">
      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Historical Analysis</h3>

          <p>Current performance compared against historical behaviour.</p>
        </div>
      </div>

      <div className="historical-analysis-grid">
        {/* CURRENT VS PRIOR */}

        <div className="chart-card">
          <h3>Current vs Historical Baseline</h3>

          <p>Sales movement compared with historical average.</p>

          <div className="historical-metrics">
            <div>
              <span>Historical Average</span>

              <strong>{formatMoney(historicalAverage)}</strong>
            </div>

            <div>
              <span>Current Sales</span>

              <strong>{formatMoney(currentSales)}</strong>
            </div>
          </div>
        </div>

        {/* TREND */}

        <div className="chart-card">
          <h3>Trend History</h3>

          <p>Historical trend direction.</p>

          <div className="historical-position">
            <strong>{direction}</strong>

            <span>
              {deviation > 0 ? "+" : ""}
              {deviation.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* POSITION */}

        <div className="chart-card historical-position-card">
          <h3>Historical Position</h3>

          <p>Relative position against previous performance.</p>

          <div className="position-indicator">
            <div
              className="position-fill"
              style={{
                width: `${Math.min(Math.abs(deviation) * 4, 100)}%`,
              }}
            />
          </div>

          <span className="position-label">{direction}</span>
        </div>
      </div>
    </section>
  );
}
