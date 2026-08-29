import type { EChartsCoreOption } from "echarts/core";
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import SignalChart, { SIGNAL_CHART } from "./charts/SignalChart";

import type { InvestigationResult } from "../types/investigation";
import {
  formatProductLabel,
  productLabelFromFinding,
  replaceProductIds,
  replaceRepresentativeId,
} from "../utils/displayLabels";

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

function formatExactMoney(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  }).format(Number(value));
}

function formatExactNumber(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 20,
  }).format(Number(value));
}

function safeNumber(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function insightBarOption(
  categories: string[],
  series: Array<{ name: string; values: number[]; color: string }>,
  formatter: "percent" | "money",
  hideCategoryLabels = false,
): EChartsCoreOption {
  return {
    legend: { top: 0, textStyle: { color: SIGNAL_CHART.text, fontSize: 9 } },
    grid: { top: 36, right: 8, bottom: 18, left: 16 },
    tooltip: {
      valueFormatter: (value: unknown) => formatter === "percent" ? `${formatExactNumber(value)}%` : formatExactMoney(value),
    },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { show: !hideCategoryLabels },
      axisLine: { show: true, lineStyle: { color: "rgba(37,99,235,.42)", width: 1.25 } },
    },
    yAxis: {
      type: "value",
      min: (range: { min: number }) => Math.min(0, range.min),
      max: (range: { max: number }) => Math.max(0, range.max),
      axisLine: {
        show: true,
        onZero: true,
        lineStyle: { color: "rgba(37,99,235,0.24)", width: 1 },
      },
      axisLabel: formatter === "percent"
        ? { formatter: "{value}%", inside: false, margin: 7 }
        : { formatter: (value: number) => `₹${formatCompactMoney(value)}`, inside: false, margin: 7 },
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
        `<strong>${label}</strong><br/>${formatExactNumber(params.value ?? 0)}%`,
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
  const payoutBreakdownScrollRef = useRef<HTMLDivElement | null>(null);
  const payoutBreakdownDragRef = useRef({
    dragging: false,
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  function handlePayoutBreakdownPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, summary")) return;

    const container = payoutBreakdownScrollRef.current;
    if (!container) return;

    payoutBreakdownDragRef.current = {
      dragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    container.classList.add("is-dragging");
    container.setPointerCapture(event.pointerId);
  }

  function handlePayoutBreakdownPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const container = payoutBreakdownScrollRef.current;
    const state = payoutBreakdownDragRef.current;
    if (!container || !state.dragging || state.pointerId !== event.pointerId) return;

    container.scrollLeft = state.scrollLeft - (event.clientX - state.startX);
    container.scrollTop = state.scrollTop - (event.clientY - state.startY);
  }

  function stopPayoutBreakdownDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const container = payoutBreakdownScrollRef.current;
    const state = payoutBreakdownDragRef.current;
    if (state.pointerId !== event.pointerId) return;

    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    container?.classList.remove("is-dragging");
    payoutBreakdownDragRef.current.dragging = false;
    payoutBreakdownDragRef.current.pointerId = null;
  }
  const findings = result.findings ?? [];
  const displayText = (value: string) => replaceRepresentativeId(
    replaceProductIds(value, findings),
    result.representative_name,
    result.representative_id,
  );

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
      productId,
      product: productLabelFromFinding(mismatchFinding),
      productName: String(
        mismatchFinding.product_name ?? mismatchFinding.evidence?.product_name ?? "",
      ),

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

  const topDoctorName = String(
    doctorFinding?.evidence?.top_doctor_name ??
      (doctorFinding?.evidence?.doctor_breakdown as Array<{ doctor_name?: string }> | undefined)?.[0]
        ?.doctor_name ??
      "Top Doctor",
  );

  const crossTerritory = safeNumber(territoryFinding?.evidence?.cross_territory_share_percent);

  /* =======================================================
     PAYOUT
  ======================================================= */

  const payoutFindings = findings.filter((finding) => finding.type === "payout_discrepancy");

  const payoutRecordFindings = payoutFindings.filter(
    (finding) => finding.evidence?.include_in_payout_totals !== false,
  );

  const totalExpectedPayout = payoutRecordFindings.reduce(
    (total, finding) => total + safeNumber(finding.evidence?.expected_payout),
    0,
  );

  const totalActualPayout = payoutRecordFindings.reduce(
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
    (finding) =>
      (finding.evidence?.discrepancy_subtypes as unknown[] | undefined)?.length ||
      Math.abs(safeNumber(finding.evidence?.payout_difference)) > 0,
  ).length;

  const payoutProductsChecked = new Set(
    payoutRecordFindings.map((finding) => String(finding.product_id ?? "")),
  ).size;

  const payoutBreakdowns = payoutRecordFindings.map((finding) => {
    const evidence = finding.evidence ?? {};
    const programId = String(evidence.incentive_program_id ?? "").trim();

    return {
      key: String(evidence.payout_id ?? `${finding.product_id}-${evidence.payout_month}`),
      product: productLabelFromFinding(finding),
      month: String(evidence.payout_month ?? "—"),
      program: programId || "Default fallback",
      period:
        evidence.incentive_program_start_date && evidence.incentive_program_end_date
          ? `${evidence.incentive_program_start_date} – ${evidence.incentive_program_end_date}`
          : "No matching program",
      programProducts: String(
        evidence.incentive_program_products_display ??
          evidence.incentive_program_products ??
          "—",
      ),
      tier: String(evidence.incentive_program_tier_id ?? "Default bands"),
      tierRange:
        evidence.tier_minimum_achievement !== null &&
        evidence.tier_minimum_achievement !== undefined
          ? `${formatExactNumber(evidence.tier_minimum_achievement)}% – ${
              evidence.tier_maximum_achievement === null ||
              evidence.tier_maximum_achievement === undefined
                ? "No maximum"
                : `${formatExactNumber(evidence.tier_maximum_achievement)}%`
            }`
          : "Global fallback schedule",
      percentage: safeNumber(evidence.cap_percentage || 150),
      attributedSales: safeNumber(evidence.attributed_actual_sales),
      baseIncentive: safeNumber(evidence.calculated_base_incentive),
      multiplier: safeNumber(evidence.calculated_achievement_multiplier),
      calculatedPayout: safeNumber(evidence.independently_calculated_payout),
      maximumPayout: safeNumber(evidence.calculated_maximum_payout),
      expectedPayout: safeNumber(evidence.reconstructed_expected_payout),
      actualPayout: safeNumber(evidence.actual_payout),
      ruleSource: String(evidence.cap_rule_source ?? "Default fallback: 150% of base incentive"),
    };
  });

  const appliedPrograms = Array.from(
    new Map(
      payoutBreakdowns.map((item) => [
        `${item.program}-${item.percentage}-${item.period}`,
        item,
      ]),
    ).values(),
  );

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
                  salesRxData.map((item) => formatProductLabel(item.productName, item.productId)),
                  [
                    { name: "Sales change", values: salesRxData.map((item) => item.salesChange), color: COLORS.sales },
                    { name: "Prescription change", values: salesRxData.map((item) => item.prescriptionChange), color: COLORS.prescription },
                  ],
                  "percent",
                  true,
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

              {salesAnalysis?.summary && <p className="insight-summary">{displayText(salesAnalysis.summary)}</p>}
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
              <SignalChart option={gaugeOption(doctorConcentration, COLORS.doctor, topDoctorName)} ariaLabel="Doctor concentration" />
            </div>

            <div className="insight-text">
              <span className="ai-label">Evidence Summary</span>

              <div className="insight-kpi-list">
                <div>
                  <span>Top doctor share · {topDoctorName}</span>

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
                <p className="insight-summary">{displayText(doctorAnalysis.summary)}</p>
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

                  <strong>{payoutProductsChecked}</strong>
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

              <div className="payout-program-summary">
                <span className="ai-label">Applied Incentive Programs</span>

                <div className="payout-program-chips">
                  {appliedPrograms.map((item) => (
                    <div key={`${item.program}-${item.percentage}-${item.period}`}>
                      <strong>{item.program}</strong>
                      <span>{formatExactNumber(item.percentage)}% cap</span>
                      <small>{item.period}</small>
                    </div>
                  ))}
                </div>
              </div>

              {payoutBreakdowns.length > 0 && (
                <details className="payout-breakdown" open>
                  <summary>Incentive calculation breakup ({payoutBreakdowns.length})</summary>

                  <div
                    ref={payoutBreakdownScrollRef}
                    className="payout-breakdown-table-wrap"
                    onPointerDown={handlePayoutBreakdownPointerDown}
                    onPointerMove={handlePayoutBreakdownPointerMove}
                    onPointerUp={stopPayoutBreakdownDrag}
                    onPointerCancel={stopPayoutBreakdownDrag}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Month</th>
                          <th>Program</th>
                          <th>Program products</th>
                          <th>Program tier</th>
                          <th>Achievement band</th>
                          <th>Cap</th>
                          <th>Attributed sales</th>
                          <th>Base incentive</th>
                          <th>Achievement multiplier</th>
                          <th>Calculated payout</th>
                          <th>Maximum payout</th>
                          <th>Expected payout</th>
                          <th>Actual payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutBreakdowns.map((item) => (
                          <tr key={item.key} title={item.ruleSource}>
                            <td>{item.product}</td>
                            <td>{item.month}</td>
                            <td>{item.program}</td>
                            <td>{item.programProducts}</td>
                            <td>{item.tier}</td>
                            <td>{item.tierRange}</td>
                            <td>{formatExactNumber(item.percentage)}%</td>
                            <td>{formatMoney(item.attributedSales)}</td>
                            <td>{formatMoney(item.baseIncentive)}</td>
                            <td>{formatExactNumber(item.multiplier)}×</td>
                            <td>{formatMoney(item.calculatedPayout)}</td>
                            <td>{formatMoney(item.maximumPayout)}</td>
                            <td>{formatMoney(item.expectedPayout)}</td>
                            <td>{formatMoney(item.actualPayout)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {payoutAnalysis?.summary && (
                <p className="insight-summary">{displayText(payoutAnalysis.summary)}</p>
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
                <p className="insight-summary final-summary">{displayText(finalReport.overall_assessment)}</p>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export default InvestigationInsights;
