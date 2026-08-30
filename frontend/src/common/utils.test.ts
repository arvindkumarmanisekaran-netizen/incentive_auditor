import { describe, expect, it } from "vitest";

import { isSupportedDocumentType } from "./utils";

describe("supported document types", () => {
  it.each(["csv", "json", "xlsx", "docx"])("accepts %s", (extension) => {
    expect(isSupportedDocumentType(extension)).toBe(true);
  });

  it.each(["xls", "pdf", "txt", "CSV", "", ".csv"])("rejects %s", (extension) => {
    expect(isSupportedDocumentType(extension)).toBe(false);
  });
});
