import { describe, expect, it } from "vitest";

import {
  formatProductLabel,
  formatRepresentativeLabel,
  productLabelFromFinding,
  replaceProductIds,
  replaceRepresentativeId,
} from "./displayLabels";

describe("product display labels", () => {
  it("always combines a known product name and ID", () => {
    expect(formatProductLabel("MolestiaeCare 5", "P005")).toBe("MolestiaeCare 5 (P005)");
  });

  it("does not duplicate an ID already in the label", () => {
    expect(formatProductLabel("MolestiaeCare 5 (P005)", "P005")).toBe("MolestiaeCare 5 (P005)");
  });

  it("uses evidence product names and handles all-products scope", () => {
    expect(productLabelFromFinding({ product_id: "P005", evidence: { product_name: "MolestiaeCare 5" } })).toBe("MolestiaeCare 5 (P005)");
    expect(formatProductLabel(undefined, "ALL")).toBe("All Products");
  });

  it("replaces every plain product ID without corrupting an existing label", () => {
    const result = replaceProductIds(
      "P005 differs from P010; MolestiaeCare 5 (P005) is selected.",
      [
        { product_id: "P005", product_name: "MolestiaeCare 5" },
        { product_id: "P010", product_name: "CorruptiCare 10" },
      ],
    );
    expect(result).toBe("MolestiaeCare 5 (P005) differs from CorruptiCare 10 (P010); MolestiaeCare 5 (P005) is selected.");
  });
});

describe("representative display labels", () => {
  it("always combines a known representative name and ID", () => {
    expect(formatRepresentativeLabel("Aahana Bassi", "FR0011")).toBe("Aahana Bassi (FR0011)");
  });

  it("uses a human-readable fallback when only an ID is known", () => {
    expect(formatRepresentativeLabel(undefined, "FR0011")).toBe("Representative (FR0011)");
  });

  it("replaces plain IDs without duplicating IDs already in labels", () => {
    expect(replaceRepresentativeId(
      "Review FR0011 against Aahana Bassi (FR0011).",
      "Aahana Bassi",
      "FR0011",
    )).toBe("Review Aahana Bassi (FR0011) against Aahana Bassi (FR0011).");
  });
});
