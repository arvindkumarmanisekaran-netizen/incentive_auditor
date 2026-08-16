import type { SpecialistAnalysis as SpecialistAnalysisType } from "../types/investigation";


type SpecialistAnalysisProps = {
  title: string;
  analysis?: SpecialistAnalysisType;
};


function SpecialistAnalysis({
  title,
  analysis,
}: SpecialistAnalysisProps) {
  if (!analysis) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <h2 style={{ margin: 0 }}>
          {title}
        </h2>

        <strong>
          {analysis.severity ?? "UNKNOWN"}
        </strong>
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