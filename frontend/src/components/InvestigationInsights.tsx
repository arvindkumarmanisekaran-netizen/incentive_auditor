import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  InvestigationResult,
} from "../types/investigation";

import "../App.css";


type Props = {
  result: InvestigationResult;
};


/* =========================================================
   HELPERS
========================================================= */

function severityClass(
  severity?: string
) {
  return `severity-badge severity-${
    (severity ?? "unknown").toLowerCase()
  }`;
}


function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}


function safeNumber(
  value: unknown
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function InvestigationInsights({
  result,
}: Props) {

  /* =======================================================
     FINDINGS
  ======================================================= */

  const salesFinding =
    result.findings.find(
      (finding) =>
        finding.type ===
        "sales_deviation"
    );


  const mismatchFinding =
    result.findings.find(
      (finding) =>
        finding.type ===
        "sales_prescription_mismatch"
    );


  const doctorFinding =
    result.findings.find(
      (finding) =>
        finding.type ===
        "doctor_concentration"
    );


  const territoryFinding =
    result.findings.find(
      (finding) =>
        finding.type ===
        "cross_territory_concentration"
    );


  const payoutFinding =
    result.findings.find(
      (finding) =>
        finding.type ===
        "payout_discrepancy"
    );


  /* =======================================================
     SALES / RX
  ======================================================= */

  const salesChange =
    safeNumber(
      salesFinding?.evidence
        ?.deviation_percent ??
      salesFinding?.evidence
        ?.percentage_deviation ??
      mismatchFinding?.evidence
        ?.sales_change_percent
    );


  const rxChange =
    safeNumber(
      mismatchFinding?.evidence
        ?.prescription_change_percent ??
      mismatchFinding?.evidence
        ?.rx_change_percent
    );


  const salesRxData = [
    {
      name: "Sales",
      change: salesChange,
    },
    {
      name: "Prescriptions",
      change: rxChange,
    },
  ];


  /* =======================================================
     DOCTOR / TERRITORY
  ======================================================= */

  const doctorConcentration =
    safeNumber(
      doctorFinding?.evidence
        ?.top_doctor_percentage ??
      doctorFinding?.evidence
        ?.top_doctor_concentration ??
      doctorFinding?.evidence
        ?.concentration_percentage
    );


  const crossTerritory =
    safeNumber(
      territoryFinding?.evidence
        ?.cross_territory_percentage ??
      territoryFinding?.evidence
        ?.cross_territory_percent ??
      territoryFinding?.evidence
        ?.outside_territory_percentage
    );


  const concentrationData = [
    {
      name: "Top Doctor",
      value: doctorConcentration,
      fill: "#7c3aed",
    },
    {
      name: "Cross Territory",
      value: crossTerritory,
      fill: "#0891b2",
    },
  ];


  /* =======================================================
     PAYOUT
  ======================================================= */

  const expectedPayout =
    safeNumber(
      payoutFinding?.evidence
        ?.expected_payout
    );


  const actualPayout =
    safeNumber(
      payoutFinding?.evidence
        ?.actual_payout
    );


  const payoutDifference =
    safeNumber(
      payoutFinding?.evidence
        ?.payout_difference
    );


  const payoutData = [
    {
      name: "Expected",
      amount: expectedPayout,
      fill: "#64748b",
    },
    {
      name: "Actual",
      amount: actualPayout,
      fill: "#2563eb",
    },
  ];


  /* =======================================================
     RISK
  ======================================================= */

  const riskScore =
    Math.min(
      Math.max(
        safeNumber(
          result.overall_risk_score
        ),
        0
      ),
      100
    );


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


  const riskFindingCount =
    result.findings.filter(
      (finding) =>
        finding.severity !== "NORMAL" &&
        finding.severity !== "UNKNOWN"
    ).length;


  /* =======================================================
     AI ANALYSIS
  ======================================================= */

  const salesAnalysis =
    result.sales_rx_analysis;

  const doctorAnalysis =
    result.doctor_territory_analysis;

  const payoutAnalysis =
    result.payout_analysis;

  const finalReport =
    result.final_report;


  return (
    <section className="insights-section">

      <div className="section-heading">
        <h2>
          Investigation Insights
        </h2>

        <p>
          Visual evidence with AI-assisted interpretation
        </p>
      </div>


      <div className="insights-grid">

        {/* =================================================
            SALES / PRESCRIPTION
        ================================================= */}

        <article className="insight-card">

          <header className="insight-card-header">

            <div>
              <span className="insight-eyebrow">
                Performance
              </span>

              <h3>
                Sales / Prescription
              </h3>
            </div>

            <span
              className={severityClass(
                salesAnalysis?.severity
              )}
            >
              {salesAnalysis?.severity ??
                "UNKNOWN"}
            </span>

          </header>


          <div className="insight-body">

            {/* CHART */}

            <div className="insight-chart">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={salesRxData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: -15,
                    bottom: 5,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tickFormatter={(
                      value
                    ) => `${value}%`}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      `${Number(
                        value
                      ).toFixed(1)}%`,
                      "Change",
                    ]}
                  />

                  <Bar
                    dataKey="change"
                    fill="#2563eb"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>


            {/* AI TEXT */}

            <div className="insight-text">

              <span className="ai-label">
                AI Interpretation
              </span>

              <p className="insight-summary">
                {salesAnalysis?.summary ??
                  "No Sales/Rx analysis available."}
              </p>

              <div className="compact-observations">

                {salesAnalysis
                  ?.key_observations
                  ?.slice(0, 2)
                  .map(
                    (
                      observation,
                      index
                    ) => (

                      <div
                        className="compact-observation"
                        key={index}
                      >
                        <span />

                        <p>
                          {observation}
                        </p>
                      </div>

                    )
                  )}

              </div>

            </div>

          </div>

        </article>


        {/* =================================================
            DOCTOR / TERRITORY
        ================================================= */}

        <article className="insight-card">

          <header className="insight-card-header">

            <div>
              <span className="insight-eyebrow">
                Concentration
              </span>

              <h3>
                Doctor / Territory
              </h3>
            </div>

            <span
              className={severityClass(
                doctorAnalysis?.severity
              )}
            >
              {doctorAnalysis?.severity ??
                "UNKNOWN"}
            </span>

          </header>


          <div className="insight-body">

            {/* CHART */}

            <div className="insight-chart concentration-chart">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="25%"
                  outerRadius="90%"
                  barSize={18}
                  data={concentrationData}
                  startAngle={90}
                  endAngle={-270}
                >

                  <RadialBar
                    dataKey="value"
                    background
                    cornerRadius={8}
                  />

                  <Legend
                    iconSize={9}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      `${Number(
                        value
                      ).toFixed(1)}%`,
                      "Concentration",
                    ]}
                  />

                </RadialBarChart>

              </ResponsiveContainer>


              <div className="chart-center-label">
                <strong>
                  {doctorConcentration.toFixed(
                    0
                  )}
                  %
                </strong>

                <span>
                  Top Doctor
                </span>
              </div>

            </div>


            {/* AI TEXT */}

            <div className="insight-text">

              <span className="ai-label">
                AI Interpretation
              </span>

              <p className="insight-summary">
                {doctorAnalysis?.summary ??
                  "No doctor or territory analysis available."}
              </p>

              <div className="compact-observations">

                {doctorAnalysis
                  ?.key_observations
                  ?.slice(0, 2)
                  .map(
                    (
                      observation,
                      index
                    ) => (

                      <div
                        className="compact-observation"
                        key={index}
                      >
                        <span />

                        <p>
                          {observation}
                        </p>
                      </div>

                    )
                  )}

              </div>

            </div>

          </div>

        </article>


        {/* =================================================
            PAYOUT
        ================================================= */}

        <article className="insight-card">

          <header className="insight-card-header">

            <div>
              <span className="insight-eyebrow">
                Incentive
              </span>

              <h3>
                Payout Analysis
              </h3>
            </div>

            <span
              className={severityClass(
                payoutAnalysis?.severity
              )}
            >
              {payoutAnalysis?.severity ??
                "UNKNOWN"}
            </span>

          </header>


          <div className="insight-body">

            {/* CHART */}

            <div className="insight-chart payout-chart">

              <ResponsiveContainer
                width="100%"
                height="80%"
              >

                <BarChart
                  data={payoutData}
                  margin={{
                    top: 15,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tickFormatter={(
                      value
                    ) =>
                      `₹${Math.round(
                        value / 1000
                      )}k`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatMoney(
                        Number(value)
                      ),
                      "Payout",
                    ]}
                  />

                  <Bar
                    dataKey="amount"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>


              <div className="payout-chart-difference">

                <span>
                  Difference
                </span>

                <strong>
                  {payoutDifference > 0
                    ? "+"
                    : ""}

                  {formatMoney(
                    payoutDifference
                  )}
                </strong>

              </div>

            </div>


            {/* AI TEXT */}

            <div className="insight-text">

              <span className="ai-label">
                AI Interpretation
              </span>

              <p className="insight-summary">
                {payoutAnalysis?.summary ??
                  "No payout analysis available."}
              </p>

              <div className="compact-observations">

                {payoutAnalysis
                  ?.key_observations
                  ?.slice(0, 2)
                  .map(
                    (
                      observation,
                      index
                    ) => (

                      <div
                        className="compact-observation"
                        key={index}
                      >
                        <span />

                        <p>
                          {observation}
                        </p>
                      </div>

                    )
                  )}

              </div>

            </div>

          </div>

        </article>


        {/* =================================================
            FINAL ASSESSMENT
        ================================================= */}

        <article className="insight-card">

          <header className="insight-card-header">

            <div>
              <span className="insight-eyebrow">
                Overall
              </span>

              <h3>
                Final Assessment
              </h3>
            </div>

            <span
              className={severityClass(
                result.overall_severity
              )}
            >
              {result.overall_severity}
            </span>

          </header>


          <div className="insight-body">

            {/* RISK CHART */}

            <div className="insight-chart risk-chart">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <RadialBarChart
                  cx="50%"
                  cy="45%"
                  innerRadius="68%"
                  outerRadius="92%"
                  barSize={20}
                  data={riskData}
                  startAngle={90}
                  endAngle={-270}
                >

                  <RadialBar
                    dataKey="value"
                    background
                    cornerRadius={10}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      `${value}/100`,
                      "Risk Score",
                    ]}
                  />

                </RadialBarChart>

              </ResponsiveContainer>


              <div className="risk-chart-center">

                <strong>
                  {riskScore}
                </strong>

                <span>
                  /100
                </span>

              </div>


              <div className="risk-findings-label">

                <strong>
                  {riskFindingCount}
                </strong>

                <span>
                  risk findings
                </span>

              </div>

            </div>


            {/* AI TEXT */}

            <div className="insight-text">

              <span className="ai-label">
                AI Assessment
              </span>

              <p className="insight-summary final-summary">
                {finalReport
                  ?.overall_assessment ??
                  "No final assessment available."}
              </p>


              {finalReport
                ?.recommended_next_action && (

                <div className="recommended-action">

                  <span>
                    Recommended Action
                  </span>

                  <p>
                    {
                      finalReport
                        .recommended_next_action
                    }
                  </p>

                </div>

              )}

            </div>

          </div>

        </article>

      </div>

    </section>
  );
}


export default InvestigationInsights;