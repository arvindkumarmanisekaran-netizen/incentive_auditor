export interface FindingEvidence {
  [key: string]: any;
}

export interface Finding {
  type: string;

  severity: string;

  product_id?: string;

  evidence: FindingEvidence;
}

export interface InvestigationPlan {
  focus_areas?: string[];

  priority?: string;

  reasoning?: string[];
}

export interface AIAnalysis {
  severity?: string;

  anomaly_detected?: boolean;

  summary?: string;

  evidence_summary?: string[];

  key_observations?: string[];

  limitations?: string[];

  investigation_priority?: string;
}
export interface FinalReport {
  overall_assessment?: string;

  overall_severity?: string;

  top_risk_drivers?: string[];

  specialist_summary?: {
    sales_rx?: string;

    doctor_territory?: string;

    payout?: string;
  };

  recommended_actions?: string[];

  recommended_next_action?: string;

  human_review_required?: boolean;
}
export interface InvestigationResult {
  representative_id: string;

  start_date: string;

  end_date: string;

  products_analyzed: string[];

  findings: Finding[];

  overall_risk_score: number;

  overall_severity: string;

  investigation_plan?: InvestigationPlan;

  sales_rx_analysis?: AIAnalysis;

  doctor_territory_analysis?: AIAnalysis;

  payout_analysis?: AIAnalysis;

  final_report?: FinalReport;

  investigation_summary?: InvestigationSummary;
}

export interface InvestigationSummary {
  executive_summary?: string;

  key_findings?: string[];

  investigation_priorities?: InvestigationPriority[];

  recommended_next_actions?: string[];

  human_review_required?: boolean;
}

export interface InvestigationPriority {
  priority: number;

  area: string;

  reason: string;
}
