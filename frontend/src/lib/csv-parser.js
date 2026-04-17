const COLUMN_MAP = [
  { key: "gstin", patterns: ["gstin", "gst_no", "gst no", "gstin/uin", "supplier gstin", "vendor gstin", "ctin", "gstno", "tax id"] },
  { key: "taxableValue", patterns: ["taxable", "base_amount", "assessable", "taxable value", "taxable amt", "taxablevalue", "basic amount", "net amount", "net_amount", "value"] },
  { key: "cgst", patterns: ["cgst"] },
  { key: "sgst", patterns: ["sgst", "utgst"] },
  { key: "igst", patterns: ["igst"] },
  { key: "invoiceNo", patterns: ["invoice no", "invoice_no", "invoice number", "bill no", "bill_no", "inv no", "invno", "inum", "doc no", "voucher no", "voucher_no"] },
  { key: "vendor", patterns: ["vendor", "supplier", "party", "party name", "supplier name", "vendor name", "trade name"] },
  { key: "date", patterns: ["date", "invoice date", "bill date", "doc date", "voucher date"] },
  { key: "hsn", patterns: ["hsn", "hsn/sac", "sac"] },
];

function mapHeader(raw) {
  const h = raw.toLowerCase().trim();
  for (const { key, patterns } of COLUMN_MAP) {
    if (patterns.some((p) => h === p || h.includes(p))) return key;
  }
  return h;
}

function splitLine(line) {
  // Handle quoted fields containing commas
  const result = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { data: [], errors: ["File appears empty — needs at least a header row and one data row."] };

  const rawHeaders = splitLine(lines[0]);
  const mappedHeaders = rawHeaders.map(mapHeader);

  const hasGSTIN = mappedHeaders.includes("gstin");
  const hasTax = mappedHeaders.some((h) => ["taxableValue", "cgst", "sgst", "igst"].includes(h));

  const warnings = [];
  if (!hasGSTIN) warnings.push("No GSTIN column found — matching will be less accurate.");
  if (!hasTax) warnings.push("No tax amount columns found (cgst/sgst/igst/taxableValue).");

  const data = lines.slice(1).map((line, idx) => {
    const vals = splitLine(line);
    const obj = { _id: `csv-${idx}` };
    mappedHeaders.forEach((key, i) => {
      const raw = vals[i] ?? "";
      const isNumericKey = ["taxableValue", "cgst", "sgst", "igst"].includes(key);
      // Strip ₹ signs, commas, spaces from numeric fields
      obj[key] = isNumericKey ? Number(raw.replace(/[₹,\s]/g, "") || 0) : raw;
    });
    // Derive total ITC if individual components missing
    if (!obj.cgst && !obj.sgst && !obj.igst && obj.taxableValue) {
      obj._noTax = true;
    }
    return obj;
  });

  return { data, warnings };
}
