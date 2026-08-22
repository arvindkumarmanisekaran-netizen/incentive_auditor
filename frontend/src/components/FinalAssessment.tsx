import type { InvestigationResult } from "../types/investigation";

import SeverityBadge from "./SeverityBadge";

interface Props {
  result: InvestigationResult;
}

export default function FinalAssessment({ result }: Props) {
  const report = result.final_report;

  return (
    <section className="final-assessment-card">
      {/* =============================
          HEADER
      ============================= */}

      <div className="final-assessment-header">
        <h3>Final Assessment</h3>

        <SeverityBadge severity={report?.overall_severity} />
      </div>

      {/* =============================
          SUMMARY
      ============================= */}

      <p className="assessment-summary">{report?.overall_assessment}</p>

      {/* =============================
          RISK DRIVERS
      ============================= */}

      <div className="assessment-section">
        <h4>Main Risk Drivers</h4>

        <div className="assessment-list">
          {report?.top_risk_drivers?.map((item, index) => (
            <div key={index} className="assessment-item risk">
              <span>⚠</span>

              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* =============================
          ACTIONS
      ============================= */}

      <div className="assessment-section">
        <h4>Recommended Actions</h4>

        <div className="assessment-list">
          {report?.recommended_actions?.map((item, index) => (
            <div key={index} className="assessment-item action">
              <span>✓</span>

              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* =============================
          HUMAN REVIEW
      ============================= */}

      {report?.human_review_required && (
        <div className="review-warning">Human review recommended</div>
      )}
    </section>
  );
}
