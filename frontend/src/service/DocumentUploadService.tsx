import { useRef, useState } from "react";

import {
  confirmDocument,
  uploadDocuments,
  type DocumentProcessingResult,
} from "../api/documentProcessing";

interface ValidationError {
  file_name?: string;
  row_id: string | number;
  table?: string;
  column: string;
  value?: unknown;
  code?: string;
  message?: string;
}

export function useDocumentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [processing, setProcessing] = useState(false);

  /*
   * All uploaded documents.
   */
  const [results, setResults] = useState<DocumentProcessingResult[]>([]);

  /*
   * Kept for compatibility with your existing
   * DocumentProcessingCard.
   *
   * This is only the currently displayed result.
   */
  const [result, setResult] = useState<DocumentProcessingResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ==================================================
  // SELECT FOLDER
  // ==================================================

  function selectFolder() {
    inputRef.current?.click();
  }

  // ==================================================
  // PROCESS ALL FILES
  // ==================================================

  async function processFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setProcessing(true);

    setError(null);

    setResults([]);

    setResult(null);

    setValidationErrors([]);

    setSuccessMessage(null);

    try {
      console.log(`Uploading ${files.length} documents`);

      /*
       * One upload request is made for each file.
       */
      const uploadResults = await uploadDocuments(files);

      console.log("All upload results:", uploadResults);

      setResults(uploadResults);

      /*
       * Existing UI can display the first successfully
       * processed document.
       */
      const firstSuccessful = uploadResults.find((item) => item.success !== false);

      if (firstSuccessful) {
        setResult(firstSuccessful);
      }

      /*
       * Show all upload-level failures.
       */
      const failedResults = uploadResults.filter((item) => item.success === false);

      if (failedResults.length > 0) {
        setError(
          failedResults
            .map(
              (item) =>
                `${item.filename}: ${item.error ?? item.status ?? "Document processing failed"}`,
            )
            .join("\n"),
        );
      }
    } catch (err) {
      console.error("Document upload failed:", err);

      setError(getErrorMessage(err, "Document upload failed"));
    } finally {
      setProcessing(false);

      /*
       * Allows same folder to be selected again.
       */
      event.target.value = "";
    }
  }

  // ==================================================
  // CONFIRM ALL DOCUMENTS
  // ==================================================

  async function handleConfirm(
    requestedAction: "insert" | "overwrite_duplicates" | "discard_duplicates" | "cancel",
  ) {
    /*
     * Important:
     *
     * Confirm ALL successfully uploaded documents,
     * not just `result`.
     */
    const documentsToConfirm = results.filter(
      (item) =>
        item.success !== false &&
        item.action_required &&
        item.document_type &&
        item.target_table &&
        item.pending_data,
    );

    if (documentsToConfirm.length === 0) {
      setError("No documents are ready for import.");

      return;
    }

    setProcessing(true);

    setError(null);

    setValidationErrors([]);

    setSuccessMessage(null);

    let totalInserted = 0;

    let totalUpdated = 0;

    let totalDiscarded = 0;

    let successfulDocuments = 0;

    const failedDocuments: string[] = [];

    const collectedValidationErrors: ValidationError[] = [];

    /*
     * Sequential confirmation is intentional.
     *
     * Master records uploaded earlier can therefore
     * exist before later files are processed.
     */
    for (const documentResult of documentsToConfirm) {
      try {
        /*
         * Pick the correct action for each document.
         *
         * Example:
         *
         * User chooses "Overwrite Duplicates"
         *
         * document with duplicates -> overwrite_duplicates
         * document without duplicates -> insert
         */
        let action: "insert" | "overwrite_duplicates" | "discard_duplicates" | "cancel";

        if (requestedAction === "cancel") {
          action = "cancel";
        } else if (documentResult.has_duplicates) {
          if (requestedAction === "discard_duplicates") {
            action = "discard_duplicates";
          } else if (requestedAction === "overwrite_duplicates") {
            action = "overwrite_duplicates";
          } else {
            /*
             * An "insert" action cannot insert
             * documents containing duplicates.
             *
             * Leave those documents pending instead
             * of failing the whole batch.
             */
            console.log(`Skipping ${documentResult.filename}: duplicates require review`);

            continue;
          }
        } else {
          /*
           * No duplicates: always insert.
           */
          action = "insert";
        }

        console.log("Confirming:", documentResult.filename, action);

        const confirmation = await confirmDocument({
          document_type: documentResult.document_type,

          target_table: documentResult.target_table,

          action,

          pending_data: documentResult.pending_data,
        });

        totalInserted += confirmation.inserted;

        totalUpdated += confirmation.updated;

        totalDiscarded += confirmation.discarded;

        successfulDocuments += 1;

        console.log("Confirmed:", documentResult.filename, confirmation);
      } catch (err) {
        console.error(`Confirmation failed for ${documentResult.filename}:`, err);

        if (err && typeof err === "object") {
          const apiError = err as {
            type?: string;
            message?: string;
            errors?: ValidationError[];
          };

          if (apiError.type === "VALIDATION_ERROR" && Array.isArray(apiError.errors)) {
            collectedValidationErrors.push(
              ...apiError.errors.map((validationError) => ({
                ...validationError,

                file_name: validationError.file_name ?? documentResult.filename,
              })),
            );
          }

          failedDocuments.push(
            `${documentResult.filename}: ${apiError.message ?? "Confirmation failed"}`,
          );
        } else {
          failedDocuments.push(`${documentResult.filename}: Confirmation failed`);
        }
      }
    }

    // ==================================================
    // VALIDATION ERRORS
    // ==================================================

    if (collectedValidationErrors.length > 0) {
      setValidationErrors(collectedValidationErrors);
    }

    // ==================================================
    // FAILED DOCUMENTS
    // ==================================================

    if (failedDocuments.length > 0) {
      setError(failedDocuments.join("\n"));
    }

    // ==================================================
    // SUCCESS MESSAGE
    // ==================================================

    const summary: string[] = [];

    if (successfulDocuments > 0) {
      summary.push(
        `${successfulDocuments} document${successfulDocuments === 1 ? "" : "s"} processed`,
      );
    }

    if (totalInserted > 0) {
      summary.push(`${totalInserted} records inserted`);
    }

    if (totalUpdated > 0) {
      summary.push(`${totalUpdated} records updated`);
    }

    if (totalDiscarded > 0) {
      summary.push(`${totalDiscarded} duplicate records discarded`);
    }

    if (summary.length > 0) {
      setSuccessMessage(summary.join(", "));
    }

    /*
     * Remove successfully processed documents from
     * the pending list.
     *
     * For now, after a successful batch we clear all
     * documents unless there were failures.
     */
    if (failedDocuments.length === 0 && collectedValidationErrors.length === 0) {
      setResults([]);

      setResult(null);
    }

    setProcessing(false);
  }

  // ==================================================
  // CLEAR VALIDATION ERRORS
  // ==================================================

  function clearValidationErrors() {
    setValidationErrors([]);
  }

  // ==================================================
  // CLEAR SUCCESS MESSAGE
  // ==================================================

  function clearSuccessMessage() {
    setSuccessMessage(null);
  }

  return {
    inputRef,

    selectFolder,

    processFiles,

    processing,

    /*
     * Single result for current existing UI.
     */
    result,

    /*
     * All uploaded documents.
     */
    results,

    error,

    validationErrors,

    clearValidationErrors,

    handleConfirm,

    successMessage,

    clearSuccessMessage,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (typeof message === "string") {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
