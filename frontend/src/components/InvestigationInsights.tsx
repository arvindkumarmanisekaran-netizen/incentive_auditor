import type { EChartsCoreOption } from "echarts/core";
import SignalChart, { SIGNAL_CHART } from "./charts/SignalChart";

import type { InvestigationResult } from "../types/investigation";

import "../styles/index.css";

type Props = {
  result: InvestigationResult;
};

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  sales: SIGNAL_CHART.lime,
  prescription: SIGNAL_CHART.mint,
  expected: SIGNAL_CHART.steel,
  actual: SIGNAL_CHART.lime,
  doctor: SIGNAL_CHART.lime,
  territory: SIGNAL_CHART.mint,
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

function getProductName(finding: unknown) {
  const record = finding as {
    product_name?: string;
    product_id?: string;
    evidence?: { product_name?: string };
  };
  return record?.product_name ?? record?.evidence?.product_name ?? record?.product_id ?? "";
}

function insightBarOption(
  categories: string[],
  series: Array<{ name: string; values: number[]; color: string }>,
  formatter: "percent" | "money",
): EChartsCoreOption {
  return {
    legend: { top: 0, textStyle: { color: SIGNAL_CHART.text, fontSize: 9 } },
    grid: { top: 36, right: 8, bottom: 14, left: 8 },
    tooltip: {
      valueFormatter: (value: unknown) => formatter === "percent" ? `${Number(value).toFixed(2)}%` : formatMoney(Number(value)),
    },
    xAxis: { type: "category", data: categories },
    yAxis: {
      type: "value",
      min: (range: { min: number }) => Math.min(0, range.min),
      max: (range: { max: number }) => Math.max(0, range.max),
      axisLine: {
        show: true,
        onZero: true,
        lineStyle: { color: "rgba(37,99,235,0.24)", width: 1 },
      },
      axisLabel: formatter === "percent" ? { formatter: "{value}%" } : { formatter: (value: number) => `₹${formatCompactMoney(value)}` },
    },
    series: series.map((item) => ({
      type: "bar",
      name: item.name,
      data: item.values.map((value) => ({
        value,
        itemStyle: {
          color: item.color,
          borderRadius: value >= 0 ? [5, 5, 1, 1] : [1, 1, 5, 5],
        },
      })),
      barMaxWidth: 38,
      itemStyle: { color: item.color },
    })),
  };
}

function gaugeOption(value: number, color: string, label: string): EChartsCoreOption {
  return {
    tooltip: {
      trigger: "item",
      formatter: (params: { value?: number }) =>
        `<strong>${label}</strong><br/>${Number(params.value ?? 0).toFixed(1)}%`,
    },
    series: [{
      type: "gauge",
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      radius: "88%",
      progress: { show: true, width: 10, roundCap: true, itemStyle: { color } },
      axisLine: { lineStyle: { width: 10, color: [[1, "rgba(37,99,235,.08)"]] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      anchor: { show: false },
      title: { offsetCenter: [0, "34%"], color: SIGNAL_CHART.text, fontSize: 9 },
      detail: { valueAnimation: true, formatter: "{value}%", color: SIGNAL_CHART.textStrong, fontSize: 24, fontWeight: 500, offsetCenter: [0, "-2%"] },
      data: [{ value, name: label }],
    }],
  };
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

  const riskColor =
    riskScore >= 75
      ? SIGNAL_CHART.danger
      : riskScore >= 50
        ? SIGNAL_CHART.amber
        : riskScore >= 25
          ? SIGNAL_CHART.mint
          : SIGNAL_CHART.lime;

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
              <SignalChart
                option={insightBarOption(
                  salesRxData.map((item) => item.product),
                  [
                    { name: "Sales change", values: salesRxData.map((item) => item.salesChange), color: COLORS.sales },
                    { name: "Prescription change", values: salesRxData.map((item) => item.prescriptionChange), color: COLORS.prescription },
                  ],
                  "percent",
                )}
                ariaLabel="Sales and prescription changes"
              />
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
              <SignalChart option={gaugeOption(doctorConcentration, COLORS.doctor, "Top doctor")} ariaLabel="Doctor concentration" />
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
              <SignalChart
                option={insightBarOption(
                  payoutData.map((item) => item.name),
                  [{ name: "Payout", values: payoutData.map((item) => item.amount), color: COLORS.actual }],
                  "money",
                )}
                height="80%"
                ariaLabel="Payout validation"
              />

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
              <SignalChart option={gaugeOption(riskScore, riskColor, "Risk score")} ariaLabel="Investigation risk score" />

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
