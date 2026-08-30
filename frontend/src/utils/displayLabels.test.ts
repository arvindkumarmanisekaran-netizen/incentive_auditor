import { describe, expect, it } from "vitest";

import {
  formatProductLabel,
  formatRepresentativeLabel,
  productLabelFromFinding,
  replaceProductIds,
  replaceRepresentativeId,
} from "./displayLabels";

describe("display labels", () => {
  it.each([
    [undefined, undefined, "All Products"],
    ["Product One", "", "Product One"],
    ["", "P1", "P1"],
    ["Product One", "P1", "Product One (P1)"],
    ["Product One (P1)", "p1", "Product One (P1)"],
    ["All", "ALL", "All"],
  ])("formats product name %s and id %s", (name, id, expected) => {
    expect(formatProductLabel(name, id)).toBe(expected);
  });

  it("uses evidence as a product-name fallback", () => {
    expect(productLabelFromFinding({ product_id: "P2", evidence: { product_name: "Product Two" } }))
      .toBe("Product Two (P2)");
  });

  it("replaces repeated product IDs without double labelling existing labels", () => {
    expect(replaceProductIds("P1, p1, Product One (P1)", [{ product_id: "P1", product_name: "Product One" }]))
      .toBe("Product One (P1), Product One (P1), Product One (P1)");
  });

  it.each([
    [undefined, undefined, "Representative"],
    ["Alice", "", "Alice"],
    ["", "R1", "Representative (R1)"],
    ["Alice", "R1", "Alice (R1)"],
    ["Alice (R1)", "r1", "Alice (R1)"],
  ])("formats representative name %s and id %s", (name, id, expected) => {
    expect(formatRepresentativeLabel(name, id)).toBe(expected);
  });

  it("replaces representative IDs case-insensitively and idempotently", () => {
    expect(replaceRepresentativeId("R1 compared with r1 and Alice (R1)", "Alice", "R1"))
      .toBe("Alice (R1) compared with Alice (R1) and Alice (R1)");
  });
});
