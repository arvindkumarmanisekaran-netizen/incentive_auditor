import { useMemo, useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useDocumentUpload } from "../service/DocumentUploadService";

function formatFieldName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDuplicateValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

interface DocumentProcessingCardProps {
  onProcessingFinished?: () => void;
}
export default function DocumentProcessingCard({
  onProcessingFinished,
}: DocumentProcessingCardProps) {
  const {
    inputRef,
    selectFolder,
    processFiles,
    processing,
    result,
    results,
    error,
    validationErrors,
    clearValidationErrors,
    handleConfirm,
    successMessage,
    clearSuccessMessage,
    setSelectedActions,
    clearProcessedDocuments,
  } = useDocumentUpload();

  const duplicateDragStateRef = useRef<{
    container: HTMLDivElement | null;
    pointerId: number | null;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    dragging: boolean;
  }>({
    container: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    dragging: false,
  });

  function handleDuplicatePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    // Keep selects, buttons and links clickable.
    if (target.closest("button, input, select, textarea, a")) {
      return;
    }

    // Only react to the primary mouse button.
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const container = event.currentTarget;

    duplicateDragStateRef.current = {
      container,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      dragging: true,
    };

    container.classList.add("is-dragging");
    container.setPointerCapture(event.pointerId);
  }

  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 650px)").matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 650px)");

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
      setDuplicatePage({});
    }

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  function handleDuplicatePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = duplicateDragStateRef.current;

    if (!state.dragging || !state.container || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    state.container.scrollLeft = state.scrollLeft - deltaX;
    state.container.scrollTop = state.scrollTop - deltaY;

    event.preventDefault();
  }

  function stopDuplicateDragging(event: React.PointerEvent<HTMLDivElement>) {
    const state = duplicateDragStateRef.current;
    const container = state.container;

    if (container && state.pointerId !== null && container.hasPointerCapture(state.pointerId)) {
      container.releasePointerCapture(state.pointerId);
    }

    container?.classList.remove("is-dragging");

    duplicateDragStateRef.current = {
      container: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      scrollTop: 0,
      dragging: false,
    };
  }
  // ==================================================
  // LOCAL UI STATE
  // ==================================================

  const [expandedDuplicates, setExpandedDuplicates] = useState<Record<string, boolean>>({});

  const [duplicatePage, setDuplicatePage] = useState<Record<string, number>>({});

  const [duplicateActions, setDuplicateActions] = useState<
    Record<string, Record<number, "keep" | "replace">>
  >({});

  function setAllDuplicateActions(
    filename: string,
    duplicateCount: number,
    action: "keep" | "replace",
  ) {
    setDuplicateActions((current) => {
      const updatedForDocument: Record<number, "keep" | "replace"> = {};

      for (let index = 0; index < duplicateCount; index++) {
        updatedForDocument[index] = action;
      }

      return {
        ...current,
        [filename]: updatedForDocument,
      };
    });
  }
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

  useEffect(() => {
    setSelectedActions((current) => {
      const updated = { ...current };

      documents.forEach((document) => {
        if (updated[document.filename]) {
          return;
        }

        if (document.success === false) {
          updated[document.filename] = "cancel";
        } else if (document.has_duplicates) {
          updated[document.filename] = "discard_duplicates";
        } else {
          updated[document.filename] = "insert";
        }
      });

      return updated;
    });
  }, [documents, setSelectedActions]);

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

  const hasDocuments = documents.length > 0;

  /*
   * Upload processing OR database confirmation.
   */
  const busy = processing;

  const previousProcessingRef = useRef(processing);

  useEffect(() => {
    const wasProcessing = previousProcessingRef.current;

    /*
     * Refresh Database Management whenever an upload/import
     * operation finishes, whether it succeeds or fails.
     */
    if (wasProcessing && !processing) {
      onProcessingFinished?.();
    }

    previousProcessingRef.current = processing;
  }, [processing, onProcessingFinished]);

  // ==================================================
  // CONFIRM
  // ==================================================

  async function confirmAllDocuments() {
    const success = await handleConfirm(duplicateActions);

    if (!success) {
      return;
    }

    setExpandedDuplicates({});
    setDuplicatePage({});
    setDuplicateActions({});

    clearProcessedDocuments();
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

            <span>Processing documents...</span>
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

                const duplicateRecords = document.pending_data?.duplicate_records ?? [];

                const pageSize = isMobile ? 10 : 50;

                const currentPage = duplicatePage[document.filename] ?? 0;

                const totalPages = Math.max(1, Math.ceil(duplicateRecords.length / pageSize));

                const visibleDuplicates = duplicateRecords.slice(
                  currentPage * pageSize,
                  currentPage * pageSize + pageSize,
                );

                const startRecord = duplicateRecords.length === 0 ? 0 : currentPage * pageSize + 1;

                const endRecord = Math.min((currentPage + 1) * pageSize, duplicateRecords.length);

                return (
                  <div
                    key={`${document.filename}-${index}`}
                    className={`document-result-row ${statusClass}`}
                  >
                    <div className="document-result-main">
                      {/* FILE */}
                      <div className="document-result-file">
                        <span className="document-file-icon">📄</span>

                        <div>
                          <strong>{document.filename || "Unknown File"}</strong>

                          <span>{formatDocumentType(document.document_type)}</span>
                        </div>
                      </div>

                      {/* COUNTS */}
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

                      {/* STATUS */}
                      <div className="document-result-status">
                        <span className={`status-badge ${statusClass}`}>{statusText}</span>

                        {hasDocumentDuplicates && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              const isOpen = expandedDuplicates[document.filename] ?? false;

                              setExpandedDuplicates((current) => ({
                                ...current,
                                [document.filename]: !isOpen,
                              }));

                              if (!isOpen) {
                                setDuplicatePage((current) => ({
                                  ...current,
                                  [document.filename]: 0,
                                }));
                              }
                            }}
                          >
                            {expandedDuplicates[document.filename]
                              ? "Hide Duplicates"
                              : "View Duplicates"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* DUPLICATE DETAILS */}
                    <AnimatePresence initial={false}>
                      {hasDocumentDuplicates && expandedDuplicates[document.filename] && (
                        <motion.div
                          className="document-duplicate-inline"
                          initial={{ opacity: 0, height: 0, y: -8 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          style={{ overflow: "hidden" }}
                        >
                        <div className="duplicate-header">
                          <div>
                            <h4>Duplicate Records</h4>

                            <p>{duplicateRecords.length} records require review</p>
                          </div>

                          <div className="duplicate-header-actions">
                            <select
                              className="duplicate-bulk-resolution"
                              value=""
                              onChange={(event) => {
                                const value = event.target.value as "" | "keep" | "replace";

                                if (!value) {
                                  return;
                                }

                                setAllDuplicateActions(
                                  document.filename,
                                  duplicateRecords.length,
                                  value,
                                );
                              }}
                            >
                              <option value="">Apply to all...</option>
                              <option value="keep">Keep All Existing</option>
                              <option value="replace">Replace All Existing</option>
                            </select>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                setExpandedDuplicates((current) => ({
                                  ...current,
                                  [document.filename]: false,
                                }))
                              }
                            >
                              Close
                            </button>
                          </div>
                        </div>

                        <div className="duplicate-mobile-list">
                          {visibleDuplicates.map((item, index) => {
                            const rowIndex = currentPage * pageSize + index;

                            const resolution =
                              duplicateActions[document.filename]?.[rowIndex] ?? "keep";

                            return (
                              <article
                                key={`${document.filename}-mobile-${rowIndex}`}
                                className="duplicate-mobile-card"
                              >
                                <header className="duplicate-mobile-card-header">
                                  <span>Duplicate Record</span>
                                  <strong>#{rowIndex + 1}</strong>
                                </header>

                                <div className="duplicate-mobile-fields">
                                  {Object.entries(item.incoming_record).map(([column, value]) => (
                                    <div key={column} className="duplicate-mobile-field">
                                      <span>{formatFieldName(column)}</span>

                                      <strong>{formatDuplicateValue(value)}</strong>
                                    </div>
                                  ))}
                                </div>

                                <label className="duplicate-mobile-resolution">
                                  <span>Resolution</span>

                                  <select
                                    className={`duplicate-resolution ${
                                      resolution === "replace" ? "replace" : "keep"
                                    }`}
                                    value={resolution}
                                    onChange={(event) => {
                                      const value = event.target.value as "keep" | "replace";

                                      setDuplicateActions((current) => ({
                                        ...current,

                                        [document.filename]: {
                                          ...(current[document.filename] ?? {}),
                                          [rowIndex]: value,
                                        },
                                      }));
                                    }}
                                  >
                                    <option value="keep">Keep Existing</option>
                                    <option value="replace">Replace Existing</option>
                                  </select>
                                </label>
                              </article>
                            );
                          })}
                        </div>
                        {/* TABLE */}
                        <div
                          className="duplicate-table-wrapper"
                          onPointerDown={handleDuplicatePointerDown}
                          onPointerMove={handleDuplicatePointerMove}
                          onPointerUp={stopDuplicateDragging}
                          onPointerCancel={stopDuplicateDragging}
                          onLostPointerCapture={stopDuplicateDragging}
                        >
                          {duplicateRecords.length > 0 ? (
                            <table className="duplicate-table">
                              <thead>
                                <tr>
                                  {Object.keys(duplicateRecords[0].incoming_record).map(
                                    (column) => (
                                      <th key={column}>{formatFieldName(column)}</th>
                                    ),
                                  )}

                                  <th>Resolution</th>
                                </tr>
                              </thead>

                              <tbody>
                                {visibleDuplicates.map((item, index) => {
                                  const rowIndex = currentPage * pageSize + index;

                                  const resolution =
                                    duplicateActions[document.filename]?.[rowIndex] ?? "keep";

                                  return (
                                    <tr key={`${document.filename}-${rowIndex}`}>
                                      {Object.keys(item.incoming_record).map((column) => (
                                        <td key={column} data-label={formatFieldName(column)}>
                                          <span className="duplicate-cell-value">
                                            {formatDuplicateValue(item.incoming_record[column])}
                                          </span>
                                        </td>
                                      ))}

                                      <td data-label="Resolution">
                                        <select
                                          className={`duplicate-resolution ${
                                            resolution === "replace" ? "replace" : "keep"
                                          }`}
                                          value={resolution}
                                          onChange={(event) => {
                                            const value = event.target.value as "keep" | "replace";

                                            setDuplicateActions((current) => ({
                                              ...current,

                                              [document.filename]: {
                                                ...(current[document.filename] ?? {}),

                                                [rowIndex]: value,
                                              },
                                            }));
                                          }}
                                        >
                                          <option value="keep">Keep Existing</option>
                                          <option value="replace">Replace Existing</option>
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <div className="duplicate-empty">No duplicate records found.</div>
                          )}
                        </div>

                        {/* PAGINATION */}
                        <div className="duplicate-pagination">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={currentPage === 0}
                            onClick={() =>
                              setDuplicatePage((current) => ({
                                ...current,

                                [document.filename]: Math.max(currentPage - 1, 0),
                              }))
                            }
                          >
                            Previous
                          </button>

                          <span>
                            Showing {startRecord} - {endRecord} of {duplicateRecords.length}{" "}
                            duplicates
                          </span>

                          <button
                            type="button"
                            className="secondary-button"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() =>
                              setDuplicatePage((current) => ({
                                ...current,

                                [document.filename]: Math.min(currentPage + 1, totalPages - 1),
                              }))
                            }
                          >
                            Next
                          </button>
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* DOCUMENT ERROR */}
                    {document.success === false && document.error && (
                      <div className="document-result-error">{document.error}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="document-processing-actions">
              <button
                type="button"
                className="primary-button"
                disabled={processing}
                onClick={() => void confirmAllDocuments()}
              >
                Confirm Actions
              </button>
            </div>
          </div>
        )}

        {/* ==================================================
            VALIDATION ERROR POPUP
        ================================================== */}

        <AnimatePresence>
          {!busy && validationErrors.length > 0 && (
            <>
              <motion.div
                className="validation-overlay"
                onClick={clearValidationErrors}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              <motion.div
                className="validation-popup"
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
              >
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
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ==================================================
            NORMAL ERROR
        ================================================== */}

        {!busy && error && validationErrors.length === 0 && (
          <p className="error-message">{error}</p>
        )}

        {/* ==================================================
            SUCCESS POPUP
        ================================================== */}

        <AnimatePresence>
          {!busy && successMessage && (
            <motion.div
              className="import-success-row"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
            >
            <div className="import-success-banner">
              <div className="import-success-icon">✓</div>

              <div className="import-success-content">
                <strong>Import Successful</strong>
                <span>{successMessage}</span>
              </div>

              <button
                type="button"
                className="import-success-close"
                onClick={clearSuccessMessage}
                aria-label="Close success message"
                title="Close"
              >
                ×
              </button>
            </div>
            </motion.div>
          )}
        </AnimatePresence>
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
