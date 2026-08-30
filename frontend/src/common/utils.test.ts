import { describe, expect, it } from "vitest";

import { isSupportedDocumentType } from "./utils";

describe("document type validation", () => {
  it.each(["csv", "json", "xlsx", "docx"])("accepts %s", (extension) => {
    expect(isSupportedDocumentType(extension)).toBe(true);
  });

  it.each(["exe", "pdf", "CSV", "", ".csv"])("rejects %s", (extension) => {
    expect(isSupportedDocumentType(extension)).toBe(false);
  });
});
