import { useState } from "react";
import { runInvestigation } from "./api/investigation";
import type { InvestigationResult } from "./types/investigation";
import InvestigationForm from "./components/InvestigationForm";
import RiskSummary from "./components/RiskSummary";
import FindingsList from "./components/FindingsList";
import SpecialistAnalysis from "./components/SpecialistAnalysis";
import FinalReport from "./components/FinalReport";

function App() {
  const [representativeId, setRepresentativeId] = useState("FR001");
  const [productId, setProductId] = useState("P001");
  const [month, setMonth] = useState("2026-07");

  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInvestigation() {
    setLoading(true);
    setError(null);

    try {
      const data = await runInvestigation(
        representativeId,
        productId,
        month
      );

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <h1>Incentive Auditor</h1>

      <p>
        AI-assisted pharmaceutical field representative incentive investigation
      </p>

       <InvestigationForm
        representativeId={representativeId}
        productId={productId}
        month={month}
        loading={loading}
        onRepresentativeChange={setRepresentativeId}
        onProductChange={setProductId}
        onMonthChange={setMonth}
        onSubmit={handleInvestigation}
      />

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {result && (
        <>
           <RiskSummary
            representativeId={result.representative_id}
            productId={result.product_id}
            month={result.month}
            riskScore={result.overall_risk_score}
            severity={result.overall_severity}
          />

        <FindingsList
          findings={result.findings}
        />

          <SpecialistAnalysis
            title="Sales / Prescription Analysis"
            analysis={result.sales_rx_analysis}
          />

          <SpecialistAnalysis
            title="Doctor / Territory Analysis"
            analysis={result.doctor_territory_analysis}
          />

          <SpecialistAnalysis
            title="Payout Analysis"
            analysis={result.payout_analysis}
          />

          <FinalReport
          report={result.final_report}
        />
        </>
      )}
    </main>
  );
}

export default App;