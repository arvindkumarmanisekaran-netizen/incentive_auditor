import { API_BASE_URL } from "../config";

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
  program_id?: string | null;
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

export interface PaginatedResponse<T> {
  records: T[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchPage<T>(path: string, limit = 50, offset = 0): Promise<PaginatedResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    throw new Error(
      typeof errorData?.detail === "string"
        ? errorData.detail
        : `Failed to load records (${response.status})`,
    );
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== "object" ||
    !("records" in data) ||
    !Array.isArray((data as PaginatedResponse<T>).records)
  ) {
    console.error("Invalid pagination response:", path, data);

    throw new Error(`Invalid paginated response returned from ${path}`);
  }

  const page = data as PaginatedResponse<T>;

  return {
    records: page.records,
    total: Number(page.total ?? 0),
    limit: Number(page.limit ?? limit),
    offset: Number(page.offset ?? offset),
  };
}

export function getDatabaseRepresentatives(limit = 50, offset = 0) {
  return fetchPage<RepresentativeRow>("/api/representatives", limit, offset);
}

export function getTerritories(limit = 50, offset = 0) {
  return fetchPage<TerritoryRow>("/api/territories", limit, offset);
}

export function getProducts(limit = 50, offset = 0) {
  return fetchPage<ProductRow>("/api/products", limit, offset);
}

export function getDoctors(limit = 50, offset = 0) {
  return fetchPage<DoctorRow>("/api/doctors", limit, offset);
}

export function getAssignments(limit = 50, offset = 0) {
  return fetchPage<AssignmentRow>("/api/assignments", limit, offset);
}

export function getPrescriptions(limit = 50, offset = 0) {
  return fetchPage<PrescriptionRow>("/api/prescriptions", limit, offset);
}

export function getSales(limit = 50, offset = 0) {
  return fetchPage<SaleRow>("/api/sales", limit, offset);
}

export function getPayouts(limit = 50, offset = 0) {
  return fetchPage<IncentivePayoutRow>("/api/incentive-payouts", limit, offset);
}
