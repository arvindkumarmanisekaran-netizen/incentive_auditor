import "../App.css";
import type { SpecialistAnalysis as SpecialistAnalysisType } from "../types/investigation";

type SpecialistAnalysisProps = {
  title: string;
  analysis?: SpecialistAnalysisType;
};

function severityClass(severity?: string) {
  return `severity severity-${(
    severity ?? "unknown"
  ).toLowerCase()}`;
}

function SpecialistAnalysis({
  title,
  analysis,
}: SpecialistAnalysisProps) {
  if (!analysis) {
    return null;
  }

  return (
    <section className="analysis-card">
      <div className="card-header">
        <h2>{title}</h2>

        <span
          className={severityClass(
            analysis.severity
          )}
        >
          {analysis.severity ?? "UNKNOWN"}
        </span>
      </div>

      {analysis.summary && (
        <>
          <h3>Summary</h3>
          <p>{analysis.summary}</p>
        </>
      )}

      {analysis.key_observations &&
        analysis.key_observations.length > 0 && (
          <>
            <h3>Key Observations</h3>

            <ul>
              {analysis.key_observations.map(
                (item, index) => (
                  <li key={index}>
                    {item}
                  </li>
                )
              )}
            </ul>
          </>
        )}

      {analysis.investigation_priority && (
        <>
          <h3>Investigation Priority</h3>
          <p>
            {analysis.investigation_priority}
          </p>
        </>
      )}
    </section>
  );
}

export default SpecialistAnalysis;