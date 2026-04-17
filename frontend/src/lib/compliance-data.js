export const SAMPLE_PURCHASES = [
  { _id: "p1", vendor: "Raj Steel Traders", gstin: "27AABCR1234F1ZP", invoiceNo: "RS/2026/1847", date: "2026-03-05", taxableValue: 125000, cgst: 11250, sgst: 11250, igst: 0, hsn: "7208" },
  { _id: "p2", vendor: "Sharma & Sons Pvt Ltd", gstin: "07AADCS5678G1ZQ", invoiceNo: "SS/26-27/0092", date: "2026-03-08", taxableValue: 85000, cgst: 0, sgst: 0, igst: 15300, hsn: "8471" },
  { _id: "p3", vendor: "Kumar Logistics", gstin: "29AABCK9012H1ZR", invoiceNo: "KL/MAR/445", date: "2026-03-12", taxableValue: 45000, cgst: 2250, sgst: 2250, igst: 0, hsn: "9965" },
  { _id: "p4", vendor: "Priya Packaging Co", gstin: "27AABCP3456I1ZS", invoiceNo: "PPC/2026/331", date: "2026-03-15", taxableValue: 32000, cgst: 2880, sgst: 2880, igst: 0, hsn: "4819" },
  { _id: "p5", vendor: "Digital Marketing Hub", gstin: "06AABCD7890J1ZT", invoiceNo: "DMH/INV/2026/78", date: "2026-03-18", taxableValue: 150000, cgst: 0, sgst: 0, igst: 27000, hsn: "9983" },
  { _id: "p6", vendor: "Mehta Office Supplies", gstin: "27AABCM2345K1ZU", invoiceNo: "MOS/2026/112", date: "2026-03-22", taxableValue: 18000, cgst: 1620, sgst: 1620, igst: 0, hsn: "4820" },
  { _id: "p7", vendor: "Bangalore Tech Services", gstin: "29AABCB5678L1ZV", invoiceNo: "BTS/MAR/221", date: "2026-03-25", taxableValue: 95000, cgst: 0, sgst: 0, igst: 17100, hsn: "9983" },
  { _id: "p8", vendor: "Chennai Raw Materials", gstin: "33AABCC9012M1ZW", invoiceNo: "CRM/26/0445", date: "2026-03-28", taxableValue: 210000, cgst: 0, sgst: 0, igst: 37800, hsn: "3901" },
];

export const SAMPLE_2B = [
  { _id: "2b-1", gstin: "27AABCR1234F1ZP", invoiceNo: "RS/2026/1847", date: "2026-03-05", taxableValue: 125000, cgst: 11250, sgst: 11250, igst: 0 },
  { _id: "2b-2", gstin: "07AADCS5678G1ZQ", invoiceNo: "SS/26-27/0092", date: "2026-03-08", taxableValue: 85000, cgst: 0, sgst: 0, igst: 15300 },
  { _id: "2b-3", gstin: "29AABCK9012H1ZR", invoiceNo: "KL/MAR/445", date: "2026-03-12", taxableValue: 45000, cgst: 2250, sgst: 2250, igst: 0 },
  { _id: "2b-4", gstin: "27AABCP3456I1ZS", invoiceNo: "PPC/2026/331", date: "2026-03-15", taxableValue: 32000, cgst: 2880, sgst: 2880, igst: 0 },
  { _id: "2b-5", gstin: "06AABCD7890J1ZT", invoiceNo: "DMH/INV/2026/78", date: "2026-03-18", taxableValue: 150000, cgst: 0, sgst: 0, igst: 25200 },
  // p6 (Mehta) missing entirely from 2B
  { _id: "2b-7", gstin: "29AABCB5678L1ZV", invoiceNo: "BTS/MAR/221", date: "2026-03-25", taxableValue: 95000, cgst: 0, sgst: 0, igst: 17100 },
  { _id: "2b-8", gstin: "33AABCC9012M1ZW", invoiceNo: "CRM/26/0445", date: "2026-03-28", taxableValue: 210000, cgst: 0, sgst: 0, igst: 37800 },
  // Extra in 2B - not in purchase register
  { _id: "2b-extra", gstin: "27AABCX1111N1ZX", invoiceNo: "XYZ/2026/99", date: "2026-03-30", taxableValue: 28000, cgst: 2520, sgst: 2520, igst: 0 },
];

export const COMPLIANCE_ITEMS = [
  { date: "2026-04-11", task: "GSTR-1 Filing (March 2026)", penalty: "₹50/day late fee (max ₹10,000)", priority: "critical", section: "GST" },
  { date: "2026-04-15", task: "PF Challan Payment (March)", penalty: "₹5/day per employee + 12% damages", priority: "critical", section: "Labour" },
  { date: "2026-04-15", task: "ESI Challan Payment (March)", penalty: "₹5/day per employee", priority: "high", section: "Labour" },
  { date: "2026-04-20", task: "GSTR-3B Filing + Tax Payment (March)", penalty: "₹50/day + 18% p.a. interest on tax", priority: "critical", section: "GST" },
  { date: "2026-04-30", task: "TDS Return Filing - Q4 (Form 26Q)", penalty: "₹200/day (max = TDS amount)", priority: "critical", section: "Income Tax" },
  { date: "2026-04-30", task: "TDS Return Filing - Q4 (Form 24Q - Salary)", penalty: "₹200/day (max = TDS amount)", priority: "high", section: "Income Tax" },
  { date: "2026-04-30", task: "Professional Tax - Q4 (State-specific)", penalty: "Varies by state", priority: "medium", section: "State" },
  { date: "2026-05-15", task: "TDS Certificate Issue - Form 16A (Q4)", penalty: "₹100/day per certificate", priority: "high", section: "Income Tax" },
  { date: "2026-06-15", task: "Advance Tax - Q1 Installment (15%)", penalty: "Interest u/s 234C", priority: "high", section: "Income Tax" },
  { date: "2026-06-15", task: "TDS Certificate - Form 16 (Salary)", penalty: "₹100/day per certificate", priority: "high", section: "Income Tax" },
  { date: "2026-07-31", task: "Income Tax Return (non-audit)", penalty: "₹5,000 late fee (₹1,000 if income <₹5L)", priority: "critical", section: "Income Tax" },
  { date: "2026-09-15", task: "Advance Tax - Q2 Installment (45%)", penalty: "Interest u/s 234C", priority: "high", section: "Income Tax" },
  { date: "2026-09-30", task: "DIR-3 KYC for Directors", penalty: "₹5,000 + DIN deactivation", priority: "high", section: "MCA" },
  { date: "2026-10-30", task: "MCA AOC-4 (Financial Statements)", penalty: "₹100/day per form", priority: "high", section: "MCA" },
  { date: "2026-10-31", task: "Tax Audit Report (Form 3CD)", penalty: "0.5% of turnover (max ₹1.5L)", priority: "critical", section: "Income Tax" },
  { date: "2026-10-31", task: "Income Tax Return (audit cases)", penalty: "₹5,000 late fee", priority: "critical", section: "Income Tax" },
  { date: "2026-11-29", task: "MCA MGT-7 (Annual Return)", penalty: "₹100/day per form", priority: "high", section: "MCA" },
  { date: "2026-12-15", task: "Advance Tax - Q3 Installment (75%)", penalty: "Interest u/s 234C", priority: "high", section: "Income Tax" },
  { date: "2026-12-31", task: "GSTR-9 Annual Return (FY 2025-26)", penalty: "₹200/day (max 0.5% of turnover)", priority: "critical", section: "GST" },
  { date: "2027-03-15", task: "Advance Tax - Q4 Installment (100%)", penalty: "Interest u/s 234B & 234C", priority: "high", section: "Income Tax" },
];

export const colors = {
  bg: "#080c14",
  card: "#0f1520",
  border: "#1c2536",
  accent: "#22c55e",
  accentDim: "rgba(34,197,94,0.08)",
  text: "#e2e8f0",
  textDim: "#64748b",
  textMid: "#94a3b8",
  danger: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
};
