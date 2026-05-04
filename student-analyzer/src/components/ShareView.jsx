import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card } from "../lib/theme";

function ScoreBadge({ pct }) {
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  const label = pct >= 75 ? "Excellent" : pct >= 50 ? "Good" : "Needs Improvement";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 100, height: 100, borderRadius: "50%", border: `5px solid ${color}`, background: `${color}15` }}>
      <span style={{ fontSize: 26, fontWeight: 800, color }}>{pct}%</span>
      <span style={{ fontSize: 9, color, fontWeight: 600, marginTop: 2 }}>{label}</span>
    </div>
  );
}

export default function ShareView({ token }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getShare(token)
      .then(({ result }) => setResult(result))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg }}>
        <div style={{ color: c.textDim, fontSize: 14 }}>Loading result…</div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 32 }}>😕</div>
        <div style={{ color: c.danger, fontSize: 14 }}>Result not found or link is invalid.</div>
      </div>
    );
  }

  const { analysis, analyzer_tests: test, analyzer_students: student, marks_obtained, total_marks, original_sheet_url } = result;
  const pct = total_marks > 0 ? Math.round((marks_obtained / total_marks) * 100) : 0;

  return (
    <div style={{ background: c.bg, minHeight: "100vh", padding: "28px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: c.textDim }}>Powered by</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
        </div>

        {/* Score card */}
        <div style={{ ...card, display: "flex", gap: 20, alignItems: "center", marginBottom: 16 }}>
          <ScoreBadge pct={pct} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>{student?.name || "Student"}</div>
            <div style={{ fontSize: 13, color: c.textMid, marginTop: 4 }}>
              {student?.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
              {student?.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
            </div>
            <div style={{ fontSize: 14, color: c.textMid, marginTop: 6 }}>
              <strong style={{ color: c.text }}>{test?.name}</strong>
              {test?.subject && <span style={{ color: c.textDim }}> · {test.subject}</span>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 6 }}>
              {marks_obtained} <span style={{ fontSize: 14, fontWeight: 400, color: c.textMid }}>/ {total_marks} marks</span>
            </div>
          </div>
        </div>

        {/* Overall feedback */}
        {analysis?.overall_feedback && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 8, letterSpacing: 0.5 }}>TEACHER'S FEEDBACK</div>
            <p style={{ fontSize: 14, color: c.textMid, lineHeight: 1.7 }}>{analysis.overall_feedback}</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {analysis?.strengths?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 10, letterSpacing: 0.5 }}>STRENGTHS</div>
              {analysis.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "3px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.success }}>✓</span>{s}
                </div>
              ))}
            </div>
          )}
          {analysis?.improvement_areas?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.warning, marginBottom: 10, letterSpacing: 0.5 }}>FOCUS AREAS</div>
              {analysis.improvement_areas.map((area, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "3px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.warning }}>→</span>{area}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question breakdown */}
        {analysis?.questions?.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>QUESTION BREAKDOWN</div>
            {analysis.questions.map((q, i) => {
              const qPct = q.marks_available > 0 ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0;
              const qColor = q.is_correct ? c.success : qPct >= 50 ? c.warning : c.danger;
              return (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < analysis.questions.length - 1 ? `1px solid ${c.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Q{q.no}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: qColor }}>{q.marks_awarded}/{q.marks_available}</span>
                  </div>
                  {q.feedback && <div style={{ fontSize: 12, color: c.textMid, lineHeight: 1.5 }}>{q.feedback}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Original answer sheet */}
        {original_sheet_url && (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>YOUR ANSWER SHEET</div>
            {original_sheet_url.toLowerCase().endsWith(".pdf") ? (
              <a href={original_sheet_url} target="_blank" rel="noopener noreferrer" style={{ color: c.accent, fontSize: 13 }}>
                Open PDF ↗
              </a>
            ) : (
              <img src={original_sheet_url} alt="Answer sheet" style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${c.border}` }} />
            )}
          </div>
        )}

        {/* Student CTA */}
        <div style={{ ...card, marginTop: 20, textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 6 }}>
            Are you {student?.name?.split(" ")[0] || "this student"}?
          </div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 16, lineHeight: 1.6 }}>
            Log in with your school email to see all your results, get personalized revision notes, and practice questions.
          </div>
          <a href="/"
            style={{ display: "inline-block", padding: "10px 28px", background: c.accent, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            View All My Results →
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, color: c.textDim, fontSize: 11 }}>
          Generated by EduGrade AI
        </div>
      </div>
    </div>
  );
}
