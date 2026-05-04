import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card } from "../lib/theme";

// ─── Analytics panel (computed from results) ───────────────────────────────────
function PerformancePanel({ results, isMobile }) {
  const [showAll, setShowAll] = useState(false);
  const p = isMobile ? 14 : 18;

  // Subject breakdown
  const subjectMap = {};
  for (const r of results) {
    const subj = r.analyzer_tests?.subject?.trim() || "General";
    if (!subjectMap[subj]) subjectMap[subj] = { obtained: 0, total: 0, count: 0 };
    subjectMap[subj].obtained += r.marks_obtained || 0;
    subjectMap[subj].total    += r.total_marks    || 0;
    subjectMap[subj].count    += 1;
  }
  const subjects = Object.entries(subjectMap).map(([subj, d]) => ({
    subject: subj,
    avg: d.total > 0 ? Math.round((d.obtained / d.total) * 100) : 0,
    count: d.count,
  })).sort((a, b) => b.avg - a.avg);

  // All questions across all results
  const allQuestions = results.flatMap((r) =>
    (r.analysis?.questions || []).map((q) => ({
      ...q, subject: r.analyzer_tests?.subject?.trim() || "General",
    }))
  );

  // Concept-level breakdown
  const conceptMap = {};
  for (const q of allQuestions) {
    if (!q.concept_tag) continue;
    if (!conceptMap[q.concept_tag]) conceptMap[q.concept_tag] = { correct: 0, wrong: 0, subject: q.subject };
    const isCorrect = q.is_correct || (q.marks_awarded >= q.marks_available);
    if (isCorrect) conceptMap[q.concept_tag].correct++;
    else           conceptMap[q.concept_tag].wrong++;
  }
  const weakConcepts = Object.entries(conceptMap)
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 6);
  const strongConcepts = Object.entries(conceptMap)
    .filter(([, v]) => v.wrong === 0 && v.correct > 0)
    .sort((a, b) => b[1].correct - a[1].correct)
    .slice(0, 4);

  // Cognitive accuracy
  const cogMap = {
    recall: { awarded: 0, available: 0 },
    application: { awarded: 0, available: 0 },
    analysis: { awarded: 0, available: 0 },
  };
  for (const q of allQuestions) {
    const lvl = q.cognitive_level;
    if (!lvl || !cogMap[lvl]) continue;
    cogMap[lvl].awarded   += q.marks_awarded   || 0;
    cogMap[lvl].available += q.marks_available || 0;
  }
  const cogStats = ["recall", "application", "analysis"].map((level) => {
    const d = cogMap[level];
    const acc = d.available > 0 ? Math.round((d.awarded / d.available) * 100) : null;
    return { level, acc, available: d.available };
  }).filter((s) => s.available > 0);

  const cogColor = (level) =>
    level === "recall" ? c.success : level === "application" ? c.warning : c.purple;
  const cogIcon = (level) =>
    level === "recall" ? "💭" : level === "application" ? "⚙️" : "🔬";

  const SHOW_LIMIT = 3;

  if (allQuestions.length === 0 && subjects.every(s => s.avg === 0)) return null;

  return (
    <div style={{ ...card, padding: p, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 16 }}>
        📊 My Performance Breakdown
      </div>

      {/* Subject bars */}
      {subjects.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>SUBJECTS</div>
          {subjects.map(({ subject, avg, count }) => {
            const col = avg >= 75 ? c.success : avg >= 40 ? c.warning : c.danger;
            return (
              <div key={subject} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: c.text, fontWeight: 600, width: 100, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {subject}
                </div>
                <div style={{ flex: 1, height: 8, background: c.bg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${avg}%`, height: 8, background: col, borderRadius: 4, transition: "width 0.6s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: col, width: 36, textAlign: "right" }}>{avg}%</div>
                <div style={{ fontSize: 10, color: c.textDim, width: 22 }}>{count}t</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cognitive level accuracy */}
      {cogStats.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>ACCURACY BY QUESTION TYPE</div>
          <div style={{ display: "flex", gap: 8 }}>
            {cogStats.map(({ level, acc }) => {
              const col = cogColor(level);
              return (
                <div key={level} style={{ flex: 1, background: `${col}10`, border: `1px solid ${col}30`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{cogIcon(level)}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: col, marginTop: 4 }}>{acc}%</div>
                  <div style={{ fontSize: 10, color: c.textDim, textTransform: "capitalize", marginTop: 2 }}>{level}</div>
                  <div style={{ fontSize: 9, color: c.textDim, marginTop: 2 }}>
                    {acc >= 80 ? "Strong ✓" : acc >= 50 ? "Moderate" : "Needs work"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weak concepts */}
      {weakConcepts.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>🔴 TOPICS TO FOCUS ON</div>
          {(showAll ? weakConcepts : weakConcepts.slice(0, SHOW_LIMIT)).map(([tag, v]) => (
            <div key={tag} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: c.bg, borderRadius: 8, padding: "9px 12px", marginBottom: 6, border: `1px solid ${c.danger}20` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{tag}</div>
                <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>{v.subject}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.danger }}>{v.wrong} wrong</div>
                {v.correct > 0 && <div style={{ fontSize: 11, color: c.success, marginTop: 1 }}>{v.correct} correct</div>}
              </div>
            </div>
          ))}
          {weakConcepts.length > SHOW_LIMIT && (
            <button onClick={() => setShowAll(v => !v)} style={{ background: "none", border: "none", color: c.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
              {showAll ? "Show less ▲" : `+${weakConcepts.length - SHOW_LIMIT} more topics ▼`}
            </button>
          )}
        </div>
      )}

      {/* Strong concepts */}
      {strongConcepts.length > 0 && (
        <div>
          <div style={sectionLabel}>✅ STRONG TOPICS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {strongConcepts.map(([tag]) => (
              <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: c.success, background: `${c.success}12`, border: `1px solid ${c.success}30`, borderRadius: 20, padding: "4px 12px" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: "#484f58", letterSpacing: "0.8px",
  textTransform: "uppercase", marginBottom: 10,
};

// ─── Main StudentPortal ────────────────────────────────────────────────────────
export default function StudentPortal({ navigate, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getStudentResults()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: p, color: c.textDim, fontSize: 13 }}>Loading…</div>;

  const student = data?.student;
  const results = data?.results || [];

  // Quick stats
  const totalTests = results.length;
  const avgPct = totalTests > 0
    ? Math.round(results.reduce((s, r) => s + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0) / totalTests)
    : 0;
  const avgColor = avgPct >= 75 ? c.success : avgPct >= 40 ? c.warning : c.danger;

  // Weak concept count
  const conceptWrong = {};
  for (const r of results) {
    for (const q of (r.analysis?.questions || [])) {
      if (!q.concept_tag) continue;
      const isCorrect = q.is_correct || (q.marks_awarded >= q.marks_available);
      if (!isCorrect) conceptWrong[q.concept_tag] = (conceptWrong[q.concept_tag] || 0) + 1;
    }
  }
  const weakCount = Object.keys(conceptWrong).length;

  return (
    <div style={{ padding: p, maxWidth: 700, margin: "0 auto" }}>
      {/* Student header */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 50, height: 50, borderRadius: 25, background: "rgba(79,142,247,0.12)", border: `2px solid rgba(79,142,247,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
          {(student?.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: c.text }}>{student?.name || "Student"}</div>
          <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {student?.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
            {student?.class && <span>Class: {student.class}</span>}
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      {totalTests > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Tests taken", value: String(totalTests), color: c.accent },
            { label: "Average score", value: `${avgPct}%`,     color: avgColor },
            ...(weakCount > 0 ? [{ label: "Weak areas",   value: String(weakCount), color: c.danger }] : []),
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, ...card, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: c.textDim, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Performance analytics panel */}
      {results.length > 0 && <PerformancePanel results={results} isMobile={isMobile} />}

      {/* Results list */}
      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>
        MY RESULTS ({totalTests})
      </div>

      {results.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40, color: c.textDim, fontSize: 13 }}>
          No results yet. Your teacher hasn't uploaded any of your answer sheets.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((r) => {
            const pct = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
            const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
            return (
              <div key={r.id} onClick={() => navigate("student-result", { resultId: r.id })}
                style={{ ...card, padding: isMobile ? 14 : 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1c2330"}
                onMouseLeave={(e) => e.currentTarget.style.background = c.card}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: `${color}15`, border: `2px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color }}>{pct}%</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.analyzer_tests?.name || "Test"}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
                    {r.marks_obtained}/{r.total_marks} marks
                    {r.analyzer_tests?.subject && <span style={{ marginLeft: 8 }}>· {r.analyzer_tests.subject}</span>}
                    <span style={{ marginLeft: 8 }}>· {new Date(r.analyzed_at).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {r.revision_notes && (
                      <span style={{ fontSize: 10, color: c.accent, background: c.accentDim, padding: "2px 7px", borderRadius: 4 }}>Notes ready</span>
                    )}
                    <span style={{ fontSize: 10, color: c.textDim, background: c.border, padding: "2px 7px", borderRadius: 4 }}>Practice →</span>
                  </div>
                </div>
                <span style={{ color: c.textDim, fontSize: 16 }}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
