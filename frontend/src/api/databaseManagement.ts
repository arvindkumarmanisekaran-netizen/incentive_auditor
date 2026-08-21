import { API_BASE_URL } from "../config";

async function fetchTable<T>(path: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return response.json();
}

export interface TerritoryRow {
  territory_id: string;
  territory_name: string;
  region: string;
  country: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface RepresentativeRow {
  representative_id: string;
  first_name: string;
  last_name: string;
  territory_id: string;
  joining_date: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductRow {
  product_id: string;
  product_name: string;
  product_category?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface DoctorRow {
  doctor_id: string;
  doctor_name: string;
  specialization?: string | null;
  territory_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssignmentRow {
  assignment_id: string;
  representative_id: string;
  doctor_id: string;
  effective_from: string;
  effective_to?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrescriptionRow {
  prescription_id: string;
  prescription_date: string;
  doctor_id: string;
  product_id: string;
  quantity: number;
  status: string;
  created_at?: string;
  updated_at?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface IncentivePayoutRow {
  payout_id: string;
  representative_id: string;
  product_id: string;
  payout_month: string;
  sales_target: number;
  actual_sales: number;
  sales_achievement: number;
  base_incentive: number;
  achievement_multiplier: number;
  calculated_payout: number;
  maximum_payout: number;
  expected_payout: number;
  actual_payout: number;
  payout_difference: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export async function getTerritories() {
  return fetchTable<TerritoryRow>("/api/territories");
}

export async function getDatabaseRepresentatives() {
  return fetchTable<RepresentativeRow>("/api/representatives");
}

export async function getProducts() {
  return fetchTable<ProductRow>("/api/products");
}

export async function getDoctors() {
  return fetchTable<DoctorRow>("/api/doctors");
}

export async function getAssignments() {
  return fetchTable<AssignmentRow>("/api/assignments");
}

export async function getPrescriptions() {
  return fetchTable<PrescriptionRow>("/api/prescriptions");
}

export async function getSales() {
  return fetchTable<SaleRow>("/api/sales");
}

export async function getPayouts() {
  return fetchTable<IncentivePayoutRow>("/api/incentive-payouts");
}
