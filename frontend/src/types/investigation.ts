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

export interface ProductMetric {
  sales: number;

  rx: number;

  payout: number;
}

export interface AIAnalysis {
  severity?: string;

  anomaly_detected?: boolean;

  summary?: string;

  evidence_summary?: string[];

  key_observations?: string[];

  limitations?: string[];

  investigation_priority?: string;

  product_metrics?: Record<string, ProductMetric>;
}

export interface PeerChartData {
  product_id: string;

  product_name: string;

  representative_sales: number;

  peer_average_sales: number;

  representative_rx: number;

  peer_average_rx: number;

  representative_payout: number;

  peer_average_payout: number;

  peer_group_size: number;
}

export interface PeerProductComparison {
  product_id: string;

  product_name: string;

  representative_name?: string;

  comparison_available: boolean;

  peer_group_size: number;

  representative: {
    sales: number;
    rx: number;
    payout: number;
  };

  peer_average: {
    sales: number;
    rx: number;
    payout: number;
  };

  difference_percentage: {
    sales: number;
    rx: number;
    payout: number;
  };

  peer_distribution: {
    representative_id: string;
    representative_name: string;
    sales: number;
    rx: number;
    payout: number;
  }[];

  observations: string[];

  severity: string;

  anomaly_detected: boolean;
}

export interface PeerComparison {
  comparison_available: boolean;

  peer_group_size: number;

  product_count: number;

  products: Record<string, PeerProductComparison>;

  chart_data: PeerChartData[];

  observations: string[];

  severity: string;

  anomaly_detected: boolean;
}

export interface PeerAnalysis {
  territory_peer_comparison: PeerComparison;

  product_peer_comparison: PeerComparison;

  peer_group_size: number;

  severity: string;

  anomaly_detected: boolean;
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

  peer_analysis?: string;

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

  peer_analysis?: PeerAnalysis;
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
