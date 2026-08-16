export type Finding = {
  type: string;
  severity: string;
  evidence: Record<string, unknown>;
};

export type SpecialistAnalysis = {
  severity?: string;
  summary?: string;
  key_observations?: string[];
  investigation_priority?: string;
};

export type FinalReport = {
  overall_assessment?: string;
  overall_severity?: string;
  top_risk_drivers?: string[];

  specialist_summary?: {
    sales_rx?: string;
    doctor_territory?: string;
    payout?: string;
  };

  recommended_actions?: string[];
  human_review_required?: boolean;
};

export type InvestigationResult = {
  representative_id: string;
  product_id: string;
  month: string;

  overall_risk_score: number;
  overall_severity: string;

  findings: Finding[];

  sales_rx_analysis?: SpecialistAnalysis;
  doctor_territory_analysis?: SpecialistAnalysis;
  payout_analysis?: SpecialistAnalysis;

  final_report?: FinalReport;
};


