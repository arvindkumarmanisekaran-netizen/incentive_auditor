import {
  useRef,
  useState
} from "react";


import { isSupportedDocumentType } from "../common/utils";

import { uploadDocuments } from "../api/documentProcessing";



export function useDocumentUpload() {


  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );


  const [
    uploading,
    setUploading
  ] =
    useState(false);


  const [
    documentCount,
    setDocumentCount
  ] =
    useState(0);


  function selectFolder() {

    inputRef.current?.click();

  }


  async function processFiles(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
 
    const files = Array.from(event.target.files ?? []);

    const validFiles = files.filter((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        return isSupportedDocumentType(extension);
    });

    if (
      validFiles.length === 0
    ) {

      return;

    }

    try {

      setUploading(true);

      await uploadDocuments(
        validFiles
      );


      setDocumentCount(
        validFiles.length
      );


    } finally {

      setUploading(false);

    }

  }



  return {

    inputRef,

    selectFolder,

    processFiles,

    uploading,

    documentCount

  };

}