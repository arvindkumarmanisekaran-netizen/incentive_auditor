import type { InvestigationResult } from "../types/investigation";
import { useState } from "react";
import SeverityBadge from "./SeverityBadge";
import FinalAssessment from "./FinalAssessment";

interface Props {
  result: InvestigationResult;
}

export default function InvestigationWorkflow({ result }: Props) {
  const [expanded, setExpanded] = useState(false);

  const plan = result.investigation_plan;

  const sales = result.sales_rx_analysis;

  const doctor = result.doctor_territory_analysis;

  const payout = result.payout_analysis;

  const report = result.final_report;

  return (
    <div className="investigation-workflow">
      <div className="workflow-header">
        <h2>Detailed AI Investigation</h2>

        <button type="button" className="workflow-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Details ▲" : "View Detailed Analysis ▼"}
        </button>
      </div>

      {expanded && (
        <>
          {/* ============================
            EXECUTIVE SUMMARY
        ============================ */}

          <section className="workflow-summary-card">
            <div>
              <h3>Overall Risk</h3>

              <SeverityBadge severity={result.overall_severity} />
            </div>

            <div>
              <h3>Representative</h3>

              <p>{result.representative_id}</p>
            </div>

            <div>
              <h3>Investigation Period</h3>

              <p>
                {result.start_date} to {result.end_date}
              </p>
            </div>
          </section>

          {/* ============================
            INVESTIGATION PLAN
        ============================ */}

          <section className="workflow-card">
            <h3>Investigation Areas Reviewed</h3>

            <p>
              Priority: <strong>{plan?.priority ?? "N/A"}</strong>
            </p>

            <div className="tag-container">
              {plan?.focus_areas?.map((area) => (
                <span key={area} className="workflow-tag">
                  {area.replace("_", " ")}
                </span>
              ))}
            </div>
          </section>

          {/* ============================
            SPECIALIST REVIEWS
        ============================ */}

          <section className="workflow-grid">
            <div className="workflow-card">
              <h3>Sales & Prescription Review</h3>

              <SeverityBadge severity={sales?.severity} />

              <p>{sales?.summary}</p>

              <h4>Key Observations</h4>

              <ul>
                {sales?.key_observations?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="workflow-card">
              <h3>Doctor & Territory Review</h3>

              <SeverityBadge severity={doctor?.severity} />

              <p>{doctor?.summary}</p>

              <ul>
                {doctor?.key_observations?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="workflow-card">
              <h3>Payout Validation</h3>

              <SeverityBadge severity={payout?.severity} />

              <p>{payout?.summary}</p>

              <ul>
                {payout?.key_observations?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* ============================
            FINAL ASSESSMENT
        ============================ */}
          <FinalAssessment result={result} />
        </>
      )}
    </div>
  );
}
