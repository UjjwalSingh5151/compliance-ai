/**
 * Run: node generate-test-data.js [matchRate] [rows]
 * Example: node generate-test-data.js 70 20
 * Outputs: purchases.csv and gstr2b.csv in the current folder
 */
import fs from "fs";

const MATCH_RATE = parseFloat(process.argv[2] ?? 70) / 100;
const ROWS = parseInt(process.argv[3] ?? 20);

const VENDORS = [
  { name: "Tata Steel Ltd", gstin: "27AAACT2727Q1ZW" },
  { name: "Infosys BPM Ltd", gstin: "29AABCI1681G1ZK" },
  { name: "Reliance Retail Ltd", gstin: "27AAJCR5155K1Z8" },
  { name: "Wipro Ltd", gstin: "29AAACW0867H1ZL" },
  { name: "HCL Technologies", gstin: "09AAACH1103J1ZF" },
  { name: "Mahindra & Mahindra", gstin: "27AAACM3025E1ZH" },
  { name: "Larsen & Toubro", gstin: "27AAACL0287H1ZQ" },
  { name: "HDFC Bank Ltd", gstin: "27AAAAH0137A1ZV" },
];

const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const invoiceNo = (i) => `INV-2026-${String(i + 1).padStart(4, "0")}`;
const dateStr = () => {
  const d = new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const purchases = [];
const gstr2b = [];

for (let i = 0; i < ROWS; i++) {
  const vendor = VENDORS[i % VENDORS.length];
  const taxableValue = rand(10000, 500000);
  const isIGST = Math.random() > 0.5;
  const rate = [5, 12, 18, 28][Math.floor(Math.random() * 4)];
  const tax = Math.round(taxableValue * rate) / 100;
  const cgst = isIGST ? 0 : tax / 2;
  const sgst = isIGST ? 0 : tax / 2;
  const igst = isIGST ? tax : 0;
  const inv = invoiceNo(i);
  const dt = dateStr();

  purchases.push({ gstin: vendor.gstin, vendor: vendor.name, invoiceNo: inv, date: dt, taxableValue, cgst, sgst, igst });

  const shouldMatch = Math.random() < MATCH_RATE;

  if (shouldMatch) {
    // Exact match
    gstr2b.push({ gstin: vendor.gstin, invoiceNo: inv, date: dt, taxableValue, cgst, sgst, igst });
  } else {
    const scenario = Math.random();
    if (scenario < 0.33) {
      // Amount mismatch (e.g., vendor filed different value)
      const delta = rand(-500, 500);
      gstr2b.push({ gstin: vendor.gstin, invoiceNo: inv, date: dt, taxableValue: taxableValue + delta, cgst, sgst, igst });
    } else if (scenario < 0.66) {
      // Missing from 2B — don't push to gstr2b
    } else {
      // Extra in 2B not in purchases
      const extraVendor = VENDORS[(i + 3) % VENDORS.length];
      gstr2b.push({
        gstin: extraVendor.gstin,
        invoiceNo: `EXTRA-${invoiceNo(i)}`,
        date: dt,
        taxableValue: rand(5000, 100000),
        cgst: rand(250, 5000),
        sgst: rand(250, 5000),
        igst: 0,
      });
      // Also push the original to 2B so the purchase isn't flagged missing
      gstr2b.push({ gstin: vendor.gstin, invoiceNo: inv, date: dt, taxableValue, cgst, sgst, igst });
    }
  }
}

const toCSV = (rows) => {
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => r[h]).join(","))].join("\n");
};

fs.writeFileSync("purchases.csv", toCSV(purchases));
fs.writeFileSync("gstr2b.csv", toCSV(gstr2b));

const matched = Math.round(ROWS * MATCH_RATE);
console.log(`Generated ${ROWS} purchase invoices (~${Math.round(MATCH_RATE * 100)}% match rate)`);
console.log(`  purchases.csv — ${ROWS} rows`);
console.log(`  gstr2b.csv    — ${gstr2b.length} rows`);
console.log(`  Expected: ~${matched} matched, ~${ROWS - matched} mismatched/missing`);
console.log(`\nUpload both files in the Reconciliation tab to verify.`);
