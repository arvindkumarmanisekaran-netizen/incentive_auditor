import type { InvestigationResult } from "../types/investigation";

interface Props {
  result: InvestigationResult;
}

export default function InvestigationWorkflow({ result }: Props) {
  return (
    <div className="investigation-workflow">
      <h2>AI Investigation Workflow</h2>

      <div className="workflow-grid">
        <section>
          <h3>1. Investigation Plan</h3>

          <p>Priority: {result.investigation_plan?.priority ?? "—"}</p>

          <ul>
            {result.investigation_plan?.focus_areas?.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>2. Sales & Prescription Agent</h3>

          <strong>{result.sales_rx_analysis?.severity}</strong>

          <p>{result.sales_rx_analysis?.summary}</p>

          <ul>
            {result.sales_rx_analysis?.key_observations?.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>3. Doctor Territory Agent</h3>

          <strong>{result.doctor_territory_analysis?.severity}</strong>

          <p>{result.doctor_territory_analysis?.summary}</p>

          <ul>
            {result.doctor_territory_analysis?.key_observations?.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>4. Payout Validation Agent</h3>

          <strong>{result.payout_analysis?.severity}</strong>

          <p>{result.payout_analysis?.summary}</p>

          <ul>
            {result.payout_analysis?.key_observations?.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="final-ai-report">
        <h2>Final Investigation Assessment</h2>

        <p>{result.final_report?.overall_assessment}</p>

        <h3>Risk Drivers</h3>

        <ul>
          {result.final_report?.top_risk_drivers?.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>

        <h3>Recommended Actions</h3>

        <ul>
          {result.final_report?.recommended_actions?.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>

        {result.final_report?.human_review_required && (
          <div className="review-warning">Human review recommended</div>
        )}
      </section>
    </div>
  );
}
