

import type {
  SupportedDocumentType
} from "../types/document"

import {SUPPORTED_EXTENSIONS} from "../types/document"

export function isSupportedDocumentType(ext: string): ext is SupportedDocumentType {
    return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
    }
