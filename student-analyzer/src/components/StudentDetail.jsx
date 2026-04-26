import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { whatsappUrl } from "../lib/share";
import { c, card, btn } from "../lib/theme";

export default function StudentDetail({ params, navigate }) {
  const { studentId } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getStudent(studentId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={{ padding: 40, color: c.textDim }}>Loading…</div>;
  if (error || !data?.student) return <div style={{ padding: 40, color: c.danger }}>Error: {error || "Not found"}</div>;

  const { student, results } = data;
  const avg = results.length
    ? Math.round(results.reduce((a, r) => a + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0) / results.length)
    : null;

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: "0 auto" }}>
      <button style={{ ...btn.ghost, marginBottom: 20, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("students")}>
        ← Back to Students
      </button>

      {/* Student header */}
      <div style={{ ...card, display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: c.accentDim, border: `2px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: c.accent }}>
          {(student.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{student.name || "Unknown"}</div>
          <div style={{ fontSize: 13, color: c.textMid, marginTop: 3 }}>
            {student.roll_no && <span style={{ marginRight: 12 }}>Roll: {student.roll_no}</span>}
            {student.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
          </div>
        </div>
        {avg !== null && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: avg >= 75 ? c.success : avg >= 50 ? c.warning : c.danger }}>{avg}%</div>
            <div style={{ fontSize: 11, color: c.textDim }}>avg score</div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, color: c.textMid, marginBottom: 12 }}>
        TEST HISTORY ({results.length})
      </h2>

      {results.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 32, color: c.textDim, fontSize: 13 }}>No results yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r) => {
            const pct = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
            const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
            return (
              <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color }}>{pct}%</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{r.analyzer_tests?.name || "Test"}</div>
                  <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
                    {r.marks_obtained}/{r.total_marks} marks
                    {r.analyzer_tests?.subject && <span style={{ marginLeft: 8 }}>· {r.analyzer_tests.subject}</span>}
                    <span style={{ marginLeft: 8 }}>· {new Date(r.analyzed_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btn.secondary} onClick={() => navigate("result", { resultId: r.id })}>View</button>
                  <a href={whatsappUrl(r.share_token, student.name, r.analyzer_tests?.name)} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn.ghost, textDecoration: "none", fontSize: 12, color: c.success }}>
                    Share
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
