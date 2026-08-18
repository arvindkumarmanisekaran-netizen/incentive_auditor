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
  } = useDocumentUpload();

  console.log("CARD validationErrors", validationErrors.length, validationErrors);

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
      </div>
    </article>
  );
}
