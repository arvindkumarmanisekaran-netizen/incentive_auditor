import { useMemo, useState } from "react";

import { useDocumentUpload } from "../service/DocumentUploadService";

import type { DocumentProcessingResult } from "../api/documentProcessing";

type ConfirmAction = "insert" | "overwrite_duplicates" | "discard_duplicates" | "cancel";

export default function DocumentProcessingCard() {
  const {
    inputRef,
    selectFolder,
    processFiles,
    processing,

    // Keep result for compatibility with the service.
    result,

    // All uploaded documents.
    results,

    error,
    validationErrors,
    clearValidationErrors,
    handleConfirm,
    successMessage,
    clearSuccessMessage,
  } = useDocumentUpload();

  // ==================================================
  // LOCAL UI STATE
  // ==================================================

  const [confirming, setConfirming] = useState(false);

  const [duplicateResult, setDuplicateResult] = useState<DocumentProcessingResult | null>(null);

  // ==================================================
  // ALL DOCUMENTS
  // ==================================================

  /*
   * Prefer the full results array.
   *
   * Fall back to the old single result so this
   * component still behaves correctly if only
   * one document was uploaded.
   */
  const documents = useMemo(() => {
    if (results && results.length > 0) {
      return results;
    }

    if (result) {
      return [result];
    }

    return [];
  }, [results, result]);

  const successfulDocuments = useMemo(
    () => documents.filter((item) => item.success !== false),
    [documents],
  );

  const failedDocuments = useMemo(
    () => documents.filter((item) => item.success === false),
    [documents],
  );

  const documentsWithDuplicates = useMemo(
    () => successfulDocuments.filter((item) => item.has_duplicates),
    [successfulDocuments],
  );

  const documentsWithoutDuplicates = useMemo(
    () => successfulDocuments.filter((item) => !item.has_duplicates),
    [successfulDocuments],
  );

  const hasDocuments = documents.length > 0;

  const hasDuplicates = documentsWithDuplicates.length > 0;

  /*
   * Upload processing OR database confirmation.
   */
  const busy = processing || confirming;

  // ==================================================
  // CONFIRM
  // ==================================================

  async function confirmDocuments(action: ConfirmAction) {
    /*
     * Immediately close any open duplicate window.
     */
    setDuplicateResult(null);

    /*
     * Immediately hide document cards/popups and
     * show only the animated processing component.
     */
    setConfirming(true);

    try {
      await handleConfirm(action);
    } finally {
      setConfirming(false);
    }
  }

  // ==================================================
  // DUPLICATE DETAILS
  // ==================================================

  function showDuplicates(document: DocumentProcessingResult) {
    setDuplicateResult(document);
  }

  function closeDuplicates() {
    setDuplicateResult(null);
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <article className="admin-card">
      <div className="admin-card-icon">📁</div>

      <div className="admin-card-content">
        <h3>Document Processing</h3>

        <p>
          Upload structured documents. The system identifies the target database table, maps
          columns, validates records and detects duplicates.
        </p>

        <div className="admin-card-meta">
          <span>CSV</span>
          <span>JSON</span>
          <span>XLSX</span>
          <span>DOCX</span>
        </div>

        {/* ==================================================
            PROCESSING ANIMATION

            While uploading or confirming, this is the
            only main processing UI shown.
        ================================================== */}

        {busy && (
          <div className="investigation-loading">
            <span className="loading-spinner" />

            <span>
              {confirming ? "Processing database changes..." : "Analyzing uploaded documents..."}
            </span>
          </div>
        )}

        {/* ==================================================
            SELECT FOLDER

            Hide while processing.
        ================================================== */}

        {!busy && (
          <button type="button" className="primary-button" onClick={selectFolder}>
            Select Document Folder
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept=".csv,.json,.xlsx,.docx"
          onChange={processFiles}
          {...({
            webkitdirectory: "",
            directory: "",
          } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

        {/* ==================================================
            MULTI DOCUMENT SUMMARY
        ================================================== */}

        {!busy && hasDocuments && (
          <div className="document-results">
            <div className="document-results-summary">
              <div>
                <strong>{documents.length}</strong>
                <span> Documents</span>
              </div>

              <div>
                <strong>{successfulDocuments.length}</strong>
                <span> Processed</span>
              </div>

              <div>
                <strong>{documentsWithDuplicates.length}</strong>
                <span> With Duplicates</span>
              </div>

              <div>
                <strong>{failedDocuments.length}</strong>
                <span> Failed</span>
              </div>
            </div>

            {/* ==================================================
                ALL DOCUMENTS
            ================================================== */}

            <div className="document-results-list">
              {documents.map((document, index) => {
                const hasDocumentDuplicates =
                  document.has_duplicates &&
                  (document.pending_data?.duplicate_records?.length ?? 0) > 0;

                const statusClass =
                  document.success === false
                    ? "error"
                    : hasDocumentDuplicates
                      ? "warning"
                      : "success";

                const statusText =
                  document.success === false
                    ? "Failed"
                    : hasDocumentDuplicates
                      ? "Duplicates"
                      : "Ready";

                return (
                  <div
                    key={`${document.filename}-${index}`}
                    className={`document-result-row ${statusClass}`}
                  >
                    <div className="document-result-main">
                      {/* -----------------------------------------
                          FILE
                      ----------------------------------------- */}

                      <div className="document-result-file">
                        <span className="document-file-icon">📄</span>

                        <div>
                          <strong>{document.filename || "Unknown File"}</strong>

                          <span>{formatDocumentType(document.document_type)}</span>
                        </div>
                      </div>

                      {/* -----------------------------------------
                          COUNTS
                      ----------------------------------------- */}

                      <div className="document-result-stats">
                        <span>
                          Records <strong>{document.total_records ?? 0}</strong>
                        </span>

                        <span>
                          New <strong>{document.new_record_count ?? 0}</strong>
                        </span>

                        <span>
                          Duplicates <strong>{document.duplicate_record_count ?? 0}</strong>
                        </span>
                      </div>

                      {/* -----------------------------------------
                          STATUS
                      ----------------------------------------- */}

                      <div className="document-result-status">
                        <span className={`status-badge ${statusClass}`}>{statusText}</span>

                        {hasDocumentDuplicates && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => showDuplicates(document)}
                          >
                            View Duplicates
                          </button>
                        )}
                      </div>
                    </div>

                    {/* -----------------------------------------
                        DETAILS
                    ----------------------------------------- */}

                    <div className="document-result-details">
                      <div>
                        <span>Document Type</span>

                        <strong>{formatDocumentType(document.document_type)}</strong>
                      </div>

                      <div>
                        <span>Target Table</span>

                        <strong>{formatDocumentType(document.target_table)}</strong>
                      </div>

                      <div>
                        <span>Status</span>

                        <strong>{formatDocumentType(document.status)}</strong>
                      </div>

                      <div>
                        <span>Confidence</span>

                        <strong>{formatConfidence(document.classification_confidence)}</strong>
                      </div>
                    </div>

                    {/* -----------------------------------------
                        DOCUMENT ERROR
                    ----------------------------------------- */}

                    {document.success === false && document.error && (
                      <div className="document-result-error">{document.error}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ==================================================
                BATCH ACTIONS
            ================================================== */}

            {successfulDocuments.length > 0 && (
              <div className="document-result-actions">
                {/* -----------------------------------------
                    NO DUPLICATES

                    Everything can simply be inserted.
                ----------------------------------------- */}

                {!hasDuplicates && documentsWithoutDuplicates.length > 0 && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void confirmDocuments("insert")}
                  >
                    Import All
                  </button>
                )}

                {/* -----------------------------------------
                    DUPLICATES EXIST

                    Your service handles:
                    - duplicate docs using selected action
                    - non-duplicate docs using insert
                ----------------------------------------- */}

                {hasDuplicates && (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void confirmDocuments("overwrite_duplicates")}
                    >
                      Overwrite Duplicates
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void confirmDocuments("discard_duplicates")}
                    >
                      Discard Duplicates
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            DUPLICATE POPUP

            Opens for whichever document the user selected.
        ================================================== */}

        {!busy &&
          duplicateResult?.pending_data?.duplicate_records &&
          duplicateResult.pending_data.duplicate_records.length > 0 && (
            <>
              <div className="validation-overlay" onClick={closeDuplicates} />

              <div className="validation-popup">
                <h4>Duplicate Records Found</h4>

                <p>This document contains records that already exist in the database.</p>

                {duplicateResult.filename && (
                  <p>
                    File: <strong>{duplicateResult.filename}</strong>
                  </p>
                )}

                {duplicateResult.target_table && (
                  <p>
                    Table: <strong>{duplicateResult.target_table}</strong>
                  </p>
                )}

                <p>
                  Duplicate Records:{" "}
                  <strong>{duplicateResult.pending_data.duplicate_records.length}</strong>
                </p>

                <div className="validation-error-list">
                  {duplicateResult.pending_data.duplicate_records
                    .slice(0, 50)
                    .map((item, index) => (
                      <div key={`${item.row}-${index}`} className="validation-error-item">
                        <strong>Row {item.row}</strong>

                        <div>
                          <span>Incoming Record:</span>

                          <pre>{JSON.stringify(item.incoming_record, null, 2)}</pre>
                        </div>

                        <div>
                          <span>Existing Record:</span>

                          <pre>{JSON.stringify(item.existing_record, null, 2)}</pre>
                        </div>
                      </div>
                    ))}
                </div>

                {duplicateResult.pending_data.duplicate_records.length > 50 && (
                  <p>
                    Showing first 50 duplicates out of{" "}
                    {duplicateResult.pending_data.duplicate_records.length}
                  </p>
                )}

                <div className="database-edit-actions">
                  <button type="button" className="secondary-button" onClick={closeDuplicates}>
                    Close
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void confirmDocuments("overwrite_duplicates")}
                  >
                    Overwrite All Duplicates
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void confirmDocuments("discard_duplicates")}
                  >
                    Discard All Duplicates
                  </button>
                </div>
              </div>
            </>
          )}

        {/* ==================================================
            VALIDATION ERROR POPUP
        ================================================== */}

        {!busy && validationErrors.length > 0 && (
          <>
            <div className="validation-overlay" onClick={clearValidationErrors} />

            <div className="validation-popup">
              <h4>Import Blocked</h4>

              <p>Validation errors were found in the uploaded documents.</p>

              <div className="validation-error-list">
                {validationErrors.slice(0, 50).map((item, index) => (
                  <div
                    key={`${item.file_name ?? "file"}-${item.row_id}-${item.column}-${index}`}
                    className="validation-error-item"
                  >
                    {item.file_name && (
                      <>
                        <strong>File: {item.file_name}</strong>

                        <br />
                      </>
                    )}

                    <span>Row: {item.row_id}</span>

                    <br />

                    {item.table && (
                      <>
                        <span>Table: {item.table}</span>

                        <br />
                      </>
                    )}

                    <span>Column: {item.column}</span>

                    <br />

                    <span>Value: {String(item.value ?? "")}</span>

                    {item.message && (
                      <>
                        <br />

                        <span>{item.message}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {validationErrors.length > 50 && (
                <p>Showing first 50 errors out of {validationErrors.length}</p>
              )}

              <button type="button" className="secondary-button" onClick={clearValidationErrors}>
                Close
              </button>
            </div>
          </>
        )}

        {/* ==================================================
            NORMAL ERROR
        ================================================== */}

        {!busy && error && validationErrors.length === 0 && (
          <p className="error-message">{error}</p>
        )}

        {/* ==================================================
            SUCCESS POPUP
        ================================================== */}

        {!busy && successMessage && (
          <>
            <div className="validation-overlay" onClick={clearSuccessMessage} />

            <div className="validation-popup success-popup">
              <h4>Import Successful</h4>

              <p>{successMessage}</p>

              <button type="button" className="secondary-button" onClick={clearSuccessMessage}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

// ==================================================
// HELPERS
// ==================================================

function formatDocumentType(value?: string) {
  if (!value) {
    return "—";
  }

  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatConfidence(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }

  const percentage = value <= 1 ? value * 100 : value;

  return `${percentage.toFixed(1)}%`;
}
