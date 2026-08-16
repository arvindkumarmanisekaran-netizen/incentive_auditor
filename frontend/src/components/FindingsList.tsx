import type { Finding } from "../types/investigation";


type FindingsListProps = {
  findings: Finding[];
};


function FindingsList({
  findings,
}: FindingsListProps) {
  return (
    <section>
      <h2>Findings</h2>

      {findings.length === 0 && (
        <p>No findings available.</p>
      )}

      {findings.map((finding, index) => (
        <div
          key={`${finding.type}-${index}`}
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {finding.type}
            </h3>

            <strong>
              {finding.severity}
            </strong>
          </div>

          <div
            style={{
              marginTop: "12px",
            }}
          >
            <strong>Evidence</strong>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                background: "#f5f5f5",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              {JSON.stringify(
                finding.evidence,
                null,
                2
              )}
            </pre>
          </div>
        </div>
      ))}
    </section>
  );
}


export default FindingsList;