import type {
  InvestigationResult,
} from "../types/investigation";


import {
  API_BASE_URL,
} from "./config";

export async function runInvestigation(
  representativeId: string,
  productId: string,
  month: string
): Promise<InvestigationResult> {

  const params =
    new URLSearchParams({

      representative_id:
        representativeId,

      product_id:
        productId,

      month,

    });


  const response =
    await fetch(
      `${API_BASE_URL}/api/investigation/ai-summary?${params}`
    );


  if (!response.ok) {

    throw new Error(
      `Investigation failed: ${response.status}`
    );

  }


  const data =
    await response.json();


  return {

    // deterministic investigation data
    representative_id:
      data.representative_id
      ??
      data.investigation?.representative_id,


    product_id:
      data.product_id
      ??
      data.investigation?.product_id,


    month:
      data.month
      ??
      data.investigation?.month,


    findings:
      data.findings
      ??
      data.investigation?.findings
      ??
      [],


    overall_risk_score:
      data.overall_risk_score
      ??
      data.investigation?.overall_risk_score
      ??
      0,


    overall_severity:
      data.overall_severity
      ??
      data.investigation?.overall_severity
      ??
      "NORMAL",


    // AI analysis
    sales_rx_analysis:
      data.sales_rx_analysis
      ??
      data.ai_analysis?.sales_rx_analysis
      ??
      {},


    doctor_territory_analysis:
      data.doctor_territory_analysis
      ??
      data.ai_analysis?.doctor_territory_analysis
      ??
      {},


    payout_analysis:
      data.payout_analysis
      ??
      data.ai_analysis?.payout_analysis
      ??
      {},


    final_report:
      data.final_report
      ??
      data.ai_analysis?.final_report
      ??
      {},

  };

}