import type { Finding } from "../../types/investigation";

import { AnimateOnView } from "../AnimateOnView";

import { DynamicPieChart } from "./DynamicPieChart";

type Props = {
  findings?: Finding[];
};

const DOCTOR_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#F59E0B",
  "#7C3AED",
  "#0891B2",
  "#EA580C",
  "#DB2777",
];

const TERRITORY_COLORS = ["#0891B2", "#F97316", "#4F46E5", "#65A30D", "#E11D48", "#9333EA"];

export default function BehaviourAnalysis({ findings = [] }: Props) {
  const doctorFinding = findings.find((finding) => finding.type === "doctor_concentration");

  const territoryFinding = findings.find(
    (finding) =>
      finding.type === "cross_territory_concentration" || finding.type === "territory_distribution",
  );

  const doctorData = (
    (doctorFinding?.evidence.doctor_breakdown as Array<{
      doctor_name: string;
      sales: number;
    }>) ?? []
  ).map((item, index) => ({
    ...item,
    fill: DOCTOR_COLORS[index % DOCTOR_COLORS.length],
  }));

  const territoryData = (
    (territoryFinding?.evidence.territory_breakdown as Array<{
      territory_name: string;
      sales: number;
    }>) ?? []
  ).map((item, index) => ({
    ...item,
    fill: TERRITORY_COLORS[index % TERRITORY_COLORS.length],
  }));

  return (
    <section className="analysis-panel overall-behaviour-section">
      <div className="analysis-panel-header analysis-section-header">
        <div>
          <h3>Overall Behaviour</h3>

          <p>Cross-product doctor and territory behaviour</p>
        </div>

        <span className="overall-scope-badge">ALL PRODUCTS</span>
      </div>

      <div className="analysis-chart-grid overall-behaviour-grid">
        {/* DOCTOR */}

        <div className="chart-card">
          <div className="chart-heading">
            <h3>Doctor Concentration</h3>

            <p>Sales contribution by doctor</p>
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

            <p>Attributed sales by territory</p>
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
