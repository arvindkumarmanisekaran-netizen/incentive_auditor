export const SUPPORTED_EXTENSIONS = [
  "xlsx",
  "csv",
  "json",
  "xml",
] as const;

// 2. Derive the type from the array (equivalent to "xlsx" | "csv" | "json" | "xml")
export type SupportedDocumentType = typeof SUPPORTED_EXTENSIONS[number];


export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
}