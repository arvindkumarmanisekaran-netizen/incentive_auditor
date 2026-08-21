import { API_BASE_URL } from "./config";
export interface DocumentProcessingResult {
  filename: string;

  success: boolean;

  status: string;

  document_type?: string;

  target_table?: string;

  classification_confidence?: number;

  total_records?: number;

  new_record_count?: number;

  duplicate_record_count?: number;

  has_duplicates?: boolean;

  action_required?: boolean;

  available_actions?: string[];

  column_mapping?: unknown;

  validation?: unknown;

  pending_data?: {
    duplicate_keys: string[];

    new_records: Record<string, unknown>[];

    duplicate_records: DuplicateRecord[];
  };

  error?: string;
}

export interface DuplicateRecord {
  row: number;

  incoming_record: Record<string, unknown>;

  existing_record: Record<string, unknown>;
}

export async function uploadDocument(file: File): Promise<DocumentProcessingResult> {
  const formData = new FormData();

  formData.append("document", file);

  const response = await fetch(`${API_BASE_URL}/document-processing/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();

    const detail = error.detail;

    if (detail?.errors && Array.isArray(detail.errors)) {
      throw {
        type: "VALIDATION_ERROR",

        message: detail.message ?? "Dependency validation failed",

        errors: detail.errors,
      };
    }

    throw {
      type: "API_ERROR",

      message:
        typeof detail === "string" ? detail : (detail?.message ?? "Document confirmation failed"),
    };
  }

  return response.json();
}

export async function confirmDocument(payload: unknown) {
  const response = await fetch(`${API_BASE_URL}/document-processing/confirm`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const detail = data.detail;

    if (detail?.errors && Array.isArray(detail.errors)) {
      throw {
        type: "VALIDATION_ERROR",

        message: detail.message ?? "Dependency validation failed",

        errors: detail.errors,
      };
    }

    throw {
      type: "API_ERROR",

      message:
        typeof detail === "string" ? detail : (detail?.message ?? "Document confirmation failed"),

      errors: [],
    };
  }

  return {
    success: data.success ?? false,

    status: data.status ?? "completed",

    action: data.action ?? payload,

    inserted: data.inserted ?? 0,

    updated: data.updated ?? 0,

    discarded: data.discarded ?? 0,

    message: data.message ?? buildSuccessMessage(data),

    raw: data,
  };
}

function buildSuccessMessage(data: any): string {
  if (data.status === "cancelled") {
    return "Document import cancelled";
  }

  const inserted = data.inserted ?? 0;

  const updated = data.updated ?? 0;

  const discarded = data.discarded ?? 0;

  const parts: string[] = [];

  if (inserted > 0) {
    parts.push(`${inserted} records inserted`);
  }

  if (updated > 0) {
    parts.push(`${updated} records updated`);
  }

  if (discarded > 0) {
    parts.push(`${discarded} duplicate records discarded`);
  }

  if (!parts.length) {
    return "Document processed successfully";
  }

  return parts.join(", ");
}
