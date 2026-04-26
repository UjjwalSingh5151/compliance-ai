import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

function pct(got, total) {
  if (!total) return 0;
  return Math.round((got / total) * 100);
}

function PctBadge({ value }) {
  const color = value >= 75 ? c.success : value >= 50 ? c.warning : c.danger;
  const bg = value >= 75 ? c.successDim : value >= 50 ? c.warningDim : c.dangerDim;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: "2px 8px", borderRadius: 10 }}>
      {value}%
    </span>
  );
}

export default function Dashboard({ navigate }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getTests()
      .then(({ tests }) => setTests(tests || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalSheets = tests.reduce((a, t) => a + (t.analyzer_results?.[0]?.count || 0), 0);

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Tests</h1>
          <p style={{ fontSize: 13, color: c.textMid, marginTop: 2 }}>
            {tests.length} test{tests.length !== 1 ? "s" : ""} · {totalSheets} answer sheet{totalSheets !== 1 ? "s" : ""} analyzed
          </p>
        </div>
        <button style={btn.primary} onClick={() => navigate("new-test")}>+ New Test</button>
      </div>

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ color: c.danger, fontSize: 13 }}>Error: {error}</div>}

      {!loading && tests.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 6 }}>No tests yet</div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 20 }}>
            Create a test, upload a question paper, then analyze answer sheets.
          </div>
          <button style={btn.primary} onClick={() => navigate("new-test")}>Create first test</button>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {tests.map((test) => {
          const count = test.analyzer_results?.[0]?.count || 0;
          return (
            <div key={test.id} style={{ ...card, display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = c.cardHover}
              onMouseLeave={(e) => e.currentTarget.style.background = c.card}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: c.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                📝
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{test.name}</div>
                <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
                  {test.subject && <span style={{ marginRight: 10 }}>{test.subject}</span>}
                  <span>{count} answer sheet{count !== 1 ? "s" : ""} analyzed</span>
                  {test.total_marks && <span style={{ marginLeft: 10 }}>· {test.total_marks} marks</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button style={btn.secondary} onClick={() => navigate("upload", { testId: test.id, testName: test.name })}>
                  + Upload Sheets
                </button>
                <button style={btn.ghost} onClick={() => navigate("students", { testId: test.id })}>
                  View Results
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
