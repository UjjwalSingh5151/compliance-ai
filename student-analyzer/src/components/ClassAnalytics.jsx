/**
 * ClassAnalytics — per-test class-level analytics.
 * Shows: class average, Q-by-Q heatmap, top error concepts, at-risk students.
 * Accessible from TestResults page → "📊 Class Report" button.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function HeatBar({ value, max = 100 }) {
  const color = value >= 70 ? c.success : value >= 40 ? c.warning : c.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: c.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ ...card, padding: "14px 18px", textAlign: "center", minWidth: 110 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || c.accent }}>{value}</div>
      <div style={{ fontSize: 11, color: c.textMid, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function ClassAnalytics({ testId, testName, onBack, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const p = isMobile ? 14 : 22;

  useEffect(() => {
    api.getClassAnalytics(testId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) return <div style={{ padding: p, color: c.textDim, fontSize: 13 }}>Generating class report…</div>;
  if (error || !data) return (
    <div style={{ padding: p }}>
      <button style={{ ...btn.ghost, marginBottom: 14, fontSize: 13, color: c.textMid }} onClick={onBack}>← Back</button>
      <div style={{ color: c.danger, fontSize: 13 }}>Error: {error || "Not found"}</div>
    </div>
  );

  const { test, totalPapers, classAvg, scoreDistribution, questionHeatmap, topErrorAreas, atRisk, atRiskThreshold, students } = data;

  const avgColor = classAvg >= 70 ? c.success : classAvg >= 40 ? c.warning : c.danger;
  const displayStudents = showAllStudents ? students : students.slice(0, 10);

  return (
    <div style={{ padding: p, maxWidth: 860, margin: "0 auto" }}>
      {/* Back + title */}
      <button style={{ ...btn.ghost, marginBottom: 14, fontSize: 13, color: c.textMid, paddingLeft: 0 }} onClick={onBack}>
        ← Back to Results
      </button>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 16 : 19, fontWeight: 700, color: c.text, margin: 0 }}>
          📊 Class Report — {testName || test?.name}
        </h2>
        {test?.subject && <div style={{ fontSize: 12, color: c.textMid, marginTop: 3 }}>{test.subject}{test.class ? ` · Class ${test.class}` : ""}{test.section ? ` · ${test.section}` : ""}</div>}
      </div>

      {/* Stat boxes */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Papers graded" value={totalPapers} />
        <StatBox label="Class average" value={classAvg !== null ? `${classAvg}%` : "—"} color={classAvg !== null ? avgColor : c.textDim} />
        <StatBox
          label="At-risk students"
          value={atRisk.length}
          color={atRisk.length > 0 ? c.danger : c.success}
          sub={`below ${atRiskThreshold}%`}
        />
        <StatBox label="Questions" value={questionHeatmap.length} />
      </div>

      {/* Score distribution */}
      {scoreDistribution && (
        <div style={{ ...card, padding: isMobile ? 14 : 18, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textDim, letterSpacing: 0.8, marginBottom: 12 }}>SCORE DISTRIBUTION</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {scoreDistribution.map((band) => (
              <div key={band.label} style={{ flex: "1 1 80px", textAlign: "center", background: c.bg, borderRadius: 8, padding: "10px 8px", border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.text }}>{band.count}</div>
                <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>{band.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question heatmap */}
      {questionHeatmap.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 14 : 18, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textDim, letterSpacing: 0.8, marginBottom: 14 }}>
            QUESTION-BY-QUESTION SUCCESS RATE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questionHeatmap.map((q) => (
              <div key={q.no}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.textMid, minWidth: 28 }}>Q{q.no}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {q.question && (
                      <div style={{ fontSize: 11, color: c.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {q.question}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      {q.concept_tag && (
                        <span style={{ fontSize: 10, background: `${c.accent}15`, color: c.accent, padding: "1px 6px", borderRadius: 3 }}>
                          {q.concept_tag}
                        </span>
                      )}
                      {q.cognitive_level && (
                        <span style={{ fontSize: 10, background: `${c.purple}15`, color: c.purple, padding: "1px 6px", borderRadius: 3 }}>
                          {q.cognitive_level}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: c.textDim, minWidth: 60, textAlign: "right" }}>
                    {q.attempts} attempts
                  </span>
                </div>
                <div style={{ paddingLeft: isMobile ? 0 : 38 }}>
                  <HeatBar value={q.successRate} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top error areas */}
      {topErrorAreas.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 14 : 18, marginBottom: 16, border: `1px solid ${c.danger}30`, background: `${c.danger}06` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.danger, letterSpacing: 0.8, marginBottom: 12 }}>
            TOP ERROR AREAS (class-wide concept gaps)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topErrorAreas.map((ea, i) => (
              <div key={ea.tag} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.textDim, minWidth: 18 }}>{i + 1}.</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.text, flex: 1 }}>{ea.tag}</span>
                {ea.cogLevel && (
                  <span style={{ fontSize: 10, color: c.textDim, background: c.border, padding: "2px 6px", borderRadius: 4 }}>
                    {ea.cogLevel}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: c.danger, background: `${c.danger}12`, padding: "2px 8px", borderRadius: 6 }}>
                  {ea.count} student{ea.count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-risk students */}
      {atRisk.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 14 : 18, marginBottom: 16, border: `1px solid ${c.warning}30`, background: `${c.warning}06` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.warning, letterSpacing: 0.8, marginBottom: 12 }}>
            ⚠ AT-RISK STUDENTS (below {atRiskThreshold}%)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {atRisk.map((s) => (
              <div key={s.resultId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: `${c.danger}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: c.danger, flexShrink: 0 }}>
                  {(s.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</div>
                  {s.roll && <div style={{ fontSize: 11, color: c.textDim }}>Roll: {s.roll}</div>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: c.danger }}>{s.score}%</span>
                <span style={{ fontSize: 12, color: c.textDim }}>{s.marks}/{s.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All students table */}
      {students.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 14 : 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.textDim, letterSpacing: 0.8 }}>
              ALL STUDENTS ({students.length})
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayStudents.map((s, i) => (
              <div key={s.resultId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < displayStudents.length - 1 ? `1px solid ${c.border}` : "none" }}>
                <span style={{ fontSize: 11, color: c.textDim, minWidth: 22 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</div>
                  {s.roll && <div style={{ fontSize: 11, color: c.textDim }}>Roll: {s.roll}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: s.score >= 70 ? c.success : s.score >= 40 ? c.warning : c.danger }}>
                    {s.score}%
                  </div>
                  <div style={{ fontSize: 11, color: c.textDim }}>{s.marks}/{s.total}</div>
                </div>
              </div>
            ))}
          </div>
          {students.length > 10 && (
            <button style={{ ...btn.ghost, width: "100%", marginTop: 10, fontSize: 12, color: c.textMid }}
              onClick={() => setShowAllStudents((v) => !v)}>
              {showAllStudents ? "Show less" : `Show all ${students.length} students`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
