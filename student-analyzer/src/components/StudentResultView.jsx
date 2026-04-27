import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";
import PracticeTest from "./PracticeTest";

export default function StudentResultView({ params, navigate, isMobile }) {
  const { resultId } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceData, setPracticeData] = useState(null); // { practiceSetId, questions }
  const [showPractice, setShowPractice] = useState(false);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getStudentResult(resultId)
      .then((d) => {
        setData(d);
        if (d.practiceSet) setPracticeData({ practiceSetId: d.practiceSet.id, questions: d.practiceSet.questions });
      })
      .finally(() => setLoading(false));
  }, [resultId]);

  const generateNotes = async () => {
    setNotesLoading(true);
    try {
      const { notes } = await api.generateRevisionNotes(resultId);
      setData((prev) => ({ ...prev, result: { ...prev.result, revision_notes: notes } }));
    } catch (e) { alert(e.message); }
    finally { setNotesLoading(false); }
  };

  const generatePractice = async (refresh = false) => {
    setPracticeLoading(true);
    try {
      const d = await api.generatePracticeQuestions(resultId, refresh);
      setPracticeData(d);
      setShowPractice(true);
    } catch (e) { alert(e.message); }
    finally { setPracticeLoading(false); }
  };

  if (loading) return <div style={{ padding: p, color: c.textDim }}>Loading…</div>;
  if (!data?.result) return <div style={{ padding: p, color: c.danger }}>Result not found.</div>;

  const { result } = data;
  const test = result.analyzer_tests;
  const student = result.analyzer_students;
  const pct = result.total_marks > 0 ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  const analysis = result.analysis || {};

  if (showPractice && practiceData) {
    return (
      <PracticeTest
        questions={practiceData.questions}
        practiceSetId={practiceData.practiceSetId}
        testName={test?.name}
        onBack={() => setShowPractice(false)}
        onRefresh={() => generatePractice(true)}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div style={{ padding: p, maxWidth: 720, margin: "0 auto" }}>
      <button style={{ background: "none", border: "none", color: c.textMid, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0, fontFamily: "inherit" }}
        onClick={() => navigate("student-portal")}>
        ← My Results
      </button>

      {/* Score card */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 20 }}>
          <div style={{ width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, borderRadius: "50%", border: `4px solid ${color}`, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color }}>{pct}%</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: c.text }}>{student?.name}</div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
              {test?.name}{test?.subject ? ` · ${test.subject}` : ""}
            </div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {result.marks_obtained} <span style={{ fontSize: 13, fontWeight: 400, color: c.textMid }}>/ {result.total_marks} marks</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <button style={{ ...btn.primary, flex: 1, fontSize: 13, opacity: practiceLoading ? 0.6 : 1 }}
          onClick={() => practiceData ? setShowPractice(true) : generatePractice(false)}
          disabled={practiceLoading}>
          {practiceLoading ? "Generating…" : practiceData ? "▶ Practice Questions" : "✦ Generate Practice"}
        </button>
        {practiceData && (
          <button style={{ ...btn.ghost, fontSize: 12, opacity: practiceLoading ? 0.6 : 1 }}
            onClick={() => generatePractice(true)} disabled={practiceLoading}>
            ↻ Refresh
          </button>
        )}
      </div>

      {/* Revision Notes */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: result.revision_notes ? 12 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.accent, letterSpacing: 0.5 }}>✦ REVISION NOTES</div>
          {!result.revision_notes && (
            <button style={{ ...btn.ghost, fontSize: 12, color: c.accent, border: `1px solid ${c.accent}30`, opacity: notesLoading ? 0.6 : 1 }}
              onClick={generateNotes} disabled={notesLoading}>
              {notesLoading ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
        {result.revision_notes ? (
          <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {result.revision_notes}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: c.textDim, marginTop: 8 }}>
            Click Generate to create personalized revision notes based on your mistakes.
          </div>
        )}
      </div>

      {/* Overall feedback */}
      {analysis.overall_feedback && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 8, letterSpacing: 0.5 }}>TEACHER'S FEEDBACK</div>
          <p style={{ fontSize: 13, color: c.textMid, lineHeight: 1.7 }}>{analysis.overall_feedback}</p>
        </div>
      )}

      {/* Strengths + Weak areas */}
      {(analysis.strengths?.length > 0 || analysis.improvement_areas?.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {analysis.strengths?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 8, letterSpacing: 0.5 }}>STRENGTHS</div>
              {analysis.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "3px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.success }}>✓</span>{s}
                </div>
              ))}
            </div>
          )}
          {analysis.improvement_areas?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.warning, marginBottom: 8, letterSpacing: 0.5 }}>FOCUS AREAS</div>
              {analysis.improvement_areas.map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: c.textMid, padding: "3px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.warning }}>→</span>{a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Question breakdown */}
      {analysis.questions?.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>QUESTION BREAKDOWN</div>
          {analysis.questions.map((q, i) => {
            const qPct = q.marks_available > 0 ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0;
            const qColor = qPct === 100 ? c.success : qPct >= 50 ? c.warning : c.danger;
            return (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < analysis.questions.length - 1 ? `1px solid ${c.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Q{q.no}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: qColor }}>{q.marks_awarded}/{q.marks_available}</span>
                </div>
                {q.feedback && <div style={{ fontSize: 12, color: c.textMid, lineHeight: 1.5 }}>{q.feedback}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
