import {
  useDocumentUpload,
} from "../service/DocumentUploadService";



export default function DocumentProcessingCard() {


const {

 inputRef,

 selectFolder,

 processFiles,

 processing,

 result,

 error,

 handleConfirm,

}

=
useDocumentUpload();



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
Upload structured documents.
The system identifies the target
database table, maps columns,
validates records and detects duplicates.
</p>



<div className="admin-card-meta">

<span>
JSON
</span>

<span>
CSV
</span>

<span>
XLSX
</span>

<span>
XML
</span>

</div>



<button

type="button"

className="primary-button"

onClick={selectFolder}

disabled={processing}

>

{
processing
?
"Processing..."
:
"Select Document Folder"
}


</button>



<input

ref={inputRef}

type="file"

hidden

multiple

onChange={
processFiles
}
webkitdirectory="true"
/>



{
result && (

<div className="document-result">


<h4>
Detected Document
</h4>


<p>
Table:
{" "}
{result.target_table}
</p>


<p>
Records:
{" "}
{result.total_records}
</p>


<p>
Duplicates:
{" "}
{result.duplicate_record_count}
</p>



{
result.has_duplicates
&&

<>

<button
className="secondary-button"
onClick={() =>
handleConfirm(
"overwrite_duplicates"
)
}
>
Overwrite
</button>


<button
className="secondary-button"
onClick={() =>
handleConfirm(
"discard_duplicates"
)
}
>
Discard Duplicates
</button>

</>

}



{
!result.has_duplicates
&&

<button

className="primary-button"

onClick={() =>
handleConfirm(
"insert"
)
}

>

Import Data

</button>

}



</div>

)

}



{
error && (

<p className="error-message">

{error}

</p>

)

}



</div>


</article>

);

}