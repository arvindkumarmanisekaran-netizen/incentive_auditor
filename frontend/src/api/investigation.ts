import type { InvestigationResult } from "../types/investigation";

import { API_BASE_URL } from "../config";

export async function runInvestigation(
  representativeId: string,
  startDate: string,
  endDate: string,
): Promise<InvestigationResult> {
  const params = new URLSearchParams({
    representative_id: representativeId,

    start_date: startDate,

    end_date: endDate,
  });

  const response = await fetch(`${API_BASE_URL}/api/investigation/ai-summary?${params}`);

  if (!response.ok) {
    throw new Error(`Investigation failed: ${response.status}`);
  }

  const data = await response.json();

  const investigation = data.investigation ?? data;

  return {
    representative_id: investigation.representative_id ?? representativeId,

    start_date: investigation.start_date ?? startDate,

    end_date: investigation.end_date ?? endDate,

    products_analyzed: investigation.products_analyzed ?? [],

    findings: investigation.findings ?? [],

    overall_risk_score: investigation.overall_risk_score ?? 0,

    overall_severity: investigation.overall_severity ?? "NORMAL",

    sales_rx_analysis: investigation.sales_rx_analysis ?? {},

    doctor_territory_analysis: investigation.doctor_territory_analysis ?? {},

    payout_analysis: investigation.payout_analysis ?? {},

    final_report: investigation.final_report ?? {},
  };
}
