type ProductLike = {
  product_id?: unknown;
  product_name?: unknown;
  evidence?: Record<string, unknown>;
};

export function formatProductLabel(productName?: unknown, productId?: unknown) {
  const name = String(productName ?? "").trim();
  const id = String(productId ?? "").trim();

  if (!id || id.toUpperCase() === "ALL") {
    return name || "All Products";
  }

  if (!name) return id;
  if (name.toLowerCase().includes(`(${id.toLowerCase()})`)) return name;

  return `${name} (${id})`;
}

export function productLabelFromFinding(finding?: ProductLike) {
  if (!finding) return "All Products";

  return formatProductLabel(
    finding.product_name ?? finding.evidence?.product_name,
    finding.product_id,
  );
}

export function replaceProductIds(
  text: string,
  products: Array<ProductLike>,
) {
  return products.reduce((result, product) => {
    const id = String(product.product_id ?? "").trim();
    const label = productLabelFromFinding(product);
    if (!id || id.toUpperCase() === "ALL" || label === id) return result;

    return result.replace(new RegExp(`\\b${id.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "gi"),
      (match, offset, source) => source[offset - 1] === "(" ? match : label,
    );
  }, text);
}

export function formatRepresentativeLabel(
  representativeName?: unknown,
  representativeId?: unknown,
) {
  const name = String(representativeName ?? "").trim();
  const id = String(representativeId ?? "").trim();

  if (!id) return name || "Representative";
  if (!name) return `Representative (${id})`;
  if (name.toLowerCase().includes(`(${id.toLowerCase()})`)) return name;

  return `${name} (${id})`;
}

export function replaceRepresentativeId(
  text: string,
  representativeName?: unknown,
  representativeId?: unknown,
) {
  const id = String(representativeId ?? "").trim();
  if (!id) return text;

  const label = formatRepresentativeLabel(representativeName, id);
  return text.replace(new RegExp(`\\b${id.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "gi"),
    (match, offset, source) => source[offset - 1] === "(" ? match : label,
  );
}
