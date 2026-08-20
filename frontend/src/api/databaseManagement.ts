const API_BASE_URL = "http://localhost:8000";

async function fetchTable<T>(path: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  return response.json();
}

export interface RepresentativeRow {
  representative_id: string;
  first_name: string;
  last_name: string;
  territory_id: string;
  joining_date: string;
  status: string;
}

export interface DoctorRow {
  doctor_id: string;
  doctor_name: string;
  specialization?: string;
  territory_id: string;
  status: string;
}

export interface ProductRow {
  product_id: string;
  product_name: string;
  product_category?: string;
  status: string;
}

export interface TerritoryRow {
  territory_id: string;
  territory_name: string;
  region: string;
  country: string;
  status: string;
}

export interface AssignmentRow {
  assignment_id: string;
  representative_id: string;
  doctor_id: string;
  effective_from: string;
  effective_to?: string | null;
  status: string;
}

export interface ProgramRow {
  program_id: string;
  program_name: string;
  period_type: string;
  effective_from: string;
  effective_to?: string | null;
  minimum_sales_achievement: number;
  maximum_payout_multiplier: number;
  status: string;
}

export interface PayoutRow {
  payout_id: string;
  representative_id: string;
  product_id: string;
  program_id: string;
  payout_month: string;
  sales_target: number;
  actual_sales: number;
  expected_payout: number;
  actual_payout: number;
  payout_difference: number;
  status: string;
}

export interface SaleRow {
  sale_id: string;
  sale_date: string;
  doctor_id: string;
  product_id: string;
  selling_territory_id: string;
  quantity: number;
  sales_amount: number;
  status: string;
}

export interface PrescriptionRow {
  prescription_id: string;
  prescription_date: string;
  doctor_id: string;
  product_id: string;
  quantity: number;
  status: string;
}

export interface SalesTargetRow {
  target_id: string;
  representative_id: string;
  product_id: string;
  target_month: string;
  target_amount: number;
  status: string;
}

export interface IncentiveTierRow {
  tier_id: string;
  program_id: string;
  minimum_achievement: number;
  maximum_achievement?: number | null;
  payout_multiplier: number;
}

export interface ProductIncentiveRateRow {
  rate_id: string;
  program_id: string;
  product_id: string;
  incentive_rate: number;
}

export function getSalesTargets() {
  return fetchTable<SalesTargetRow>("/api/sales-targets");
}

export function getIncentiveTiers() {
  return fetchTable<IncentiveTierRow>("/api/incentive-tiers");
}

export function getProductIncentiveRates() {
  return fetchTable<ProductIncentiveRateRow>("/api/product-incentive-rates");
}

export function getSales() {
  return fetchTable<SaleRow>("/api/sales");
}

export function getPrescriptions() {
  return fetchTable<PrescriptionRow>("/api/prescriptions");
}
export function getDatabaseRepresentatives() {
  return fetchTable<RepresentativeRow>("/api/representatives");
}

export function getDoctors() {
  return fetchTable<DoctorRow>("/api/doctors");
}

export function getProducts() {
  return fetchTable<ProductRow>("/api/products");
}

export function getTerritories() {
  return fetchTable<TerritoryRow>("/api/territories");
}

export function getAssignments() {
  return fetchTable<AssignmentRow>("/api/assignments");
}

export function getPrograms() {
  return fetchTable<ProgramRow>("/api/incentive-programs");
}

export function getPayouts() {
  return fetchTable<PayoutRow>("/api/incentive-payouts");
}
