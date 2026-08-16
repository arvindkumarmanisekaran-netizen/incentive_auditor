export type Evidence = {
  [key: string]: unknown;
};


export type Finding = {
  type: string;
  severity: string;
  evidence: Evidence;
};


export type SpecialistAnalysis = {
  severity: string;
  summary: string;
  key_observations: string[];
  investigation_priority: string;
};


export type InvestigationPriority = {
  priority: number;
  finding_type: string;
  reason: string;
};


export type FinalReport = {
  overall_assessment: string;
  key_findings: string[];
  investigation_priorities: InvestigationPriority[];
  recommended_next_action: string;
};


export type InvestigationResult = {
  representative_id: string;
  product_id: string;
  month: string;

  overall_risk_score: number;
  overall_severity: string;

  findings: Finding[];

  sales_rx_analysis: SpecialistAnalysis;
  doctor_territory_analysis: SpecialistAnalysis;
  payout_analysis: SpecialistAnalysis;

  final_report: FinalReport;
};