import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

import type { InvestigationResult } from "../types/investigation";

import "../styles/index.css";

type Props = {
  result: InvestigationResult;
};

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  sales: "#7c3aed",
  prescription: "#2563eb",
  expected: "#64748b",
  actual: "#2563eb",
  doctor: "#7c3aed",
  territory: "#0891b2",
};

/* =========================================================
   HELPERS
========================================================= */

function severityClass(severity?: string) {
  return `severity-badge severity-${(severity ?? "unknown").toLowerCase()}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function safeNumber(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function signedDomain(values: number[]): [number, number] {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = Math.max(maximum - minimum, 1);
  const padding = span * 0.1;

  return [minimum < 0 ? minimum - padding : 0, maximum > 0 ? maximum + padding : 0];
}

function getProductName(finding: any) {
  return finding?.product_name ?? finding?.evidence?.product_name ?? finding?.product_id ?? "";
}

/* =========================================================
   SALES / RX TOOLTIP
========================================================= */

function SalesRxTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-custom-tooltip visible">
      <strong>{label}</strong>

      {payload.map((item) => (
        <div key={item.dataKey}>
          <span>{item.name}</span>

          <strong>
            {safeNumber(item.value) > 0 ? "+" : ""}
            {safeNumber(item.value).toFixed(2)}%
          </strong>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   MONEY TOOLTIP
========================================================= */

function MoneyTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name}</span>

      <strong>{formatMoney(safeNumber(item.amount))}</strong>
    </div>
  );
}

/* =========================================================
   PERCENT TOOLTIP
========================================================= */

function PercentTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div className="chart-custom-tooltip visible">
      <span>{item.name}</span>

      <strong>{safeNumber(item.value).toFixed(2)}%</strong>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

function InvestigationInsights({ result }: Props) {
  const findings = result.findings ?? [];

  /* =======================================================
     SALES / PRESCRIPTION
  ======================================================= */

  const salesFindings = findings.filter((finding) => finding.type === "sales_deviation");

  const mismatchFindings = findings.filter(
    (finding) => finding.type === "sales_prescription_mismatch",
  );

  const salesRxData = mismatchFindings.map((mismatchFinding) => {
    const productId = String(mismatchFinding.product_id ?? "");

    const salesFinding = salesFindings.find(
      (finding) => String(finding.product_id ?? "") === productId,
    );

    return {
      product: productId,
      productName: getProductName(mismatchFinding),

      salesChange: safeNumber(
        salesFinding?.evidence?.deviation_percent ?? mismatchFinding.evidence?.sales_change_percent,
      ),

      prescriptionChange: safeNumber(mismatchFinding.evidence?.prescription_change_percent),

      mismatchScore: safeNumber(mismatchFinding.evidence?.mismatch_score),

      severity: mismatchFinding.severity ?? "NORMAL",
    };
  });

  const salesRxDomain = signedDomain(
    salesRxData.flatMap((item) => [item.salesChange, item.prescriptionChange]),
  );

  const mismatchIssues = mismatchFindings.filter(
    (finding) => String(finding.severity ?? "NORMAL").toUpperCase() !== "NORMAL",
  );

  const highestMismatch =
    salesRxData.length > 0
      ? salesRxData.reduce((highest, current) =>
          current.mismatchScore > highest.mismatchScore ? current : highest,
        )
      : undefined;

  /* =======================================================
     DOCTOR / TERRITORY
  ======================================================= */

  const doctorFinding = findings.find((finding) => finding.type === "doctor_concentration");

  const territoryFinding = findings.find(
    (finding) => finding.type === "cross_territory_concentration",
  );

  const doctorConcentration = safeNumber(doctorFinding?.evidence?.top_doctor_share_percent);

  const crossTerritory = safeNumber(territoryFinding?.evidence?.cross_territory_share_percent);

  const concentrationData = [
    {
      name: "Top Doctor",
      value: doctorConcentration,
      fill: COLORS.doctor,
    },
    {
      name: "Cross Territory",
      value: crossTerritory,
      fill: COLORS.territory,
    },
  ];

  /* =======================================================
     PAYOUT
  ======================================================= */

  const payoutFindings = findings.filter((finding) => finding.type === "payout_discrepancy");

  const totalExpectedPayout = payoutFindings.reduce(
    (total, finding) => total + safeNumber(finding.evidence?.expected_payout),
    0,
  );

  const totalActualPayout = payoutFindings.reduce(
    (total, finding) => total + safeNumber(finding.evidence?.actual_payout),
    0,
  );

  const totalPayoutDifference = totalActualPayout - totalExpectedPayout;

  const payoutData = [
    {
      name: "Expected",
      amount: totalExpectedPayout,
      fill: COLORS.expected,
    },
    {
      name: "Recorded",
      amount: totalActualPayout,
      fill: COLORS.actual,
    },
  ];

  const payoutMismatchCount = payoutFindings.filter(
    (finding) => Math.abs(safeNumber(finding.evidence?.payout_difference)) > 0,
  ).length;

  /* =======================================================
     RISK
  ======================================================= */

  const riskScore = Math.min(Math.max(safeNumber(result.overall_risk_score), 0), 100);

  const riskData = [
    {
      name: "Risk",
      value: riskScore,
      fill:
        riskScore >= 75
          ? "#dc2626"
          : riskScore >= 50
            ? "#f59e0b"
            : riskScore >= 25
              ? "#2563eb"
              : "#16a34a",
    },
  ];

  const riskFindingCount = findings.filter((finding) => {
    const severity = finding.severity?.toUpperCase();

    return severity !== "NORMAL" && severity !== "UNKNOWN";
  }).length;

  /* =======================================================
     AI ANALYSIS
  ======================================================= */

  const doctorAnalysis = result.doctor_territory_analysis;

  const salesAnalysis = result.sales_rx_analysis;

  const payoutAnalysis = result.payout_analysis;

  const finalReport = result.final_report;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="insights-section">
      <div className="section-heading">
        <h2>Investigation Insights</h2>

        <p>Cross-product visual summary of investigation evidence</p>
      </div>

      <div className="insights-grid">
        {/* =================================================
            SALES / PRESCRIPTION
        ================================================= */}

        <article className="insight-card">
          <header className="insight-card-header">
            <div>
              <span className="insight-eyebrow">Performance</span>

              <h3>Sales / Prescription</h3>
            </div>

            <span className={severityClass(salesAnalysis?.severity)}>
              {salesAnalysis?.severity ?? "UNKNOWN"}
            </span>
          </header>

          <div className="insight-body">
            <div className="insight-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesRxData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: -15,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                  <XAxis dataKey="product" tickLine={false} axisLine={false} fontSize={10} />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    domain={salesRxDomain}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />

                  <Tooltip
                    cursor={{
                      fill: "transparent",
                    }}
                    content={<SalesRxTooltip />}
                  />

                  <Legend />

                  <Bar
                    dataKey="salesChange"
                    name="Sales Change"
                    fill={COLORS.sales}
                    radius={[4, 4, 0, 0]}
                  />

                  <Bar
                    dataKey="prescriptionChange"
                    name="Prescription Change"
                    fill={COLORS.prescription}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="insight-text">
              <span className="ai-label">Investigation Summary</span>

              <div className="insight-kpi-list">
                <div>
                  <span>Products reviewed</span>

                  <strong>{salesRxData.length}</strong>
                </div>

                <div>
                  <span>Mismatch findings</span>

                  <strong>{mismatchIssues.length}</strong>
                </div>

                {highestMismatch && (
                  <div>
                    <span>Highest mismatch</span>

                    <strong>
                      {highestMismatch.product} · {highestMismatch.mismatchScore.toFixed(2)}
                    </strong>
                  </div>
                )}
              </div>

              {salesAnalysis?.summary && <p className="insight-summary">{salesAnalysis.summary}</p>}
            </div>
          </div>
        </article>

        {/* =================================================
            DOCTOR / TERRITORY
        ================================================= */}

        <article className="insight-card">
          <header className="insight-card-header">
            <div>
              <span className="insight-eyebrow">Concentration</span>

              <h3>Doctor / Territory</h3>
            </div>

            <span className={severityClass(doctorAnalysis?.severity)}>
              {doctorAnalysis?.severity ?? "UNKNOWN"}
            </span>
          </header>

          <div className="insight-body">
            <div className="insight-chart concentration-chart">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="45%"
                  innerRadius="55%"
                  outerRadius="92%"
                  data={concentrationData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar dataKey="value" background cornerRadius={8} barSize={12} />

                  <Legend iconSize={9} layout="horizontal" verticalAlign="bottom" align="center" />

                  <Tooltip content={<PercentTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>

              <div className="chart-center-label concentration-center-label">
                <strong>{doctorConcentration.toFixed(1)}%</strong>

                <span>Top Doctor</span>
              </div>
            </div>

            <div className="insight-text">
              <span className="ai-label">Evidence Summary</span>

              <div className="insight-kpi-list">
                <div>
                  <span>Top doctor share</span>

                  <strong>{doctorConcentration.toFixed(2)}%</strong>
                </div>

                <div>
                  <span>Top 3 doctor share</span>

                  <strong>
                    {safeNumber(doctorFinding?.evidence?.top_3_share_percent).toFixed(2)}%
                  </strong>
                </div>

                <div>
                  <span>Cross-territory share</span>

                  <strong>{crossTerritory.toFixed(2)}%</strong>
                </div>
              </div>

              {doctorAnalysis?.summary && (
                <p className="insight-summary">{doctorAnalysis.summary}</p>
              )}
            </div>
          </div>
        </article>

        {/* =================================================
            PAYOUT
        ================================================= */}

        <article className="insight-card">
          <header className="insight-card-header">
            <div>
              <span className="insight-eyebrow">Incentive</span>

              <h3>Payout Validation</h3>
            </div>

            <span className={severityClass(payoutAnalysis?.severity)}>
              {payoutAnalysis?.severity ?? "UNKNOWN"}
            </span>
          </header>

          <div className="insight-body">
            <div className="insight-chart payout-chart">
              <ResponsiveContainer width="100%" height="80%">
                <BarChart
                  data={payoutData}
                  margin={{
                    top: 15,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tickFormatter={(value) => `₹${formatCompactMoney(value)}`}
                  />

                  <Tooltip
                    cursor={{
                      fill: "transparent",
                    }}
                    content={<MoneyTooltip />}
                  />

                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {payoutData.map((item) => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="payout-chart-difference">
                <span>Total Difference</span>

                <strong>
                  {totalPayoutDifference > 0 ? "+" : ""}

                  {formatMoney(totalPayoutDifference)}
                </strong>
              </div>
            </div>

            <div className="insight-text">
              <span className="ai-label">Validation Summary</span>

              <div className="insight-kpi-list">
                <div>
                  <span>Products checked</span>

                  <strong>{payoutFindings.length}</strong>
                </div>

                <div>
                  <span>Payout discrepancies</span>

                  <strong>{payoutMismatchCount}</strong>
                </div>

                <div>
                  <span>Net difference</span>

                  <strong>{formatMoney(totalPayoutDifference)}</strong>
                </div>
              </div>

              {payoutAnalysis?.summary && (
                <p className="insight-summary">{payoutAnalysis.summary}</p>
              )}
            </div>
          </div>
        </article>

        {/* =================================================
            OVERALL RISK
        ================================================= */}

        <article className="insight-card">
          <header className="insight-card-header">
            <div>
              <span className="insight-eyebrow">Overall</span>

              <h3>Investigation Risk</h3>
            </div>

            <span className={severityClass(result.overall_severity)}>
              {result.overall_severity}
            </span>
          </header>

          <div className="insight-body">
            <div className="insight-chart risk-chart">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="45%"
                  innerRadius="68%"
                  outerRadius="92%"
                  data={riskData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar dataKey="value" background cornerRadius={10} />

                  <Tooltip content={<PercentTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>

              <div className="risk-chart-center">
                <strong>{riskScore}</strong>

                <span>/100</span>
              </div>

              <div className="risk-findings-label">
                <strong>{riskFindingCount}</strong>

                <span>risk findings</span>
              </div>
            </div>

            <div className="insight-text">
              <span className="ai-label">Overall Assessment</span>

              <div className="insight-kpi-list">
                <div>
                  <span>Risk score</span>

                  <strong>{riskScore} / 100</strong>
                </div>

                <div>
                  <span>Risk findings</span>

                  <strong>{riskFindingCount}</strong>
                </div>

                <div>
                  <span>Review</span>

                  <strong>
                    {finalReport?.human_review_required ? "Required" : "Not Required"}
                  </strong>
                </div>
              </div>

              {finalReport?.overall_assessment && (
                <p className="insight-summary final-summary">{finalReport.overall_assessment}</p>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export default InvestigationInsights;
