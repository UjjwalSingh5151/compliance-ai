import { useState, useEffect, useCallback, useRef } from "react";
import { colors, SAMPLE_PURCHASES, SAMPLE_2B } from "../lib/compliance-data";
import { reconcileData } from "../lib/reconciliation-engine";
import { parseCSV } from "../lib/csv-parser";
import { parseGSTR2BJSON } from "../lib/gstr2b-parser";

const Pill = ({ color, children }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: `${color}15`,
      color,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const StatCard = ({ label, value, sub, color }) => (
  <div
    style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    }}
  >
    <div
      style={{
        fontSize: 10,
        color: colors.textDim,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: color || colors.accent,
        marginTop: 4,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {value}
    </div>
    {sub && <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>{sub}</div>}
  </div>
);

function FileUpload({ label, accept, onData, hint }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const ref = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (file.name.endsWith(".json")) {
        try {
          onData(JSON.parse(text), "json");
        } catch {
          onData(text, "text");
        }
      } else {
        onData(text, "csv");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => ref.current?.click()}
      style={{
        border: `2px dashed ${dragging ? colors.accent : colors.border}`,
        borderRadius: 12,
        padding: "24px 16px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? colors.accentDim : "transparent",
        transition: "all 0.2s",
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div style={{ fontSize: 28, marginBottom: 8 }}>{fileName ? "✅" : "📁"}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{fileName || label}</div>
      <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

export default function Reconciliation({ reconResults, setReconResults, onAgentMessage }) {
  const [purchases, setPurchases] = useState(null);
  const [gstr2b, setGstr2b] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadWarnings, setUploadWarnings] = useState([]);

  const handleParsedCSV = (parsed, setter) => {
    if (parsed.warnings?.length) setUploadWarnings((w) => [...w, ...parsed.warnings]);
    setter(parsed.data);
  };

  const runReconciliation = useCallback(() => {
    if (!purchases || !gstr2b) return;
    setLoading(true);
    setTimeout(() => {
      const results = reconcileData(purchases, gstr2b);
      setReconResults(results);
      setLoading(false);
      const stats = {
        matched: results.filter((r) => r.status === "matched").length,
        mismatch: results.filter((r) => r.status === "mismatch").length,
        missing: results.filter((r) => r.status === "missing").length,
        extra: results.filter((r) => r.status === "extra_in_2b").length,
        atRisk: results.reduce((a, r) => a + r.itcAtRisk, 0),
      };
      // Notify agent but don't switch tabs — user stays on Reconciliation
      onAgentMessage(
        `Reconciliation complete! ${stats.matched} matched, ${stats.mismatch} mismatched, ${stats.missing} missing from 2B. ITC at risk: ₹${stats.atRisk.toLocaleString()}.`,
        false
      );
    }, 800);
  }, [purchases, gstr2b, setReconResults, onAgentMessage]);

  const loadSampleData = () => {
    setPurchases(SAMPLE_PURCHASES);
    setGstr2b(SAMPLE_2B);
  };

  useEffect(() => {
    if (purchases && gstr2b) runReconciliation();
  }, [purchases, gstr2b, runReconciliation]);

  const stats = reconResults
    ? {
        total: reconResults.length,
        matched: reconResults.filter((r) => r.status === "matched").length,
        mismatch: reconResults.filter((r) => r.status === "mismatch").length,
        missing: reconResults.filter((r) => r.status === "missing").length,
        extra: reconResults.filter((r) => r.status === "extra_in_2b").length,
        totalITC: reconResults.reduce((a, r) => a + r.itcAmount, 0),
        atRisk: reconResults.reduce((a, r) => a + r.itcAtRisk, 0),
      }
    : null;

  const statusConfig = {
    matched: { label: "Matched", color: colors.accent, icon: "✓" },
    mismatch: { label: "Mismatch", color: colors.warn, icon: "⚠" },
    missing: { label: "Missing from 2B", color: colors.danger, icon: "✗" },
    extra_in_2b: { label: "Extra in 2B", color: colors.info, icon: "+" },
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 700 }}>
            GSTR-2B Reconciliation
          </h2>
          <p style={{ color: colors.textDim, fontSize: 12, margin: "4px 0 0" }}>
            Upload purchase register + GSTR-2B JSON to auto-reconcile
          </p>
        </div>
        <button
          onClick={loadSampleData}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.textMid,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Load sample data
        </button>
      </div>

      {uploadWarnings.length > 0 && (
        <div style={{ background: `${colors.warn}15`, border: `1px solid ${colors.warn}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          {uploadWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: colors.warn }}>⚠ {w}</div>
          ))}
        </div>
      )}

      {!reconResults && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <FileUpload
            label="Upload Purchase Register"
            accept=".csv,.json"
            hint="Any CSV — columns auto-detected (gstin, invoice no, tax amounts)"
            onData={(data, type) => {
              setUploadWarnings([]);
              if (type === "json") setPurchases(Array.isArray(data) ? data : []);
              else handleParsedCSV(parseCSV(data), setPurchases);
            }}
          />
          <FileUpload
            label="Upload GSTR-2B JSON"
            accept=".json,.csv"
            hint="JSON from GST portal, or any CSV with invoice data"
            onData={(data, type) => {
              if (type === "json") setGstr2b(parseGSTR2BJSON(data));
              else handleParsedCSV(parseCSV(data), setGstr2b);
            }}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: colors.accent }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontSize: 14 }}>Reconciling invoices...</div>
        </div>
      )}

      {stats && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatCard label="Total entries" value={stats.total} color={colors.textMid} />
            <StatCard label="Matched" value={stats.matched} color={colors.accent} />
            <StatCard label="Mismatched" value={stats.mismatch} color={colors.warn} />
            <StatCard label="Missing" value={stats.missing} color={colors.danger} />
            <StatCard
              label="Total ITC"
              value={`₹${stats.totalITC.toLocaleString()}`}
              color={colors.accent}
            />
            <StatCard
              label="ITC at risk"
              value={`₹${stats.atRisk.toLocaleString()}`}
              color={colors.danger}
            />
          </div>

          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 0.9fr 0.9fr 1.2fr",
                padding: "8px 14px",
                background: colors.bg,
                fontSize: 10,
                color: colors.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              <span>Vendor / Invoice</span>
              <span>GSTIN</span>
              <span style={{ textAlign: "right" }}>Tax Amount</span>
              <span style={{ textAlign: "right" }}>ITC Risk</span>
              <span style={{ textAlign: "center" }}>Status</span>
            </div>

            {reconResults.map((r, i) => {
              const sc = statusConfig[r.status];
              const name =
                r.invoice?.vendor ||
                r.match?.vendor ||
                `GSTIN: ${(r.match?.gstin || "").slice(0, 15)}`;
              const inv = r.invoice?.invoiceNo || r.match?.invoiceNo || "—";
              const tax = r.itcAmount;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 0.9fr 0.9fr 1.2fr",
                    padding: "10px 14px",
                    borderTop: `1px solid ${colors.border}`,
                    fontSize: 13,
                    color: colors.text,
                    background: r.status !== "matched" ? `${sc.color}06` : "transparent",
                  }}
                >
                  <span>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
                    <div style={{ fontSize: 11, color: colors.textDim }}>
                      {inv} · {r.invoice?.date || r.match?.date || ""}
                    </div>
                    {r.status !== "matched" && (
                      <div style={{ fontSize: 11, color: sc.color, marginTop: 2 }}>{r.reason}</div>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: colors.textMid,
                      alignSelf: "center",
                    }}
                  >
                    {(r.invoice?.gstin || r.match?.gstin || "").slice(0, 15)}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      alignSelf: "center",
                    }}
                  >
                    ₹{tax.toLocaleString()}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      alignSelf: "center",
                      color: r.itcAtRisk > 0 ? colors.danger : colors.textDim,
                    }}
                  >
                    {r.itcAtRisk > 0 ? `₹${r.itcAtRisk.toLocaleString()}` : "—"}
                  </span>
                  <span style={{ textAlign: "center", alignSelf: "center" }}>
                    <Pill color={sc.color}>
                      {sc.icon} {sc.label}
                    </Pill>
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              onClick={() => setReconResults(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textMid,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Re-upload data
            </button>
            <button
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: colors.accent,
                color: colors.bg,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Export Report (CSV)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
