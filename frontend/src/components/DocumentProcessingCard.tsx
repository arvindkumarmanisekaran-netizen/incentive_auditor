import { useDocumentUpload } from "../service/DocumentUploadService";

export default function DocumentProcessingCard() {


  const {
    inputRef,
    selectFolder,
    processFiles,
    uploading,
    documentCount
  } = useDocumentUpload();



  return (

    <article className="admin-card">

      <div className="admin-card-icon">
        📁
      </div>


      <div className="admin-card-content">

        <h3>
          Document Processing
        </h3>


        <p>
          Select a folder containing supporting
          investigation documents. The system
          will scan supported files and extract
          relevant evidence.
        </p>


        <button
          type="button"
          className="primary-button"
          onClick={selectFolder}
          disabled={uploading}
        >
          {
            uploading
              ? "Uploading..."
              : "Select Document Folder"
          }
        </button>


        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          onChange={processFiles}
          webkitdirectory="true"
          directory="true"
        />


        {
          documentCount > 0 && (
            <p>
              {documentCount} documents uploaded
            </p>
          )
        }


      </div>

    </article>

  );

}