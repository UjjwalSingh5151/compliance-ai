import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

export default function Dashboard({ navigate, isMobile }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getTests()
      .then(({ tests }) => setTests(tests || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalSheets = tests.reduce((a, t) => a + (t.analyzer_results?.[0]?.count || 0), 0);

  return (
    <div style={{ padding: p, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Tests</h1>
          <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {tests.length} test{tests.length !== 1 ? "s" : ""} · {totalSheets} sheet{totalSheets !== 1 ? "s" : ""} analyzed
          </p>
        </div>
        <button style={{ ...btn.primary, padding: isMobile ? "8px 14px" : "9px 20px", fontSize: 13 }} onClick={() => navigate("new-test")}>
          + New Test
        </button>
      </div>

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ color: c.danger, fontSize: 13 }}>Error: {error}</div>}

      {!loading && tests.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: isMobile ? 32 : 48 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 6 }}>No tests yet</div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 20 }}>
            Create a test, upload a question paper, then analyze answer sheets.
          </div>
          <button style={btn.primary} onClick={() => navigate("new-test")}>Create first test</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tests.map((test) => {
          const count = test.analyzer_results?.[0]?.count || 0;
          return (
            <div key={test.id} style={{ ...card, padding: isMobile ? 14 : 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 10 : 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📝</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{test.name}</div>
                  <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
                    {test.subject && <span style={{ marginRight: 8 }}>{test.subject}</span>}
                    <span>{count} sheet{count !== 1 ? "s" : ""}</span>
                    {test.total_marks && <span style={{ marginLeft: 8 }}>· {test.total_marks} marks</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: isMobile ? 0 : 0, flexWrap: "wrap" }}>
                <button style={{ ...btn.primary, flex: isMobile ? 1 : "none", fontSize: 12, padding: "7px 14px" }}
                  onClick={() => navigate("upload", { testId: test.id, testName: test.name })}>
                  + Upload Sheets
                </button>
                <button style={{ ...btn.secondary, flex: isMobile ? 1 : "none", fontSize: 12, padding: "7px 14px" }}
                  onClick={() => navigate("test-results", { testId: test.id })}>
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
