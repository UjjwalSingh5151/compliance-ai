import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Try to import xlsx dynamically
        import("xlsx").then(({ read, utils }) => {
          const wb = read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = utils.sheet_to_json(ws, { defval: "" });
          // Normalize column names (lowercase, trim)
          const normalized = rows.map((row) => {
            const out = {};
            for (const [k, v] of Object.entries(row)) {
              out[k.toLowerCase().trim().replace(/\s+/g, "_")] = v;
            }
            return out;
          });
          resolve(normalized);
        }).catch(reject);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const EMPTY_FORM = { name: "", roll_no: "", class: "", academic_year: "", email: "" };

export default function StudentCRM({ navigate, isMobile }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef();
  const p = isMobile ? 16 : 28;

  const load = () => {
    setLoading(true);
    api.getSchoolStudents()
      .then(({ students }) => setStudents(students || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q)
      || (s.roll_no || "").toLowerCase().includes(q)
      || (s.class || "").toLowerCase().includes(q)
      || (s.email || "").toLowerCase().includes(q);
  });

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const rows = await parseExcel(file);
      if (!rows.length) { setImportResult({ error: "No rows found in file" }); return; }
      const result = await api.importStudents(rows);
      setImportResult(result);
      load();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setAdding(true);
    try {
      const { student } = await api.addStudent(addForm);
      setStudents((prev) => [student, ...prev]);
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  };

  const saveEmail = async (id) => {
    setSaving(true);
    try {
      const { student } = await api.updateStudent(id, { email: editEmail.trim().toLowerCase() || null });
      setStudents((prev) => prev.map((s) => s.id === id ? { ...s, email: student.email } : s));
      setEditingId(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: p, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Student CRM</h1>
          <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {students.length} student{students.length !== 1 ? "s" : ""} in your school
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn.primary, fontSize: 12 }} onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "✕ Cancel" : "+ Add Student"}
          </button>
          <button style={{ ...btn.secondary, fontSize: 12 }} onClick={() => fileRef.current.click()} disabled={importing}>
            {importing ? "Importing…" : "📥 Import Excel"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      {importResult && (
        <div style={{ ...card, marginBottom: 16, padding: 14, background: importResult.error ? c.dangerDim : `${c.success}10`, border: `1px solid ${importResult.error ? c.danger : c.success}30` }}>
          {importResult.error ? (
            <span style={{ fontSize: 13, color: c.danger }}>{importResult.error}</span>
          ) : (
            <span style={{ fontSize: 13, color: c.success }}>
              Import complete — {importResult.imported} added, {importResult.updated} updated
            </span>
          )}
        </div>
      )}

      {/* Add Student form */}
      {showAddForm && (
        <form onSubmit={submitAdd} style={{ ...card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 2 }}>ADD STUDENT</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Name *</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} placeholder="Full name" value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Roll No</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} placeholder="e.g. 42" value={addForm.roll_no}
                onChange={(e) => setAddForm((p) => ({ ...p, roll_no: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Class</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} placeholder="e.g. 10A" value={addForm.class}
                onChange={(e) => setAddForm((p) => ({ ...p, class: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Academic Year</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} placeholder="e.g. 2024-25" value={addForm.academic_year}
                onChange={(e) => setAddForm((p) => ({ ...p, academic_year: e.target.value }))} />
            </div>
            <div style={{ gridColumn: isMobile ? undefined : "1 / -1" }}>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Email (for student portal)</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} type="email" placeholder="student@email.com" value={addForm.email}
                onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={{ ...btn.ghost, fontSize: 12 }} onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); }}>Cancel</button>
            <button type="submit" style={{ ...btn.primary, fontSize: 12, opacity: adding ? 0.6 : 1 }} disabled={adding || !addForm.name.trim()}>
              {adding ? "Adding…" : "Add Student"}
            </button>
          </div>
        </form>
      )}

      {/* Excel format hint */}
      <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, background: c.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}` }}>
        Excel columns: <strong style={{ color: c.textMid }}>name · roll_no · class · academic_year · email</strong>
        {" "}(first row = headers, email is optional)
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, roll no, class or email…"
        style={{ width: "100%", padding: "10px 14px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }} />

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 36 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            {search ? "No students match" : "No students yet"}
          </div>
          <div style={{ fontSize: 13, color: c.textMid }}>
            Import an Excel file or students will appear here after answer sheets are analyzed.
          </div>
        </div>
      )}

      {(() => {
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
        const sk = (k) => (k === "—" ? "￿" : k);
        const years = Object.keys(grouped).sort((a, b) => sk(b).localeCompare(sk(a)));

        return years.map((yr) => {
          const classes = Object.keys(grouped[yr]).sort((a, b) => sk(a).localeCompare(sk(b), undefined, { numeric: true }));
          return (
            <div key={yr} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2 }}>
                {yr === "—" ? "No Academic Year" : `AY ${yr}`}
              </div>
              {classes.map((cls) => {
          const sections = Object.keys(grouped[yr][cls]).sort((a, b) => sk(a).localeCompare(sk(b)));
          const multiSection = sections.length > 1 || sections[0] !== "—";
          return (
            <div key={cls} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>
                {cls === "—" ? "No Class" : `Class ${cls}`}
              </div>
              {sections.map((sec) => (
                <div key={sec} style={{ marginBottom: multiSection ? 14 : 0 }}>
                  {multiSection && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 2 }}>
                      {sec === "—" ? "No Section" : `Section ${sec}`}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {grouped[yr][cls][sec].map((s) => {
                      const count = s.analyzer_results?.[0]?.count || 0;
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} style={{ ...card, padding: isMobile ? 12 : 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 19, background: c.accentDim, border: `1px solid ${c.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
                              {(s.name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.name || "Unknown"}</div>
                              <div style={{ fontSize: 12, color: c.textMid, marginTop: 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {s.roll_no && <span>Roll: {s.roll_no}</span>}
                                {s.academic_year && <span>{s.academic_year}</span>}
                                <span>{count} test{count !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                            <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px", flexShrink: 0 }}
                              onClick={() => navigate("student-detail", { studentId: s.id })}>
                              Results →
                            </button>
                          </div>

                          {/* Email row */}
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                                <input style={{ ...input, flex: 1, fontSize: 12, padding: "6px 10px" }} type="email"
                                  placeholder="student@email.com" value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveEmail(s.id)} autoFocus />
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button style={{ ...btn.primary, fontSize: 11, padding: "5px 12px", opacity: saving ? 0.6 : 1 }}
                                    onClick={() => saveEmail(s.id)} disabled={saving}>Save</button>
                                  <button style={{ ...btn.ghost, fontSize: 11, padding: "5px 10px" }}
                                    onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: s.email ? c.textMid : c.textDim, flex: 1 }}>
                                  {s.email || "No email — click to add"}
                                </span>
                                <button style={{ ...btn.ghost, fontSize: 11, padding: "3px 10px" }}
                                  onClick={() => { setEditingId(s.id); setEditEmail(s.email || ""); }}>
                                  {s.email ? "Edit" : "Add email"}
                                </button>
                              </div>
                            )}
                          </div>
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
        });
      })()}
    </div>
  );
}
