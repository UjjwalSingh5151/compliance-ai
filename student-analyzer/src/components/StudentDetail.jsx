import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { whatsappUrl } from "../lib/share";
import { c, card, btn } from "../lib/theme";

export default function StudentDetail({ params, navigate, isMobile }) {
  const { studentId } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getStudent(studentId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={{ padding: p, color: c.textDim }}>Loading…</div>;
  if (error || !data?.student) return <div style={{ padding: p, color: c.danger }}>Error: {error || "Not found"}</div>;

  const { student, results } = data;
  const avg = results.length
    ? Math.round(results.reduce((a, r) => a + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0) / results.length)
    : null;

  return (
    <div style={{ padding: p, maxWidth: 800, margin: "0 auto" }}>
      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("students")}>
        ← Back
      </button>

      <div style={{ ...card, display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 50, height: 50, borderRadius: 25, background: c.accentDim, border: `2px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
          {(student.name || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: c.text }}>{student.name || "Unknown"}</div>
          <div style={{ fontSize: 12, color: c.textMid, marginTop: 3 }}>
            {student.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
            {student.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
          </div>
        </div>
        {avg !== null && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: avg >= 75 ? c.success : avg >= 50 ? c.warning : c.danger }}>{avg}%</div>
            <div style={{ fontSize: 10, color: c.textDim }}>avg</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 10 }}>TEST HISTORY ({results.length})</div>

      {results.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 28, color: c.textDim, fontSize: 13 }}>No results yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r) => {
            const pct = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
            const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
            return (
              <div key={r.id} style={{ ...card, padding: isMobile ? 12 : 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct}%</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.analyzer_tests?.name || "Test"}
                    </div>
                    <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>
                      {r.marks_obtained}/{r.total_marks} marks · {new Date(r.analyzed_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...btn.secondary, flex: 1, fontSize: 12, padding: "7px" }} onClick={() => navigate("result", { resultId: r.id })}>View</button>
                  <a href={whatsappUrl(r.share_token, student.name, r.analyzer_tests?.name)} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn.ghost, flex: 1, textDecoration: "none", fontSize: 12, padding: "7px", textAlign: "center", color: c.success, border: `1px solid ${c.success}30`, borderRadius: 8 }}>
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
