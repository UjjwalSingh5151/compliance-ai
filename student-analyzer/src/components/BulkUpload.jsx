import { useState, useRef } from "react";
import { api } from "../lib/api";
import { whatsappUrl, shareUrl } from "../lib/share";
import { c, card, btn } from "../lib/theme";

function StatusIcon({ status }) {
  if (status === "waiting")   return <span style={{ color: c.textDim }}>◯</span>;
  if (status === "analyzing") return <span style={{ color: c.accent, animation: "spin 1s linear infinite" }}>↻</span>;
  if (status === "done")      return <span style={{ color: c.success }}>✓</span>;
  if (status === "error")     return <span style={{ color: c.danger }}>✕</span>;
  return null;
}

function ScoreBadge({ obtained, total }) {
  if (obtained == null) return null;
  const pct = Math.round((obtained / total) * 100);
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{obtained}/{total} ({pct}%)</span>;
}

export default function BulkUpload({ params, navigate }) {
  const { testId, testName } = params;
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]); // { file, status, analysis, resultId, shareToken, error }
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef();

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
    // Reset statuses
    setItems((prev) => prev.map((it) => ({ ...it, status: "waiting", analysis: null, error: null })));

    try {
      await api.analyzeSheets(testId, files, (event) => {
        if (event.type === "progress") {
          setItems((prev) =>
            prev.map((it, i) => i === event.index ? { ...it, status: "analyzing" } : it)
          );
        } else if (event.type === "result") {
          setItems((prev) =>
            prev.map((it, i) =>
              i === event.index
                ? { ...it, status: "done", analysis: event.analysis, resultId: event.resultId, shareToken: event.shareToken }
                : it
            )
          );
        } else if (event.type === "error") {
          setItems((prev) =>
            prev.map((it, i) => i === event.index ? { ...it, status: "error", error: event.error } : it)
          );
        } else if (event.type === "done") {
          setDone(true);
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
      setDone(true);
    }
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const errCount  = items.filter((it) => it.status === "error").length;

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <button style={{ ...btn.ghost, marginBottom: 20, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("dashboard")}>
        ← Back to Tests
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Upload Answer Sheets</h1>
          <p style={{ fontSize: 13, color: c.textMid, marginTop: 2 }}>Test: <strong style={{ color: c.text }}>{testName}</strong></p>
        </div>
        {done && doneCount > 0 && (
          <button style={btn.secondary} onClick={() => navigate("students")}>
            View All Results →
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!running && (
        <div style={card}>
          <div
            style={{ border: `2px dashed ${c.border}`, borderRadius: 8, padding: 32, textAlign: "center", cursor: "pointer", transition: "border-color 0.15s" }}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.accent; }}
            onDragLeave={(e) => e.currentTarget.style.borderColor = c.border}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.border; addFiles(e.dataTransfer.files); }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 4 }}>
              Drop answer sheets here
            </div>
            <div style={{ fontSize: 12, color: c.textMid }}>
              Supports PDF, JPG, PNG — up to 50 files at once
            </div>
            <div style={{ fontSize: 11, color: c.textDim, marginTop: 4 }}>
              Each file = one student's answer sheet. First page should show student name & roll number.
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: c.textMid }}>{files.length} file{files.length !== 1 ? "s" : ""} selected</span>
              <button style={btn.primary} onClick={analyze} disabled={running}>
                Analyze All →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {running && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMid, marginBottom: 8 }}>
            <span>Analyzing… {doneCount + errCount} / {items.length}</span>
            <span>{Math.round(((doneCount + errCount) / items.length) * 100)}%</span>
          </div>
          <div style={{ height: 4, background: c.border, borderRadius: 2 }}>
            <div style={{ height: "100%", background: c.accent, borderRadius: 2, transition: "width 0.3s", width: `${((doneCount + errCount) / items.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Summary after done */}
      {done && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, textAlign: "center", paddingTop: 1 }}>
                <StatusIcon status={item.status} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                    {item.file.name}
                  </span>
                  {item.status === "done" && item.analysis && (
                    <ScoreBadge obtained={item.analysis.marks_obtained} total={item.analysis.total_marks} />
                  )}
                </div>

                {item.status === "done" && item.analysis && !item.analysis.parse_error && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: c.textMid }}>
                      <strong style={{ color: c.text }}>{item.analysis.student?.name || "Unknown"}</strong>
                      {item.analysis.student?.roll_no && <span> · Roll: {item.analysis.student.roll_no}</span>}
                      {item.analysis.student?.class && <span> · Class: {item.analysis.student.class}{item.analysis.student.section ? `-${item.analysis.student.section}` : ""}</span>}
                    </div>
                    {item.analysis.overall_feedback && (
                      <div style={{ fontSize: 12, color: c.textDim, marginTop: 4, lineHeight: 1.5 }}>{item.analysis.overall_feedback}</div>
                    )}
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      {item.resultId && (
                        <button style={btn.secondary} onClick={() => navigate("result", { resultId: item.resultId })}>
                          View Full Result
                        </button>
                      )}
                      {item.shareToken && (
                        <ShareButton token={item.shareToken} studentName={item.analysis.student?.name} testName={params.testName} />
                      )}
                    </div>
                  </div>
                )}

                {item.status === "error" && (
                  <div style={{ fontSize: 12, color: c.danger, marginTop: 4 }}>{item.error}</div>
                )}

                {item.status === "analyzing" && (
                  <div style={{ fontSize: 12, color: c.accent, marginTop: 4 }}>Claude is reading the answer sheet…</div>
                )}
              </div>

              {item.status === "waiting" && !running && (
                <button style={btn.ghost} onClick={() => removeFile(idx)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareButton({ token, studentName, testName }) {
  return (
    <a
      href={whatsappUrl(token, studentName, testName)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...btn.ghost, padding: "4px 12px", fontSize: 12, textDecoration: "none", color: c.success, border: `1px solid ${c.success}30`, borderRadius: 6 }}
    >
      Share on WhatsApp
    </a>
  );
}
