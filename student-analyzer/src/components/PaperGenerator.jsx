import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

// ─── Print helper ─────────────────────────────────────────────────────────────

function buildPrintHTML(paper) {
  const h = paper.header || {};
  const sections = paper.sections || [];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${paper.title || "Question Paper"}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", serif; padding: 18mm 22mm; font-size: 12pt; color: #000; line-height: 1.4; }
  h1 { text-align: center; font-size: 17pt; font-weight: bold; margin-bottom: 4pt; }
  .meta { text-align: center; font-size: 11pt; margin-bottom: 4pt; }
  hr { border: none; border-top: 1.5px solid #000; margin: 8pt 0; }
  .instr-title { font-weight: bold; margin-bottom: 4pt; }
  .instr-list { padding-left: 18pt; margin-bottom: 6pt; }
  .instr-list li { margin-bottom: 2pt; }
  .section-title { font-weight: bold; text-decoration: underline; margin: 14pt 0 4pt; font-size: 12pt; }
  .section-desc { font-style: italic; font-size: 11pt; margin-bottom: 6pt; }
  .question { display: flex; gap: 6pt; margin-bottom: 8pt; }
  .q-no { min-width: 24pt; font-weight: bold; flex-shrink: 0; }
  .q-body { flex: 1; }
  .q-marks { min-width: 36pt; text-align: right; font-size: 10.5pt; flex-shrink: 0; }
  .options { margin-top: 4pt; padding-left: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 2pt; }
  .options li { font-size: 11pt; }
  @page { margin: 18mm 22mm; }
</style>
</head>
<body>
  <h1>${paper.title || ""}</h1>
  <div class="meta">
    ${[h.class && `Class: ${h.class}`, h.subject && `Subject: ${h.subject}`, h.board, h.total_marks && `Total Marks: ${h.total_marks}`, h.time && `Time: ${h.time}`].filter(Boolean).join("&nbsp;&nbsp;|&nbsp;&nbsp;")}
  </div>
  <hr>
  ${paper.general_instructions?.length ? `
  <div class="instr-title">General Instructions:</div>
  <ol class="instr-list">${paper.general_instructions.map((i) => `<li>${i}</li>`).join("")}</ol>
  <hr>` : ""}
  ${sections.map((sec) => `
  <div class="section-title">${sec.name || ""}</div>
  ${sec.description ? `<div class="section-desc">${sec.description}</div>` : ""}
  ${(sec.questions || []).map((q) => `
  <div class="question">
    <span class="q-no">${q.no}.</span>
    <span class="q-body">
      ${q.text || ""}
      ${q.options?.length ? `<ul class="options">${q.options.map((o) => `<li>${o}</li>`).join("")}</ul>` : ""}
    </span>
    <span class="q-marks">[${q.marks}]</span>
  </div>`).join("")}
  `).join("")}
</body>
</html>`;
}

function printPaper(paper) {
  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups to download the PDF."); return; }
  win.document.write(buildPrintHTML(paper));
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// ─── Paper preview ────────────────────────────────────────────────────────────

function PaperPreview({ paper, onClose, isMobile }) {
  const p = isMobile ? 14 : 20;
  const h = paper.header || {};
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: isMobile ? 0 : 24 }}>
      <div style={{ background: c.card, width: "100%", maxWidth: 760, borderRadius: isMobile ? 0 : 12, border: `1px solid ${c.border}`, display: "flex", flexDirection: "column", minHeight: isMobile ? "100vh" : "auto" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 12 }}>{paper.title}</div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={{ ...btn.primary, fontSize: 12, padding: "7px 14px" }} onClick={() => printPaper(paper)}>
              🖨 Download PDF
            </button>
            <button style={{ ...btn.ghost, fontSize: 18, padding: "4px 8px", lineHeight: 1 }} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Paper content */}
        <div style={{ padding: p, overflowY: "auto", flex: 1, fontFamily: "'Times New Roman', serif", color: c.text }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{paper.title}</div>
            <div style={{ fontSize: 13, color: c.textMid }}>
              {[h.class && `Class ${h.class}`, h.subject, h.board, h.total_marks && `${h.total_marks} Marks`, h.time].filter(Boolean).join("  ·  ")}
            </div>
          </div>
          <div style={{ borderTop: `1.5px solid ${c.border}`, marginBottom: 12 }} />

          {paper.general_instructions?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.textMid, marginBottom: 6 }}>General Instructions:</div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {paper.general_instructions.map((ins, i) => (
                  <li key={i} style={{ fontSize: 13, color: c.textMid, marginBottom: 3 }}>{ins}</li>
                ))}
              </ol>
              <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 12 }} />
            </div>
          )}

          {(paper.sections || []).map((sec, si) => (
            <div key={si} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textDecoration: "underline", marginBottom: 4, color: c.text }}>{sec.name}</div>
              {sec.description && <div style={{ fontSize: 12, fontStyle: "italic", color: c.textMid, marginBottom: 8 }}>{sec.description}</div>}
              {(sec.questions || []).map((q) => (
                <div key={q.no} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <span style={{ minWidth: 24, fontWeight: 700, fontSize: 13, color: c.text, flexShrink: 0 }}>{q.no}.</span>
                  <span style={{ flex: 1, fontSize: 13, color: c.text, lineHeight: 1.55 }}>
                    {q.text}
                    {q.options?.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", marginTop: 4 }}>
                        {q.options.map((opt, oi) => (
                          <span key={oi} style={{ fontSize: 12, color: c.textMid }}>{opt}</span>
                        ))}
                      </div>
                    )}
                  </span>
                  <span style={{ minWidth: 32, textAlign: "right", fontSize: 11, color: c.textDim, flexShrink: 0 }}>[{q.marks}]</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── File drop zone ───────────────────────────────────────────────────────────

function FileZone({ label, accept, file, setFile, required }) {
  const ref = useRef();
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 6, letterSpacing: 0.5 }}>
        {label}{required && " *"}
      </label>
      {file ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: c.accentDim, borderRadius: 8, border: `1px solid ${c.accent}40` }}>
          <span style={{ fontSize: 13, color: c.accent, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {file.name}</span>
          <button type="button" style={{ ...btn.ghost, padding: "2px 8px", color: c.danger, fontSize: 13 }} onClick={() => setFile(null)}>✕</button>
        </div>
      ) : (
        <div
          style={{ border: `2px dashed ${c.border}`, borderRadius: 8, padding: "18px 16px", textAlign: "center", cursor: "pointer" }}
          onClick={() => ref.current.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.accent; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = c.border; }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.border; setFile(e.dataTransfer.files[0] || null); }}>
          <div style={{ fontSize: 12, color: c.textMid }}>Tap to upload or drag & drop</div>
          <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>{accept}</div>
          <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0] || null)} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BOARDS = ["CBSE", "ICSE", "IB", "State Board", "Other"];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mixed"];

export default function PaperGenerator({ isMobile }) {
  const [mode, setMode] = useState("ai");
  const [papers, setPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [previewPaper, setPreviewPaper] = useState(null);

  // Mode 1 state
  const [formatFile, setFormatFile] = useState(null);
  const [cls, setCls] = useState("");
  const [subject, setSubject] = useState("");
  const [board, setBoard] = useState("CBSE");
  const [totalMarks, setTotalMarks] = useState("50");
  const [difficulty, setDifficulty] = useState("Medium");
  const [extraInstructions, setExtraInstructions] = useState("");

  // Mode 2 state
  const [formatFile2, setFormatFile2] = useState(null);
  const [handwrittenFile, setHandwrittenFile] = useState(null);

  const p = isMobile ? 16 : 28;

  const loadPapers = () => {
    setPapersLoading(true);
    api.getPapers().then(({ papers }) => setPapers(papers || [])).finally(() => setPapersLoading(false));
  };
  useEffect(loadPapers, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true); setGenError(null);
    try {
      const fd = new FormData();
      fd.append("cls", cls.trim());
      fd.append("subject", subject.trim());
      fd.append("board", board);
      fd.append("totalMarks", totalMarks);
      fd.append("difficulty", difficulty);
      fd.append("extraInstructions", extraInstructions.trim());
      if (formatFile) fd.append("format", formatFile);
      const { paper } = await api.generatePaper(fd);
      setPapers((prev) => [paper, ...prev]);
      setPreviewPaper(paper);
    } catch (err) { setGenError(err.message); }
    finally { setGenerating(false); }
  };

  const handleTranscribe = async (e) => {
    e.preventDefault();
    if (!formatFile2 || !handwrittenFile) return;
    setGenerating(true); setGenError(null);
    try {
      const fd = new FormData();
      fd.append("format", formatFile2);
      fd.append("handwritten", handwrittenFile);
      const { paper } = await api.transcribePaper(fd);
      setPapers((prev) => [paper, ...prev]);
      setPreviewPaper(paper);
    } catch (err) { setGenError(err.message); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this paper?")) return;
    await api.deletePaper(id).catch((e) => alert(e.message));
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  const openPaper = async (id) => {
    const cached = papers.find((p) => p.id === id && p.content);
    if (cached?.content) { setPreviewPaper(cached); return; }
    const { paper } = await api.getPaper(id);
    setPapers((prev) => prev.map((p) => p.id === id ? paper : p));
    setPreviewPaper(paper);
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ padding: p, maxWidth: 820, margin: "0 auto" }}>
      <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text, marginBottom: 4 }}>Question Paper Generator</h1>
      <p style={{ fontSize: 12, color: c.textMid, marginBottom: 20 }}>
        AI-generate a paper from specs, or digitize a handwritten draft.
      </p>

      {/* Mode tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, marginBottom: 20 }}>
        {[{ id: "ai", label: "✨ AI Generate" }, { id: "transcribe", label: "✍️ Transcribe Handwritten" }].map((tab) => (
          <button key={tab.id} onClick={() => { setMode(tab.id); setGenError(null); }}
            style={{ padding: "10px 18px", background: "transparent", border: "none", borderBottom: `2px solid ${mode === tab.id ? c.accent : "transparent"}`, color: mode === tab.id ? c.accent : c.textDim, fontSize: 13, fontWeight: mode === tab.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Mode 1: AI Generate ── */}
      {mode === "ai" && (
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 12 }}>UPLOAD SAMPLE FORMAT <span style={{ color: c.textDim, fontWeight: 400 }}>(optional — AI will follow its layout)</span></div>
            <FileZone label="Sample question paper" accept="PDF, JPG, PNG" file={formatFile} setFile={setFormatFile} required={false} />
          </div>

          <div style={{ ...card, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>CLASS</label>
              <input style={input} placeholder="e.g. 10" value={cls} onChange={(e) => setCls(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>SUBJECT *</label>
              <input style={input} placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>BOARD</label>
              <select style={{ ...input, appearance: "none", WebkitAppearance: "none" }} value={board} onChange={(e) => setBoard(e.target.value)}>
                {BOARDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>TOTAL MARKS</label>
              <input style={input} type="number" min="10" max="200" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>DIFFICULTY</label>
              <select style={{ ...input, appearance: "none", WebkitAppearance: "none" }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div style={card}>
            <label style={{ fontSize: 11, fontWeight: 600, color: c.textDim, display: "block", marginBottom: 5 }}>ADDITIONAL INSTRUCTIONS <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ ...input, minHeight: 60, resize: "vertical", lineHeight: 1.6 }}
              placeholder="e.g. Include 5 MCQs, 3 short answer, 2 long answer. Focus on chapters 3-5."
              value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} />
          </div>

          {genError && <div style={{ fontSize: 13, color: c.danger, background: c.dangerDim, padding: "10px 14px", borderRadius: 8 }}>{genError}</div>}

          <button type="submit" style={{ ...btn.primary, padding: 12, opacity: generating ? 0.6 : 1 }} disabled={generating || !subject.trim()}>
            {generating ? "Generating… (this takes 20–40 seconds)" : "✨ Generate Question Paper"}
          </button>
        </form>
      )}

      {/* ── Mode 2: Transcribe handwritten ── */}
      {mode === "transcribe" && (
        <form onSubmit={handleTranscribe} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid }}>DOCUMENTS TO UPLOAD</div>
            <FileZone label="Sample format (layout to follow)" accept="PDF, JPG, PNG" file={formatFile2} setFile={setFormatFile2} required={true} />
            <FileZone label="Handwritten question paper (to transcribe)" accept="JPG, PNG, PDF" file={handwrittenFile} setFile={setHandwrittenFile} required={true} />
          </div>
          <div style={{ fontSize: 12, color: c.textMid, background: c.card, padding: "10px 14px", borderRadius: 8, border: `1px solid ${c.border}` }}>
            AI will read every question from your handwritten paper and format it using the layout from your sample document.
          </div>

          {genError && <div style={{ fontSize: 13, color: c.danger, background: c.dangerDim, padding: "10px 14px", borderRadius: 8 }}>{genError}</div>}

          <button type="submit" style={{ ...btn.primary, padding: 12, opacity: generating ? 0.6 : 1 }} disabled={generating || !formatFile2 || !handwrittenFile}>
            {generating ? "Transcribing… (this takes 20–40 seconds)" : "✍️ Transcribe Paper"}
          </button>
        </form>
      )}

      {/* ── History ── */}
      <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.textDim, letterSpacing: "0.08em", marginBottom: 12 }}>GENERATED PAPERS</div>
        {papersLoading && <div style={{ fontSize: 13, color: c.textDim }}>Loading…</div>}
        {!papersLoading && papers.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 28, color: c.textDim, fontSize: 13 }}>
            No papers generated yet. Create one above.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {papers.map((paper) => (
            <div key={paper.id} style={{ ...card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paper.title}</div>
                <div style={{ fontSize: 11, color: c.textMid, marginTop: 2 }}>
                  {[paper.class && `Class ${paper.class}`, paper.subject, paper.board, paper.total_marks && `${paper.total_marks}M`, paper.difficulty].filter(Boolean).join(" · ")}
                  {" · "}<span style={{ color: paper.mode === "ai" ? c.accent : c.purple }}>{paper.mode === "ai" ? "AI" : "Transcribed"}</span>
                  {" · "}{fmtDate(paper.created_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px" }} onClick={() => openPaper(paper.id)}>Preview →</button>
                <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px", color: c.danger }} onClick={() => handleDelete(paper.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewPaper && <PaperPreview paper={previewPaper.content || previewPaper} onClose={() => setPreviewPaper(null)} isMobile={isMobile} />}
    </div>
  );
}
