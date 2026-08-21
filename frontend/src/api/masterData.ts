import { API_BASE_URL } from "../config";

export interface Representative {
  representative_id: string;
  first_name: string;
  last_name: string;
  territory_id: string;
  joining_date: string;
  status: string;
}

export async function getRepresentatives(): Promise<Representative[]> {
  const response = await fetch(`${API_BASE_URL}/api/representatives/all`);

  if (!response.ok) {
    throw new Error("Failed to load representatives");
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid representatives response");
  }

  return data;
}
