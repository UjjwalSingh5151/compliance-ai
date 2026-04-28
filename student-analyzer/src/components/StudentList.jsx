import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

export default function StudentList({ navigate, isMobile }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getStudents()
      .then(({ students }) => setStudents(students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q) || (s.roll_no || "").toLowerCase().includes(q) || (s.class || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({ name: s.name || "", roll_no: s.roll_no || "", class: s.class || "", section: s.section || "", academic_year: s.academic_year || "", email: s.email || "" });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const { student } = await api.updateStudent(id, editForm);
      setStudents((prev) => prev.map((s) => s.id === id ? { ...s, ...student } : s));
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group: academic_year → class → section → students
  const grouped = {};
  filtered.forEach((s) => {
    const yr = s.academic_year || "—";
    const cls = s.class || "—";
    const sec = s.section || "—";
    if (!grouped[yr]) grouped[yr] = {};
    if (!grouped[yr][cls]) grouped[yr][cls] = {};
    if (!grouped[yr][cls][sec]) grouped[yr][cls][sec] = [];
    grouped[yr][cls][sec].push(s);
  });
  const sortKey = (k) => (k === "—" ? "￿" : k);
  const years = Object.keys(grouped).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  return (
    <div style={{ padding: p, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Students</h1>
        <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>{students.length} student{students.length !== 1 ? "s" : ""} across all tests</p>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, roll number, class or email…"
        style={{ width: "100%", padding: "10px 14px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }} />

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 36 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            {search ? "No students match" : "No students yet"}
          </div>
          <div style={{ fontSize: 13, color: c.textMid }}>Students are created automatically when you analyze answer sheets.</div>
        </div>
      )}

      {years.map((yr) => {
        const classes = Object.keys(grouped[yr]).sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }));
        return (
          <div key={yr} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2 }}>
              {yr === "—" ? "No Academic Year" : `AY ${yr}`}
            </div>
            {classes.map((cls) => {
              const sections = Object.keys(grouped[yr][cls]).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
              const multiSection = sections.length > 1 || sections[0] !== "—";
              return (
                <div key={cls} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>
                    {cls === "—" ? "No Class" : `Class ${cls}`}
                  </div>
                  {sections.map((sec) => (
                    <div key={sec} style={{ marginBottom: multiSection ? 12 : 0 }}>
                      {multiSection && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>
                          {sec === "—" ? "No Section" : `Section ${sec}`}
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {grouped[yr][cls][sec].map((student) => {
                          const count = student.analyzer_results?.[0]?.count || 0;
                          const isEditing = editingId === student.id;
                          return (
                            <div key={student.id} style={{ ...card, padding: isMobile ? 12 : 16 }}>
                              {isEditing ? (
                                <div>
                                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                                    {[
                                      { key: "name", label: "Name", type: "text" },
                                      { key: "roll_no", label: "Roll No", type: "text" },
                                      { key: "class", label: "Class", type: "text" },
                                      { key: "section", label: "Section", type: "text" },
                                      { key: "academic_year", label: "Academic Year", type: "text" },
                                      { key: "email", label: "Email", type: "email" },
                                    ].map(({ key, label, type }) => (
                                      <div key={key}>
                                        <div style={{ fontSize: 10, color: c.textDim, marginBottom: 3 }}>{label}</div>
                                        <input style={{ ...input, fontSize: 12, padding: "6px 10px", width: "100%", boxSizing: "border-box" }}
                                          type={type} value={editForm[key]}
                                          onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} />
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button style={{ ...btn.primary, fontSize: 11, padding: "5px 14px", opacity: saving ? 0.6 : 1 }}
                                      onClick={() => saveEdit(student.id)} disabled={saving}>Save</button>
                                    <button style={{ ...btn.ghost, fontSize: 11, padding: "5px 10px" }}
                                      onClick={() => setEditingId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 38, height: 38, borderRadius: 19, background: c.accentDim, border: `1px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
                                    {(student.name || "?").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: student.name ? c.text : c.textDim }}>
                                      {student.name || (student.roll_no ? `Roll No. ${student.roll_no}` : "Unidentified Student")}
                                    </div>
                                    <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>
                                      {!student.name && student.roll_no && <span style={{ marginRight: 8, color: c.warning, fontSize: 11 }}>Name not extracted — assign in test results</span>}
                                      {student.name && student.roll_no && <span style={{ marginRight: 8 }}>Roll: {student.roll_no}</span>}
                                      <span>{count} test{count !== 1 ? "s" : ""}</span>
                                    </div>
                                    {student.email && (
                                      <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>{student.email}</div>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                    <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px" }}
                                      onClick={(e) => { e.stopPropagation(); startEdit(student); }}>Edit</button>
                                    <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px" }}
                                      onClick={() => navigate("student-detail", { studentId: student.id })}>›</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
