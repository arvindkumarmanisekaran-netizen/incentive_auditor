import { API_BASE_URL } from "./config";

export type Representative = {
  representative_id: string;
  first_name: string;
  last_name: string;
  territory_id: string;
  territory_name: string;
  status: string;
};

export async function getRepresentatives(): Promise<Representative[]> {
  const response = await fetch(`${API_BASE_URL}/api/representatives`);

  if (!response.ok) {
    throw new Error("Failed to load representatives");
  }

  return response.json();
}
