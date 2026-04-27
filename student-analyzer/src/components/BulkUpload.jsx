import { useState, useRef } from "react";
import { api } from "../lib/api";
import { whatsappUrl } from "../lib/share";
import { c, card, btn } from "../lib/theme";

const fmtIST = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

function StatusIcon({ status }) {
  if (status === "waiting")   return <span style={{ color: c.textDim, fontSize: 16 }}>◯</span>;
  if (status === "analyzing") return <span style={{ color: c.accent, fontSize: 16 }}>↻</span>;
  if (status === "done")      return <span style={{ color: c.success, fontSize: 16 }}>✓</span>;
  if (status === "error")     return <span style={{ color: c.danger, fontSize: 16 }}>✕</span>;
  return null;
}

export default function BulkUpload({ params, navigate, isMobile }) {
  const { testId, testName } = params;
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef();
  const p = isMobile ? 16 : 28;

  const addFiles = (newFiles) => {
    const filtered = Array.from(newFiles).filter(
      (f) => !files.find((x) => x.name === f.name && x.size === f.size)
    );
    setFiles((prev) => [...prev, ...filtered]);
    setItems((prev) => [...prev, ...filtered.map((f) => ({ file: f, status: "waiting" }))]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const analyze = async () => {
    if (!files.length || running) return;
    setRunning(true); setDone(false);
    setItems((prev) => prev.map((it) => ({ ...it, status: "waiting", analysis: null, error: null })));
    try {
      await api.analyzeSheets(testId, files, (event) => {
        if (event.type === "progress") {
          setItems((prev) => prev.map((it, i) => i === event.index ? { ...it, status: "analyzing" } : it));
        } else if (event.type === "result") {
          setItems((prev) => prev.map((it, i) =>
            i === event.index ? { ...it, status: "done", analysis: event.analysis, resultId: event.resultId, shareToken: event.shareToken, analyzedAt: new Date().toISOString() } : it
          ));
        } else if (event.type === "error") {
          setItems((prev) => prev.map((it, i) => i === event.index ? { ...it, status: "error", error: event.error } : it));
        } else if (event.type === "done") {
          setDone(true);
        }
      });
    } catch (err) { console.error(err); }
    finally { setRunning(false); setDone(true); }
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const errCount  = items.filter((it) => it.status === "error").length;

  return (
    <div style={{ padding: p, maxWidth: 800, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("dashboard")}>
        ← Back to Tests
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: c.text }}>Upload Answer Sheets</h1>
          <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            Test: <strong style={{ color: c.text }}>{testName}</strong>
          </p>
        </div>
        {done && doneCount > 0 && (
          <button style={{ ...btn.secondary, fontSize: 12, whiteSpace: "nowrap" }} onClick={() => navigate("students")}>
            View Results →
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!running && (
        <div style={card}>
          <div style={{ border: `2px dashed ${c.border}`, borderRadius: 8, padding: isMobile ? 24 : 32, textAlign: "center", cursor: "pointer" }}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.accent; }}
            onDragLeave={(e) => e.currentTarget.style.borderColor = c.border}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.border; addFiles(e.dataTransfer.files); }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: c.text, marginBottom: 4 }}>
              {isMobile ? "Tap to select answer sheets" : "Drop answer sheets here"}
            </div>
            <div style={{ fontSize: 12, color: c.textMid }}>PDF, JPG, PNG · up to 50 files</div>
            <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>Each file = one student's sheet</div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: c.textMid }}>{files.length} file{files.length !== 1 ? "s" : ""} selected</span>
              <button style={btn.primary} onClick={analyze} disabled={running}>Analyze All →</button>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {running && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMid, marginBottom: 8 }}>
            <span>Analyzing… {doneCount + errCount} / {items.length}</span>
            <span>{Math.round(((doneCount + errCount) / items.length) * 100)}%</span>
          </div>
          <div style={{ height: 4, background: c.border, borderRadius: 2 }}>
            <div style={{ height: "100%", background: c.accent, borderRadius: 2, transition: "width 0.3s", width: `${((doneCount + errCount) / items.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Summary */}
      {done && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, ...card, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.success }}>{doneCount}</div>
            <div style={{ fontSize: 11, color: c.textMid, marginTop: 2 }}>Analyzed</div>
          </div>
          {errCount > 0 && (
            <div style={{ flex: 1, ...card, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.danger }}>{errCount}</div>
              <div style={{ fontSize: 11, color: c.textMid, marginTop: 2 }}>Failed</div>
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ ...card, padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ paddingTop: 2, flexShrink: 0 }}><StatusIcon status={item.status} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.file.name}
                  </span>
                  {item.status === "done" && item.analysis && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
                      {item.analysis.marks_obtained}/{item.analysis.total_marks}
                    </span>
                  )}
                </div>

                {item.analyzedAt && (
                  <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>{fmtIST(item.analyzedAt)}</div>
                )}

                {item.status === "done" && item.analysis && !item.analysis.parse_error && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: c.textMid }}>
                      <strong style={{ color: c.text }}>{item.analysis.student?.name || "Unknown"}</strong>
                      {item.analysis.student?.roll_no && <span> · Roll: {item.analysis.student.roll_no}</span>}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.resultId && (
                        <button style={{ ...btn.secondary, fontSize: 11, padding: "5px 12px" }} onClick={() => navigate("result", { resultId: item.resultId })}>
                          View Result
                        </button>
                      )}
                      {item.shareToken && (
                        <a href={whatsappUrl(item.shareToken, item.analysis.student?.name, testName)}
                          target="_blank" rel="noopener noreferrer"
                          style={{ ...btn.ghost, fontSize: 11, padding: "5px 12px", textDecoration: "none", color: c.success, border: `1px solid ${c.success}30`, borderRadius: 6 }}>
                          Share
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {item.status === "done" && item.analysis?.parse_error && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: c.warning, marginBottom: 6 }}>
                      ⚠ Claude's response could not be parsed — the PDF may be unreadable or encrypted.
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {item.resultId && (
                        <button style={{ ...btn.secondary, fontSize: 11, padding: "5px 12px" }} onClick={() => navigate("result", { resultId: item.resultId })}>
                          View Raw Response
                        </button>
                      )}
                    </div>
                    {item.analysis.raw && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 11, color: c.textDim, cursor: "pointer" }}>Show Claude's output</summary>
                        <pre style={{ fontSize: 10, color: c.textMid, background: c.bg, padding: "8px 10px", borderRadius: 6, marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflowY: "auto" }}>
                          {item.analysis.raw}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {item.status === "error" && <div style={{ fontSize: 12, color: c.danger, marginTop: 4 }}>{item.error}</div>}
                {item.status === "analyzing" && <div style={{ fontSize: 12, color: c.accent, marginTop: 4 }}>Analyzing…</div>}
              </div>
              {item.status === "waiting" && !running && (
                <button style={{ ...btn.ghost, padding: "2px 8px", flexShrink: 0 }} onClick={() => removeFile(idx)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
