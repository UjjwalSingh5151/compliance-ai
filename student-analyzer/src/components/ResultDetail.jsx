import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { shareUrl, whatsappUrl } from "../lib/share";
import { c, card, btn, input } from "../lib/theme";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ pct, small }) {
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  const size = small ? 64 : 90;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", border: `4px solid ${color}`, background: `${color}15`, flexShrink: 0 }}>
      <span style={{ fontSize: small ? 16 : 22, fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

function QuestionCard({ q, comment, onCommentChange, onCommentSave, saving, isMobile }) {
  const pct = q.marks_available > 0 ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0;
  const markColor = pct === 100 ? c.success : pct >= 60 ? c.warning : c.danger;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "10px 12px" : "12px 16px", cursor: "pointer", background: c.card }}
        onClick={() => setExpanded((v) => !v)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${markColor}15`, border: `1px solid ${markColor}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: markColor }}>Q{q.no}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {q.feedback && (
            <div style={{ fontSize: 12, color: c.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {q.feedback}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: markColor }}>{q.marks_awarded}/{q.marks_available}</span>
          {comment && !isMobile && <span style={{ fontSize: 10, color: c.purple, background: c.purpleDim, padding: "2px 6px", borderRadius: 4 }}>noted</span>}
          <span style={{ color: c.textDim, fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: isMobile ? 12 : 16, background: c.bg, borderTop: `1px solid ${c.border}`, display: "flex", flexDirection: "column", gap: 12 }}>
          {q.student_answer && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, marginBottom: 4, letterSpacing: 0.5 }}>STUDENT'S ANSWER</div>
              <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.65, background: c.card, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}` }}>
                {q.student_answer}
              </div>
            </div>
          )}
          {(q.expected_answer || q.reasoning) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, marginBottom: 4, letterSpacing: 0.5 }}>EXPECTED ANSWER</div>
              <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.65, background: c.card, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}` }}>
                {q.expected_answer}
                {q.expected_answer && q.reasoning && (
                  <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 8, paddingTop: 8, fontSize: 12, color: c.textDim, lineHeight: 1.65 }}>
                    {q.reasoning}
                  </div>
                )}
                {!q.expected_answer && q.reasoning && q.reasoning}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, letterSpacing: 0.5 }}>MARKS AWARDED</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: markColor }}>{q.marks_awarded} / {q.marks_available}</span>
          </div>
          {q.feedback && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 4, letterSpacing: 0.5 }}>FEEDBACK TO STUDENT</div>
              <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.65 }}>{q.feedback}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.purple, marginBottom: 6, letterSpacing: 0.5 }}>TEACHER'S COMMENT</div>
            <textarea
              value={comment || ""}
              onChange={(e) => onCommentChange(String(q.no), e.target.value)}
              placeholder="Add your comment or override note…"
              rows={2}
              style={{ width: "100%", padding: "8px 12px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button style={{ ...btn.ghost, fontSize: 12, color: c.purple, border: `1px solid ${c.purple}40`, borderRadius: 6, padding: "4px 14px", opacity: saving ? 0.6 : 1 }}
                onClick={onCommentSave} disabled={saving}>
                {saving ? "Saving…" : "Save comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SheetViewer({ url, isMobile }) {
  const isPDF = url.toLowerCase().includes(".pdf") || url.toLowerCase().includes("application/pdf");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.textDim, letterSpacing: "0.08em" }}>ANSWER SHEET</span>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: c.accent, textDecoration: "none" }}>
          Open full ↗
        </a>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: isPDF ? 0 : 12, background: "#0a0e14" }}>
        {isPDF ? (
          <iframe
            src={url}
            title="Answer sheet"
            style={{
              width: "100%",
              height: isMobile ? "calc(100vh - 120px)" : "100%",
              minHeight: isMobile ? "unset" : 600,
              border: "none",
              display: "block",
            }}
          />
        ) : (
          <img
            src={url}
            alt="Answer sheet"
            style={{ width: "100%", borderRadius: 6, display: "block" }}
          />
        )}
      </div>
    </div>
  );
}

function AssignModal({ resultId, onAssign, onClose }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    api.getSchoolStudents()
      .then(({ students }) => setStudents(students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q)
      || (s.roll_no || "").toLowerCase().includes(q)
      || (s.class || "").toLowerCase().includes(q);
  });

  const assign = async (studentId) => {
    setAssigning(true);
    try {
      const { student } = await api.assignResult(resultId, studentId);
      onAssign(student);
    } catch (e) { alert(e.message); setAssigning(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: c.card, borderRadius: 12, width: "100%", maxWidth: 460, border: `1px solid ${c.border}`, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Assign to Student</div>
          <button style={{ background: "none", border: "none", color: c.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "10px 12px", flexShrink: 0 }}>
          <input style={{ ...input, fontSize: 13 }} placeholder="Search by name, roll no, class…"
            value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ overflowY: "auto", padding: "0 12px 12px", flex: 1 }}>
          {loading && <div style={{ color: c.textDim, fontSize: 13, textAlign: "center", padding: 24 }}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={{ color: c.textDim, fontSize: 13, textAlign: "center", padding: 24 }}>No students found</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((s) => (
              <button key={s.id} disabled={assigning} onClick={() => assign(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", opacity: assigning ? 0.6 : 1 }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1c2330"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: c.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
                  {(s.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: c.textMid }}>
                    {s.roll_no && `Roll: ${s.roll_no}`}{s.class && ` · Class: ${s.class}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtIST = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultDetail({ params, navigate, isMobile }) {
  const { resultId } = params;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [activeTab, setActiveTab] = useState("analysis"); // mobile only: "sheet" | "analysis"

  useEffect(() => {
    api.getResult(resultId)
      .then(({ result }) => {
        setResult(result);
        setComments(result.teacher_comments || {});
        // If there's a sheet, default mobile tab to sheet for context
        if (result.original_sheet_url) setActiveTab("sheet");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  const handleCommentChange = useCallback((qNo, val) => {
    setComments((prev) => ({ ...prev, [qNo]: val }));
  }, []);

  const saveComments = useCallback(async () => {
    setSaving(true);
    try { await api.saveComments(resultId, comments); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  }, [resultId, comments]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl(result.share_token));
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  if (loading) return <div style={{ padding: 28, color: c.textDim }}>Loading…</div>;
  if (error || !result) return <div style={{ padding: 28, color: c.danger }}>Error: {error || "Not found"}</div>;

  const { analysis, analyzer_tests: test, analyzer_students: student, share_token, original_sheet_url } = result;
  const pct = result.total_marks > 0 ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;
  const hasSheet = !!original_sheet_url;
  const p = isMobile ? 14 : 20;

  // ── Analysis content (shared between layouts) ────────────────────────────────
  const analysisContent = (
    <div>
      <button style={{ ...btn.ghost, marginBottom: 14, paddingLeft: 0, color: c.textMid, fontSize: 13 }} onClick={() => navigate("students")}>
        ← Back
      </button>

      {/* Header card */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <ScoreRing pct={pct} small={isMobile || hasSheet} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: hasSheet ? 15 : 18, fontWeight: 700, color: c.text }}>{student?.name || "Unknown Student"}</div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
              {student?.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
              {student?.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
            </div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ color: c.text }}>{test?.name}</strong>
              {test?.subject && <span style={{ color: c.textDim }}> · {test.subject}</span>}
            </div>
            <div style={{ fontSize: hasSheet ? 18 : 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {result.marks_obtained} <span style={{ fontSize: 13, fontWeight: 400, color: c.textMid }}>/ {result.total_marks} marks</span>
            </div>
            {result.analyzed_at && (
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>
                Analyzed {fmtIST(result.analyzed_at)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <a href={whatsappUrl(share_token, student?.name, test?.name)} target="_blank" rel="noopener noreferrer"
            style={{ ...btn.secondary, textDecoration: "none", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: c.success, border: `1px solid ${c.success}40` }}>
            📲 WhatsApp
          </a>
          <button style={{ ...btn.ghost, fontSize: 12 }} onClick={copyLink}>
            {copyDone ? "✓ Copied!" : "🔗 Copy link"}
          </button>
          <button style={{ ...btn.ghost, fontSize: 12 }} onClick={() => setShowAssign(true)}>
            👤 Assign
          </button>
        </div>
      </div>

      {/* Overall feedback + strengths + improvement areas — combined */}
      {(analysis?.overall_feedback || analysis?.strengths?.length > 0 || analysis?.improvement_areas?.length > 0) && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 8, letterSpacing: 0.5 }}>OVERALL FEEDBACK</div>
          {analysis?.overall_feedback && (
            <p style={{ fontSize: 13, color: c.textMid, lineHeight: 1.7, margin: "0 0 8px" }}>{analysis.overall_feedback}</p>
          )}
          {analysis?.strengths?.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "2px 0", display: "flex", gap: 8 }}>
              <span style={{ color: c.success, flexShrink: 0 }}>✓</span>{s}
            </div>
          ))}
          {analysis?.improvement_areas?.length > 0 && (
            <div style={{ marginTop: analysis?.strengths?.length > 0 ? 4 : 0 }}>
              {analysis.improvement_areas.map((area, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "2px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.warning, flexShrink: 0 }}>→</span>{area}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question breakdown */}
      {analysis?.questions?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, letterSpacing: 0.5 }}>
              QUESTION-WISE BREAKDOWN — click to expand
            </div>
            <button style={{ ...btn.ghost, fontSize: 12, color: c.purple, border: `1px solid ${c.purple}40`, borderRadius: 6, padding: "5px 12px", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap" }}
              onClick={saveComments} disabled={saving}>
              {saving ? "Saving…" : "Save comments"}
            </button>
          </div>
          {analysis.questions.map((q) => (
            <QuestionCard
              key={q.no}
              q={q}
              comment={comments[String(q.no)]}
              onCommentChange={handleCommentChange}
              onCommentSave={saveComments}
              saving={saving}
              isMobile={isMobile || hasSheet}
            />
          ))}
        </div>
      )}

      {/* Parse error */}
      {analysis?.parse_error && (
        <div style={{ ...card, marginBottom: 12, border: `1px solid ${c.warning}40`, background: `${c.warning}08` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.warning, marginBottom: 8, letterSpacing: 0.5 }}>⚠ ANALYSIS PARSE ERROR</div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 10, lineHeight: 1.6 }}>
            Claude returned a response that couldn't be parsed as JSON. Common causes: unreadable PDF, password-protected file, or the sheet was too blurry.
          </div>
          {analysis.raw && (
            <details>
              <summary style={{ fontSize: 12, color: c.textDim, cursor: "pointer" }}>Show Claude's raw output</summary>
              <pre style={{ fontSize: 11, color: c.textMid, background: c.bg, padding: "10px 12px", borderRadius: 8, marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 300, overflowY: "auto", border: `1px solid ${c.border}` }}>
                {analysis.raw}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );

  // ── Mobile layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div>
        {hasSheet && (
          <div style={{ display: "flex", borderBottom: `1px solid ${c.border}`, position: "sticky", top: 0, background: c.bg, zIndex: 10 }}>
            {["sheet", "analysis"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "11px 0", background: "transparent", border: "none", borderBottom: `2px solid ${activeTab === tab ? c.accent : "transparent"}`, color: activeTab === tab ? c.accent : c.textDim, fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                {tab === "sheet" ? "Answer Sheet" : "Analysis"}
              </button>
            ))}
          </div>
        )}

        {activeTab === "sheet" && hasSheet && (
          <div style={{ height: "calc(100vh - 100px)" }}>
            <SheetViewer url={original_sheet_url} isMobile={true} />
          </div>
        )}

        {(!hasSheet || activeTab === "analysis") && (
          <div style={{ padding: p }}>
            {analysisContent}
          </div>
        )}

        {showAssign && (
          <AssignModal resultId={resultId}
            onAssign={(s) => { setResult((r) => ({ ...r, analyzer_students: s })); setShowAssign(false); }}
            onClose={() => setShowAssign(false)} />
        )}
      </div>
    );
  }

  // ── Desktop with sheet: split-pane ───────────────────────────────────────────
  if (hasSheet) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", height: "100%" }}>
        {/* Left — sheet viewer, sticky */}
        <div style={{ width: "44%", flexShrink: 0, position: "sticky", top: 0, height: "100vh", borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", background: c.bg }}>
          <SheetViewer url={original_sheet_url} />
        </div>

        {/* Right — analysis, scrolls independently */}
        <div style={{ flex: 1, overflowY: "auto", height: "100vh", padding: p }}>
          {analysisContent}
        </div>

        {showAssign && (
          <AssignModal resultId={resultId}
            onAssign={(s) => { setResult((r) => ({ ...r, analyzer_students: s })); setShowAssign(false); }}
            onClose={() => setShowAssign(false)} />
        )}
      </div>
    );
  }

  // ── Desktop without sheet: single column ─────────────────────────────────────
  return (
    <div style={{ padding: p, maxWidth: 820, margin: "0 auto" }}>
      {analysisContent}
      {showAssign && (
        <AssignModal resultId={resultId}
          onAssign={(s) => { setResult((r) => ({ ...r, analyzer_students: s })); setShowAssign(false); }}
          onClose={() => setShowAssign(false)} />
      )}
    </div>
  );
}
