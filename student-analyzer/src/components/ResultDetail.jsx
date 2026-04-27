import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { shareUrl, whatsappUrl } from "../lib/share";
import { c, card, btn } from "../lib/theme";

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
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "10px 12px" : "12px 16px", cursor: "pointer", background: c.card }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${markColor}15`, border: `1px solid ${markColor}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: markColor }}>Q{q.no}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {q.student_answer && (
            <div style={{ fontSize: 12, color: c.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {q.student_answer}
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

          {q.expected_answer && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.textDim, marginBottom: 4, letterSpacing: 0.5 }}>EXPECTED ANSWER</div>
              <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.65, background: c.card, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}` }}>
                {q.expected_answer}
              </div>
            </div>
          )}

          {q.reasoning && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.accent, marginBottom: 4, letterSpacing: 0.5 }}>CLAUDE'S REASONING</div>
              <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.65, background: c.accentDim, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.accent}30` }}>
                {q.reasoning}
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
                onClick={() => onCommentSave()} disabled={saving}>
                {saving ? "Saving…" : "Save comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtIST = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

export default function ResultDetail({ params, navigate, isMobile }) {
  const { resultId } = params;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getResult(resultId)
      .then(({ result }) => {
        setResult(result);
        setComments(result.teacher_comments || {});
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

  if (loading) return <div style={{ padding: p, color: c.textDim }}>Loading…</div>;
  if (error || !result) return <div style={{ padding: p, color: c.danger }}>Error: {error || "Not found"}</div>;

  const { analysis, analyzer_tests: test, analyzer_students: student, share_token, original_sheet_url } = result;
  const pct = result.total_marks > 0 ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;

  return (
    <div style={{ padding: p, maxWidth: 820, margin: "0 auto" }}>
      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("students")}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: isMobile ? 12 : 20, alignItems: "center" }}>
          <ScoreRing pct={pct} small={isMobile} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: c.text }}>{student?.name || "Unknown Student"}</div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 3 }}>
              {student?.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
              {student?.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
            </div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ color: c.text }}>{test?.name}</strong>
              {test?.subject && <span style={{ color: c.textDim }}> · {test.subject}</span>}
            </div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {result.marks_obtained} <span style={{ fontSize: 13, fontWeight: 400, color: c.textMid }}>/ {result.total_marks} marks</span>
            </div>
            {result.analyzed_at && (
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 4 }}>
                Analyzed {fmtIST(result.analyzed_at)}
              </div>
            )}
          </div>
        </div>

        {/* Share buttons — below on mobile */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <a href={whatsappUrl(share_token, student?.name, test?.name)} target="_blank" rel="noopener noreferrer"
            style={{ ...btn.secondary, textDecoration: "none", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: c.success, border: `1px solid ${c.success}40`, flex: isMobile ? 1 : "none", justifyContent: "center" }}>
            📲 WhatsApp
          </a>
          <button style={{ ...btn.ghost, fontSize: 12, flex: isMobile ? 1 : "none" }} onClick={copyLink}>
            {copyDone ? "✓ Copied!" : "🔗 Copy link"}
          </button>
        </div>
      </div>

      {/* Strengths + Improvement areas */}
      {(analysis?.strengths?.length > 0 || analysis?.improvement_areas?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {analysis?.strengths?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 10, letterSpacing: 0.5 }}>STRENGTHS</div>
              {analysis.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "4px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.success, flexShrink: 0 }}>✓</span>{s}
                </div>
              ))}
            </div>
          )}
          {analysis?.improvement_areas?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.warning, marginBottom: 10, letterSpacing: 0.5 }}>IMPROVEMENT AREAS</div>
              {analysis.improvement_areas.map((area, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "4px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.warning, flexShrink: 0 }}>→</span>{area}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overall feedback */}
      {analysis?.overall_feedback && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 8, letterSpacing: 0.5 }}>OVERALL FEEDBACK</div>
          <p style={{ fontSize: 13, color: c.textMid, lineHeight: 1.7 }}>{analysis.overall_feedback}</p>
        </div>
      )}

      {/* Question breakdown */}
      {analysis?.questions?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
            <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: c.textMid, letterSpacing: 0.5 }}>
              {isMobile ? "QUESTIONS" : "QUESTION-WISE BREAKDOWN — click to expand"}
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
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Parse error — show raw Claude output for debugging */}
      {analysis?.parse_error && (
        <div style={{ ...card, marginBottom: 14, border: `1px solid ${c.warning}40`, background: `${c.warning}08` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.warning, marginBottom: 8, letterSpacing: 0.5 }}>⚠ ANALYSIS PARSE ERROR</div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 10, lineHeight: 1.6 }}>
            Claude returned a response that couldn't be parsed as JSON. Common causes: unreadable PDF, password-protected file, or the sheet was too blurry. Try re-uploading a clearer image.
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

      {/* Original answer sheet */}
      {original_sheet_url && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>ORIGINAL ANSWER SHEET</div>
          {original_sheet_url.toLowerCase().endsWith(".pdf") ? (
            <a href={original_sheet_url} target="_blank" rel="noopener noreferrer" style={{ color: c.accent, fontSize: 13 }}>
              Open PDF ↗
            </a>
          ) : (
            <img src={original_sheet_url} alt="Answer sheet" style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${c.border}` }} />
          )}
        </div>
      )}
    </div>
  );
}
