const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;


export async function uploadDocuments(
  files: File[]
): Promise<void> {


  const formData = new FormData();


  files.forEach((file) => {

    formData.append(
      "documents",
      file
    );

  });


  const response = await fetch(
    `${API_BASE_URL}/api/document-processing/upload`,
    {
      method: "POST",
      body: formData
    }
  );


  if (!response.ok) {

    throw new Error(
      "Document upload failed"
    );

  }

}