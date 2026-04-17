export function reconcileData(purchaseInvoices, gstr2bInvoices) {
  const results = [];
  const used2bIds = new Set();

  for (const pi of purchaseInvoices) {
    const gstin = (pi.gstin || "").replace(/\s/g, "").toUpperCase();
    let bestMatch = null;
    let matchType = "missing";

    for (const g2b of gstr2bInvoices) {
      if (used2bIds.has(g2b._id)) continue;
      const g2bGstin = (g2b.gstin || "").replace(/\s/g, "").toUpperCase();
      if (gstin !== g2bGstin) continue;

      const piTax = Number(pi.cgst || 0) + Number(pi.sgst || 0) + Number(pi.igst || 0);
      const g2bTax = Number(g2b.cgst || 0) + Number(g2b.sgst || 0) + Number(g2b.igst || 0);
      const taxDiff = Math.abs(piTax - g2bTax);
      const valDiff = Math.abs(Number(pi.taxableValue || 0) - Number(g2b.taxableValue || 0));

      if (taxDiff === 0 && valDiff === 0) {
        bestMatch = { ...g2b, taxDiff: 0, valDiff: 0 };
        matchType = "matched";
        break;
      } else if (taxDiff < piTax * 0.15 || valDiff < Number(pi.taxableValue) * 0.15) {
        bestMatch = { ...g2b, taxDiff, valDiff };
        matchType = "mismatch";
      }
    }

    if (bestMatch) used2bIds.add(bestMatch._id);

    const piTax = Number(pi.cgst || 0) + Number(pi.sgst || 0) + Number(pi.igst || 0);
    results.push({
      invoice: pi,
      match: bestMatch,
      status: matchType,
      itcAmount: piTax,
      itcAtRisk: matchType !== "matched" ? piTax : 0,
      reason:
        matchType === "matched"
          ? "Perfectly matched"
          : matchType === "mismatch"
          ? `Tax diff: ₹${bestMatch.taxDiff.toLocaleString()}, Value diff: ₹${bestMatch.valDiff.toLocaleString()}`
          : "Invoice not found in GSTR-2B. Vendor may not have filed GSTR-1.",
    });
  }

  for (const g2b of gstr2bInvoices) {
    if (!used2bIds.has(g2b._id)) {
      const g2bTax = Number(g2b.cgst || 0) + Number(g2b.sgst || 0) + Number(g2b.igst || 0);
      results.push({
        invoice: null,
        match: g2b,
        status: "extra_in_2b",
        itcAmount: g2bTax,
        itcAtRisk: 0,
        reason: "Present in GSTR-2B but not in your purchase register. Potential unclaimed ITC.",
      });
    }
  }

  return results;
}
