import type { FinalReport as FinalReportType } from "../types/investigation";


type FinalReportProps = {
  report?: FinalReportType;
};


function FinalReport({
  report,
}: FinalReportProps) {
  if (!report) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "20px",
        marginTop: "24px",
      }}
    >
      <h2>Final AI Assessment</h2>

      {report.overall_assessment && (
        <>
          <h3>Overall Assessment</h3>
          <p>{report.overall_assessment}</p>
        </>
      )}

      {report.overall_severity && (
        <>
          <h3>Overall Severity</h3>
          <p>
            <strong>{report.overall_severity}</strong>
          </p>
        </>
      )}

      {report.top_risk_drivers &&
        report.top_risk_drivers.length > 0 && (
          <>
            <h3>Top Risk Drivers</h3>

            <ul>
              {report.top_risk_drivers.map(
                (item, index) => (
                  <li key={index}>
                    {item}
                  </li>
                )
              )}
            </ul>
          </>
        )}

      {report.specialist_summary && (
        <>
          <h3>Specialist Summary</h3>

          {report.specialist_summary.sales_rx && (
            <>
              <strong>Sales / Prescription</strong>
              <p>
                {report.specialist_summary.sales_rx}
              </p>
            </>
          )}

          {report.specialist_summary.doctor_territory && (
            <>
              <strong>Doctor / Territory</strong>
              <p>
                {report.specialist_summary.doctor_territory}
              </p>
            </>
          )}

          {report.specialist_summary.payout && (
            <>
              <strong>Payout</strong>
              <p>
                {report.specialist_summary.payout}
              </p>
            </>
          )}
        </>
      )}

      {report.recommended_actions &&
        report.recommended_actions.length > 0 && (
          <>
            <h3>Recommended Actions</h3>

            <ol>
              {report.recommended_actions.map(
                (item, index) => (
                  <li key={index}>
                    {item}
                  </li>
                )
              )}
            </ol>
          </>
        )}

      {typeof report.human_review_required === "boolean" && (
        <>
          <h3>Human Review Required</h3>

          <p>
            <strong>
              {report.human_review_required
                ? "Yes"
                : "No"}
            </strong>
          </p>
        </>
      )}
    </section>
  );
}


export default FinalReport;