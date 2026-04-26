import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

function Avatar({ name }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: 40, height: 40, borderRadius: 20, background: c.accentDim, border: `1px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function StudentList({ navigate }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getStudents()
      .then(({ students }) => setStudents(students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q) || (s.roll_no || "").toLowerCase().includes(q) || (s.class || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Students</h1>
          <p style={{ fontSize: 13, color: c.textMid, marginTop: 2 }}>{students.length} student{students.length !== 1 ? "s" : ""} across all tests</p>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, roll number or class…"
        style={{ width: "100%", padding: "9px 14px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, outline: "none", marginBottom: 16, fontFamily: "inherit" }}
      />

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            {search ? "No students match your search" : "No students yet"}
          </div>
          <div style={{ fontSize: 13, color: c.textMid }}>
            Students are automatically created when you analyze their answer sheets.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((student) => {
          const count = student.analyzer_results?.[0]?.count || 0;
          return (
            <div
              key={student.id}
              onClick={() => navigate("student-detail", { studentId: student.id })}
              style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = c.cardHover}
              onMouseLeave={(e) => e.currentTarget.style.background = c.card}
            >
              <Avatar name={student.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{student.name || "Unknown"}</div>
                <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
                  {student.roll_no && <span style={{ marginRight: 10 }}>Roll: {student.roll_no}</span>}
                  {student.class && <span style={{ marginRight: 10 }}>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
                  <span>{count} test{count !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <span style={{ color: c.textDim, fontSize: 16 }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
