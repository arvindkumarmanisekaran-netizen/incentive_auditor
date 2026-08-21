import { API_BASE_URL } from "../config";

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
    file_name?: string;

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

export interface DocumentProcessingApiError {
  type: "VALIDATION_ERROR" | "API_ERROR";

  message: string;

  errors?: unknown[];

  filename?: string;
}

export interface ConfirmationResult {
  success: boolean;

  status: string;

  action: unknown;

  inserted: number;

  updated: number;

  discarded: number;

  message: string;

  raw: Record<string, unknown>;
}

/**
 * Upload a single document.
 *
 * Backend expects:
 *
 * document: UploadFile
 */
export async function uploadDocument(file: File): Promise<DocumentProcessingResult> {
  const formData = new FormData();

  formData.append("document", file, file.name);

  const response = await fetch(`${API_BASE_URL}/api/document-processing/upload`, {
    method: "POST",

    // Do NOT manually set Content-Type here.
    // Browser must generate multipart/form-data boundary.
    body: formData,
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw buildApiError(data, file.name, "Document upload failed");
  }

  return {
    ...(data as DocumentProcessingResult),

    filename: (data as DocumentProcessingResult).filename ?? file.name,
  };
}

/**
 * Upload multiple documents.
 *
 * The existing backend endpoint handles one document,
 * so each file is sent as its own request.
 *
 * Processing sequentially is intentional:
 * files can depend on records inserted by an earlier file
 * and it avoids concurrent DB/import conflicts.
 */
export async function uploadDocuments(files: File[]): Promise<DocumentProcessingResult[]> {
  if (files.length === 0) {
    return [];
  }

  const results: DocumentProcessingResult[] = [];

  for (const file of files) {
    try {
      const result = await uploadDocument(file);

      results.push(result);
    } catch (error) {
      const apiError = normalizeApiError(error, file.name);

      results.push({
        filename: file.name,

        success: false,

        status: "failed",

        error: apiError.message,
      });
    }
  }

  return results;
}

/**
 * Optional strict version.
 *
 * Use this if you want multi-upload to stop immediately
 * when one file fails.
 */
export async function uploadDocumentsStrict(files: File[]): Promise<DocumentProcessingResult[]> {
  const results: DocumentProcessingResult[] = [];

  for (const file of files) {
    const result = await uploadDocument(file);

    results.push(result);
  }

  return results;
}

export async function confirmDocument(payload: unknown): Promise<ConfirmationResult> {
  const response = await fetch(`${API_BASE_URL}/api/document-processing/confirm`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw buildApiError(data, undefined, "Document confirmation failed");
  }

  const result = data as Record<string, unknown>;

  return {
    success: typeof result.success === "boolean" ? result.success : false,

    status: typeof result.status === "string" ? result.status : "completed",

    action: result.action ?? payload,

    inserted: toNumber(result.inserted),

    updated: toNumber(result.updated),

    discarded: toNumber(result.discarded),

    message: typeof result.message === "string" ? result.message : buildSuccessMessage(result),

    raw: result,
  };
}

/**
 * Safely read API response.
 *
 * This avoids secondary errors if FastAPI/Nginx returns
 * plain text or an empty response body.
 */
async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      detail: text,
    };
  }
}

function buildApiError(
  data: unknown,
  filename?: string,
  fallback = "Request failed",
): DocumentProcessingApiError {
  if (data && typeof data === "object") {
    const objectData = data as {
      detail?: unknown;
    };

    const detail = objectData.detail;

    if (detail && typeof detail === "object") {
      const detailObject = detail as {
        message?: unknown;
        errors?: unknown;
      };

      if (Array.isArray(detailObject.errors)) {
        return {
          type: "VALIDATION_ERROR",

          message:
            typeof detailObject.message === "string"
              ? detailObject.message
              : "Dependency validation failed",

          errors: detailObject.errors,

          filename,
        };
      }

      if (typeof detailObject.message === "string") {
        return {
          type: "API_ERROR",

          message: detailObject.message,

          errors: [],

          filename,
        };
      }
    }

    if (typeof detail === "string") {
      return {
        type: "API_ERROR",

        message: detail,

        errors: [],

        filename,
      };
    }

    const message = (
      data as {
        message?: unknown;
      }
    ).message;

    if (typeof message === "string") {
      return {
        type: "API_ERROR",

        message,

        errors: [],

        filename,
      };
    }
  }

  return {
    type: "API_ERROR",

    message: fallback,

    errors: [],

    filename,
  };
}

function normalizeApiError(error: unknown, filename?: string): DocumentProcessingApiError {
  if (error && typeof error === "object" && "type" in error && "message" in error) {
    const apiError = error as DocumentProcessingApiError;

    return {
      ...apiError,

      filename: apiError.filename ?? filename,
    };
  }

  if (error instanceof Error) {
    return {
      type: "API_ERROR",

      message: error.message,

      errors: [],

      filename,
    };
  }

  return {
    type: "API_ERROR",

    message: "Document upload failed",

    errors: [],

    filename,
  };
}

function buildSuccessMessage(data: Record<string, unknown>): string {
  if (data.status === "cancelled") {
    return "Document import cancelled";
  }

  const inserted = toNumber(data.inserted);

  const updated = toNumber(data.updated);

  const discarded = toNumber(data.discarded);

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

  if (parts.length === 0) {
    return "Document processed successfully";
  }

  return parts.join(", ");
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}
