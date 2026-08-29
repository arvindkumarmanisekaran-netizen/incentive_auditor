import type { Finding } from "../../types/investigation";

import { AnimateOnView } from "../AnimateOnView";

import { DynamicPieChart } from "./DynamicPieChart";

type Props = {
  findings?: Finding[];
};

const DOCTOR_COLORS = [
  "#64d8b4",
  "#DC2626",
  "#16A34A",
  "#F59E0B",
  "#8fc95a",
  "#0891B2",
  "#EA580C",
  "#FF766E",
];

const TERRITORY_COLORS = ["#B9FF66", "#64D8B4", "#F5C96A", "#7AAE72", "#FF766E", "#A8CFA3"];

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatPercent(value?: number) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export default function BehaviourAnalysis({ findings = [] }: Props) {
  const doctorFinding = findings.find((finding) => finding.type === "doctor_concentration");

  const territoryFinding = findings.find(
    (finding) =>
      finding.type === "cross_territory_concentration" || finding.type === "territory_distribution",
  );

  const doctorEvidence = doctorFinding?.evidence ?? {};

  const territoryEvidence = territoryFinding?.evidence ?? {};

  const doctorData = (
    (doctorEvidence.doctor_breakdown as Array<{
      doctor_name: string;
      sales: number;
    }>) ?? []
  ).map((item, index) => ({
    ...item,
    fill: DOCTOR_COLORS[index % DOCTOR_COLORS.length],
  }));

  const territoryData = (
    (territoryEvidence.territory_breakdown as Array<{
      territory_name: string;
      sales: number;
    }>) ?? []
  ).map((item, index) => ({
    ...item,
    fill: TERRITORY_COLORS[index % TERRITORY_COLORS.length],
  }));

  const topDoctorName = String(
    doctorEvidence.top_doctor_name ?? doctorData[0]?.doctor_name ?? "Top Doctor",
  );

  return (
    <section className="analysis-panel overall-behaviour-section">
      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Doctor &amp; Territory Behaviour</h3>

          <p>Cross-product concentration and territory activity for the investigation period</p>
        </div>

        <span className="overall-scope-badge">ALL PRODUCTS</span>
      </div>

      {/* ==================================================
          KPI SUMMARY
      ================================================== */}

      <div className="behaviour-summary-grid">
        <div className="behaviour-summary-card">
          <span>Total Sales</span>

          <strong>
            {formatMoney(Number(doctorEvidence.total_sales ?? territoryEvidence.total_sales ?? 0))}
          </strong>
        </div>

        <div className="behaviour-summary-card">
          <span>Top Doctor Share</span>

          <strong>{formatPercent(Number(doctorEvidence.top_doctor_share_percent ?? 0))}</strong>

          <small>{doctorFinding?.severity ?? "NORMAL"}</small>

          <small>{topDoctorName}</small>
        </div>

        <div className="behaviour-summary-card">
          <span>Top 3 Doctor Share</span>

          <strong>{formatPercent(Number(doctorEvidence.top_3_share_percent ?? 0))}</strong>
        </div>

        <div className="behaviour-summary-card">
          <span>Cross-Territory Sales</span>

          <strong>{formatMoney(Number(territoryEvidence.cross_territory_sales ?? 0))}</strong>

          <small>
            {formatPercent(Number(territoryEvidence.cross_territory_share_percent ?? 0))} of total
            sales
          </small>
        </div>
      </div>

      {/* ==================================================
          CHARTS
      ================================================== */}

      <div className="analysis-chart-grid overall-behaviour-grid">
        {/* DOCTOR */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Doctor Concentration</h3>

            <p>Sales contribution across assigned doctors</p>
          </div>

          <div className="chart-container pie-chart-container">
            <AnimateOnView>
              <DynamicPieChart data={doctorData} dataKey="sales" nameKey="doctor_name" />
            </AnimateOnView>
          </div>
        </div>

        {/* TERRITORY */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Territory Distribution</h3>

            <p>Home territory versus cross-territory attributed sales</p>
          </div>

          <div className="chart-container pie-chart-container">
            <AnimateOnView>
              <DynamicPieChart data={territoryData} dataKey="sales" nameKey="territory_name" />
            </AnimateOnView>
          </div>
        </div>
      </div>
    </section>
  );
}
