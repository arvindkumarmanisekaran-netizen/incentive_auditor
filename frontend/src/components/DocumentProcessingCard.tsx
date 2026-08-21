import { useEffect, useState } from "react";

import { useDocumentUpload } from "../service/DocumentUploadService";

export default function DocumentProcessingCard() {
  const {
    inputRef,
    selectFolder,
    processFiles,
    processing,
    result,
    error,
    validationErrors,
    clearValidationErrors,
    handleConfirm,
    successMessage,
    clearSuccessMessage,
  } = useDocumentUpload();

  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);

  useEffect(() => {
    if (result?.has_duplicates && result?.pending_data?.duplicate_records?.length) {
      setShowDuplicatePopup(true);
    } else {
      setShowDuplicatePopup(false);
    }
  }, [result]);

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

        <button
          type="button"
          className="primary-button"
          onClick={selectFolder}
          disabled={processing}
        >
          {processing ? "Processing..." : "Select Document Folder"}
        </button>

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

        {/* =========================================
            PROCESSING RESULT
        ========================================= */}

        {result && (
          <div className="document-result">
            <h4>Detected Document</h4>

            {result.filename && <p>File: {result.filename}</p>}

            {result.document_type && <p>Document Type: {result.document_type}</p>}

            {result.target_table && <p>Table: {result.target_table}</p>}

            <p>Records: {result.total_records ?? 0}</p>

            <p>New Records: {result.new_record_count ?? 0}</p>

            <p>Duplicates: {result.duplicate_record_count ?? 0}</p>

            {/* -----------------------------------------
                DUPLICATE ACTIONS
            ----------------------------------------- */}

            {result.has_duplicates && (
              <div className="document-result-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={processing}
                  onClick={() => handleConfirm("overwrite_duplicates")}
                >
                  Overwrite Duplicates
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={processing}
                  onClick={() => handleConfirm("discard_duplicates")}
                >
                  Discard Duplicates
                </button>
              </div>
            )}

            {/* -----------------------------------------
                NO DUPLICATES
            ----------------------------------------- */}

            {!result.has_duplicates && result.success !== false && (
              <button
                type="button"
                className="primary-button"
                disabled={processing}
                onClick={() => handleConfirm("insert")}
              >
                Import Data
              </button>
            )}
          </div>
        )}

        {/* =========================================
            DUPLICATE POPUP
        ========================================= */}

        {showDuplicatePopup &&
          result?.pending_data?.duplicate_records &&
          result.pending_data.duplicate_records.length > 0 && (
            <>
              <div className="validation-overlay" onClick={() => setShowDuplicatePopup(false)} />

              <div className="validation-popup">
                <h4>Duplicate Records Found</h4>

                <p>The uploaded document contains records that already exist in the database.</p>

                {result.filename && <p>File: {result.filename}</p>}

                {result.target_table && <p>Table: {result.target_table}</p>}

                <p>Duplicate Records: {result.pending_data.duplicate_records.length}</p>

                <div className="validation-error-list">
                  {result.pending_data.duplicate_records.slice(0, 50).map((item, index) => (
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

                {result.pending_data.duplicate_records.length > 50 && (
                  <p>
                    Showing first 50 duplicates out of{" "}
                    {result.pending_data.duplicate_records.length}
                  </p>
                )}

                <div className="database-edit-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowDuplicatePopup(false)}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={processing}
                    onClick={() => {
                      setShowDuplicatePopup(false);

                      handleConfirm("overwrite_duplicates");
                    }}
                  >
                    Overwrite
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={processing}
                    onClick={() => {
                      setShowDuplicatePopup(false);

                      handleConfirm("discard_duplicates");
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </>
          )}

        {/* =========================================
            VALIDATION ERROR POPUP
        ========================================= */}

        {validationErrors.length > 0 && (
          <>
            <div className="validation-overlay" onClick={clearValidationErrors} />

            <div className="validation-popup">
              <h4>Import Blocked</h4>

              <p>Validation errors were found in the uploaded document.</p>

              <div className="validation-error-list">
                {validationErrors.slice(0, 50).map((item, index) => (
                  <div
                    key={`${item.table}-${item.column}-${item.value}-${index}`}
                    className="validation-error-item"
                  >
                    <strong>Row {item.row_id}</strong>

                    <br />

                    <span>Table: {item.table}</span>

                    <br />

                    <span>Column: {item.column}</span>

                    <br />

                    <span>Value: {String(item.value ?? "")}</span>
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

        {/* =========================================
            NORMAL ERROR
        ========================================= */}

        {error && validationErrors.length === 0 && <p className="error-message">{error}</p>}

        {/* =========================================
            SUCCESS POPUP
        ========================================= */}

        {successMessage && (
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
