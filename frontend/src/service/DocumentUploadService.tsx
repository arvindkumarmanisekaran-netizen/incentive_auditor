import { useRef, useState } from "react";

import { isSupportedDocumentType } from "../common/utils";

import { uploadDocument, confirmDocument } from "../api/documentProcessing";

import type { DocumentProcessingResult } from "../api/documentProcessing";

export function useDocumentUpload() {
  type ValidationError = {
    row_id: number;
    table: string;
    column: string;
    value: string;
  };

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [processing, setProcessing] = useState(false);

  const [result, setResult] = useState<DocumentProcessingResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  function clearValidationErrors() {
    setValidationErrors([]);
  }

  function selectFolder() {
    inputRef.current?.click();
  }

  async function processFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    const validFiles = files.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

      return isSupportedDocumentType(extension);
    });

    if (validFiles.length === 0) {
      return;
    }

    try {
      setProcessing(true);

      setError(null);

      // For now process one document.
      // Later we can support batch mode.

      const response = await uploadDocument(validFiles[0]);

      setResult(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm(action: "insert" | "overwrite_duplicates" | "discard_duplicates") {
    if (!result?.pending_data || !result.document_type || !result.target_table) {
      return;
    }

    try {
      await confirmDocument({
        document_type: result.document_type,

        target_table: result.target_table,

        action,

        pending_data: result.pending_data,
      });

      // clear successful import state

      setResult(null);

      setValidationErrors([]);

      setError(null);
    } catch (err: any) {
      console.error("Document confirmation failed:", err);

      if (err.type === "VALIDATION_ERROR") {
        setValidationErrors(err.errors ?? []);

        return;
      }

      setError(err.message ?? "Document import failed");
    }
  }

  console.log("RENDER POPUP ERRORS", validationErrors.length);
  return {
    inputRef,
    selectFolder,
    processFiles,
    processing,
    result,
    error,
    validationErrors,
    clearValidationErrors,
    handleConfirm,
  };
}
