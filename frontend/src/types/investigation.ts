export interface FindingEvidence {
  [key: string]: any;
}


export interface Finding {

  type: string;

  severity: string;

  evidence: FindingEvidence;

}



export interface AIAnalysis {

  severity?: string;

  summary?: string;

  key_observations?: string[];

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

    product_id: string;

    month: string;


    findings: Finding[];


    overall_risk_score: number;

    overall_severity: string;


    sales_rx_analysis?: AIAnalysis;

    doctor_territory_analysis?: AIAnalysis;

    payout_analysis?: AIAnalysis;

    final_report?: FinalReport;
}