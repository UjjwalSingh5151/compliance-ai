export function parseGSTR2BJSON(jsonData) {
  try {
    const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    const invoices = [];

    const b2b = data?.data?.docdata?.b2b || data?.b2b || data?.data?.b2b || [];
    for (const supplier of b2b) {
      const gstin = supplier.ctin || supplier.gstin || "";
      const docs = supplier.inv || supplier.docs || [];
      for (const inv of docs) {
        const items = inv.items || inv.itms || [
          {
            txval: inv.txval || inv.taxableValue || 0,
            camt: inv.camt || inv.cgst || 0,
            samt: inv.samt || inv.sgst || 0,
            iamt: inv.iamt || inv.igst || 0,
          },
        ];
        let txval = 0, camt = 0, samt = 0, iamt = 0;
        for (const item of items) {
          txval += Number(item.txval || item.taxableValue || 0);
          camt += Number(item.camt || item.cgst || 0);
          samt += Number(item.samt || item.sgst || 0);
          iamt += Number(item.iamt || item.igst || 0);
        }
        invoices.push({
          _id: `2b-${gstin}-${inv.inum || inv.invoiceNo || invoices.length}`,
          gstin,
          invoiceNo: inv.inum || inv.invoiceNo || "",
          date: inv.dt || inv.date || "",
          taxableValue: txval,
          cgst: camt,
          sgst: samt,
          igst: iamt,
        });
      }
    }

    if (invoices.length === 0 && Array.isArray(data)) {
      return data.map((inv, idx) => ({
        _id: `2b-flat-${idx}`,
        gstin: inv.gstin || inv.ctin || "",
        invoiceNo: inv.invoiceNo || inv.inum || "",
        date: inv.date || inv.dt || "",
        taxableValue: Number(inv.taxableValue || inv.txval || 0),
        cgst: Number(inv.cgst || inv.camt || 0),
        sgst: Number(inv.sgst || inv.samt || 0),
        igst: Number(inv.igst || inv.iamt || 0),
      }));
    }

    return invoices;
  } catch (e) {
    console.error("2B Parse error:", e);
    return [];
  }
}
