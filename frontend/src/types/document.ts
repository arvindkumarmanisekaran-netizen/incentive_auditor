export const SUPPORTED_EXTENSIONS = ["xlsx", "csv", "json", "docx"] as const;

// 2. Derive the type from the array (equivalent to "xlsx" | "csv" | "json" | "docx")
export type SupportedDocumentType = (typeof SUPPORTED_EXTENSIONS)[number];

export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
}
