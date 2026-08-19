import { useDocumentUpload } from "../service/DocumentUploadService";

import { useEffect, useState } from "react";

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
    if (result?.has_duplicates) {
      setShowDuplicatePopup(true);
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
          <span>JSON</span>
          <span>CSV</span>
          <span>XLSX</span>
          <span>XML</span>
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
          onChange={processFiles}
          {...({
            webkitdirectory: "true",
          } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

        {result && (
          <div className="document-result">
            <h4>Detected Document</h4>

            {result.filename && <p>File: {result.filename}</p>}

            <p>Table: {result.target_table}</p>

            <p>Records: {result.total_records}</p>

            <p>Duplicates: {result.duplicate_record_count}</p>

            {result.has_duplicates && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => handleConfirm("overwrite_duplicates")}
                >
                  Overwrite
                </button>

                <button
                  className="secondary-button"
                  onClick={() => handleConfirm("discard_duplicates")}
                >
                  Discard Duplicates
                </button>
              </>
            )}

            {!result.has_duplicates && (
              <button className="primary-button" onClick={() => handleConfirm("insert")}>
                Import Data
              </button>
            )}
          </div>
        )}

        {/* Duplicate Records Popup */}

        {showDuplicatePopup && result?.pending_data?.duplicate_records && (
          <>
            <div className="validation-overlay"></div>

            <div className="validation-popup">
              <h4>Duplicate Records Found</h4>

              <p>The uploaded document contains existing database records.</p>

              {result.filename && <p>File: {result.filename}</p>}

              <p>Table: {result.target_table}</p>

              <div className="validation-error-list">
                {result?.pending_data?.duplicate_records.slice(0, 50).map((item, index) => (
                  <div key={`${item.row}-${index}`} className="validation-error-item">
                    <strong>Row {item.row}</strong>

                    <br />

                    <span>Incoming Record:</span>

                    <pre>{JSON.stringify(item.incoming_record, null, 2)}</pre>

                    <span>Existing Record:</span>

                    <pre>{JSON.stringify(item.existing_record, null, 2)}</pre>
                  </div>
                ))}
              </div>

              {result?.pending_data?.duplicate_records.length > 50 && (
                <p>
                  Showing first 50 duplicates out of{" "}
                  {result?.pending_data?.duplicate_records.length}
                </p>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowDuplicatePopup(false)}
              >
                Close
              </button>
            </div>
          </>
        )}

        {/* Validation Errors Popup */}

        {validationErrors.length > 0 && (
          <>
            <div className="validation-overlay"></div>

            <div className="validation-popup">
              <h4>Import Blocked</h4>

              <p>Missing dependency records found. Import master data first.</p>

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

                    <span>Missing Value: {item.value}</span>
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

        {error && !validationErrors.length && <p className="error-message">{error}</p>}

        {/* Success Popup */}

        {successMessage && (
          <>
            <div className="validation-overlay"></div>

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
