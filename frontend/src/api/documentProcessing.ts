const API_BASE_URL =
  "http://localhost:8000/api";


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

    duplicate_records: Record<string, unknown>[];

  };


  error?: string;

}



export async function uploadDocument(
  file: File,
): Promise<DocumentProcessingResult> {


  const formData =
    new FormData();


  formData.append(
    "document",
    file,
  );


  const response =
    await fetch(
      `${API_BASE_URL}/document-processing/upload`,
      {
        method: "POST",
        body: formData,
      },
    );


  if (!response.ok) {

    const error =
      await response.json();

    throw new Error(
      error.detail ??
      "Document upload failed",
    );

  }


  return response.json();

}



export async function confirmDocument(
  payload: unknown,
) {


  const response =
    await fetch(
      `${API_BASE_URL}/document-processing/confirm`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );


  if (!response.ok) {

    const error =
      await response.json();

    throw new Error(
      error.detail ??
      "Document confirmation failed",
    );

  }


  return response.json();

}