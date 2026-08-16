type RiskSummaryProps = {
  representativeId: string;
  productId: string;
  month: string;
  riskScore: number;
  severity: string;
};


function RiskSummary({
  representativeId,
  productId,
  month,
  riskScore,
  severity,
}: RiskSummaryProps) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <strong>Representative</strong>
        <div>{representativeId}</div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <strong>Product</strong>
        <div>{productId}</div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <strong>Month</strong>
        <div>{month}</div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <strong>Risk Score</strong>
        <div>{riskScore}</div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <strong>Severity</strong>
        <div>{severity}</div>
      </div>
    </section>
  );
}


export default RiskSummary;