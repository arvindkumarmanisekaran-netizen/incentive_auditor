
type RiskSummaryProps = {
  riskScore: number;
  severity: string;

  salesChange?: number | null;
  rxChange?: number | null;
  payoutDifference?: number | null;

  findingCount: number;
};

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";

  return `${prefix}${value.toFixed(1)}%`;
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function valueClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return "";
  }

  return value > 0 ? "kpi-positive" : "kpi-negative";
}

function RiskSummary({
  riskScore,
  severity,
  salesChange,
  rxChange,
  payoutDifference,
  findingCount,
}: RiskSummaryProps) {
  return (
    <section className="risk-summary-section">
      <div className="risk-summary-heading">
        <h2>Risk Summary</h2>

        <span className="risk-summary-subtitle">
          Investigation risk and key performance indicators
        </span>
      </div>

      <div className="kpi-strip">
        {/* RISK */}

        <div className="kpi-item kpi-risk">
          <span className="kpi-label">Overall Risk</span>

          <div className="kpi-risk-value">
            <strong>{riskScore}</strong>

            <span className={`severity-badge severity-${(severity ?? "NORMAL").toLowerCase()}`}>
              {severity}
            </span>
          </div>
        </div>

        {/* SALES CHANGE */}

        <div className="kpi-item">
          <span className="kpi-label">Sales Change</span>

          <strong className={valueClass(salesChange)}>{formatPercent(salesChange)}</strong>
        </div>

        {/* PRESCRIPTION CHANGE */}

        <div className="kpi-item">
          <span className="kpi-label">Rx Change</span>

          <strong className={valueClass(rxChange)}>{formatPercent(rxChange)}</strong>
        </div>

        {/* PAYOUT DIFFERENCE */}

        <div className="kpi-item">
          <span className="kpi-label">Payout Difference</span>

          <strong>{formatMoney(payoutDifference)}</strong>
        </div>

        {/* FINDINGS */}

        <div className="kpi-item">
          <span className="kpi-label">Risk Findings</span>

          <strong>{findingCount}</strong>
        </div>
      </div>
    </section>
  );
}

export default RiskSummary;
