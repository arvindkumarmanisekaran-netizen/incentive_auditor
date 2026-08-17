import type { InvestigationResult } from "../types/investigation";

import { API_BASE_URL } from "./config";

export async function runInvestigation(
  representativeId: string,
  productId: string,
  month: string
): Promise<InvestigationResult> {
  const params = new URLSearchParams({
    representative_id: representativeId,
    product_id: productId,
    month,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/investigation/ai-summary?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `Investigation failed: ${response.status}`
    );
  }

  return response.json();
}