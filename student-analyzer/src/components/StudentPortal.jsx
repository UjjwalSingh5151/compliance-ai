import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card } from "../lib/theme";

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

  return (
    <div style={{ padding: p, maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 50, height: 50, borderRadius: 25, background: c.accentDim, border: `2px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
          {(student?.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: c.text }}>{student?.name || "Student"}</div>
          <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {student?.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
            {student?.class && <span>Class: {student.class}</span>}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>
        MY RESULTS ({results.length})
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
