import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

// ─── Tag chip input ────────────────────────────────────────────────────────────

function TagInput({ tags, setTags, placeholder }) {
  const [val, setVal] = useState("");
  const add = (s) => {
    const t = s.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setVal("");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 8px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, minHeight: 38, alignItems: "center" }}>
      {tags.map((t) => (
        <span key={t} style={{ display: "flex", alignItems: "center", gap: 3, background: c.accentDim, color: c.accent, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, lineHeight: 1.4 }}>
          {t}
          <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}
            style={{ background: "none", border: "none", color: c.accent, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 0 0 2px" }}>
            ×
          </button>
        </span>
      ))}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(val); }
          else if (e.key === "Backspace" && !val && tags.length) setTags(tags.slice(0, -1));
        }}
        onBlur={() => val.trim() && add(val)}
        placeholder={tags.length === 0 ? placeholder : ""}
        style={{ flex: 1, minWidth: 80, background: "transparent", border: "none", color: c.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}
      />
    </div>
  );
}

// ─── Excel parser ──────────────────────────────────────────────────────────────

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      import("xlsx").then(({ read, utils }) => {
        const wb = read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = utils.sheet_to_json(ws, { defval: "" });
        resolve(rows.map((row) => {
          const out = {};
          for (const [k, v] of Object.entries(row)) out[k.toLowerCase().trim().replace(/\s+/g, "_")] = v;
          return out;
        }));
      }).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const EMPTY = { name: "", email: "", classes: [], subjects: [] };

// ─── Main component ────────────────────────────────────────────────────────────

export default function TeacherCRM({ isMobile }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();
  const p = isMobile ? 16 : 28;

  const load = () => {
    setLoading(true);
    api.getTeachers()
      .then(({ teachers }) => setTeachers(teachers || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return !q
      || (t.name || "").toLowerCase().includes(q)
      || (t.email || "").toLowerCase().includes(q)
      || (t.classes || []).some((cls) => cls.toLowerCase().includes(q))
      || (t.subjects || []).some((s) => s.toLowerCase().includes(q));
  });

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setAdding(true);
    try {
      const { teacher } = await api.addTeacher(addForm);
      setTeachers((prev) => [teacher, ...prev]);
      setShowAddForm(false);
      setAddForm(EMPTY);
    } catch (err) { alert(err.message); }
    finally { setAdding(false); }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({ name: t.name || "", email: t.email || "", classes: t.classes || [], subjects: t.subjects || [] });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const { teacher } = await api.updateTeacher(id, editForm);
      setTeachers((prev) => prev.map((t) => (t.id === id ? teacher : t)));
      setEditingId(null);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const deleteTeacher = async (id) => {
    if (!confirm("Remove this teacher from the school?")) return;
    try {
      await api.deleteTeacher(id);
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) { alert(err.message); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const rows = await parseExcel(file);
      if (!rows.length) { setImportResult({ error: "No rows found in file" }); return; }
      const result = await api.importTeachers(rows);
      setImportResult(result);
      load();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ padding: p, maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Teacher CRM</h1>
          <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {teachers.length} teacher{teachers.length !== 1 ? "s" : ""} in your school
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn.primary, fontSize: 12 }} onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "✕ Cancel" : "+ Add Teacher"}
          </button>
          <button style={{ ...btn.secondary, fontSize: 12 }} onClick={() => fileRef.current.click()} disabled={importing}>
            {importing ? "Importing…" : "📥 Import Excel"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div style={{ ...card, marginBottom: 16, padding: 14, background: importResult.error ? c.dangerDim : `${c.success}10`, border: `1px solid ${importResult.error ? c.danger : c.success}30` }}>
          {importResult.error
            ? <span style={{ fontSize: 13, color: c.danger }}>{importResult.error}</span>
            : <span style={{ fontSize: 13, color: c.success }}>Import complete — {importResult.imported} added, {importResult.updated} updated</span>}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={submitAdd} style={{ ...card, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 2 }}>ADD TEACHER</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Name *</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} placeholder="Full name"
                value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Email (for portal access)</label>
              <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} type="email" placeholder="teacher@school.edu"
                value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Classes taught</label>
              <TagInput tags={addForm.classes} setTags={(classes) => setAddForm((f) => ({ ...f, classes }))}
                placeholder="e.g. 10A — press Enter to add" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Subjects</label>
              <TagInput tags={addForm.subjects} setTags={(subjects) => setAddForm((f) => ({ ...f, subjects }))}
                placeholder="e.g. Maths — press Enter to add" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={{ ...btn.ghost, fontSize: 12 }} onClick={() => { setShowAddForm(false); setAddForm(EMPTY); }}>Cancel</button>
            <button type="submit" style={{ ...btn.primary, fontSize: 12, opacity: adding ? 0.6 : 1 }} disabled={adding || !addForm.name.trim()}>
              {adding ? "Adding…" : "Add Teacher"}
            </button>
          </div>
        </form>
      )}

      {/* Excel format hint */}
      <div style={{ fontSize: 11, color: c.textDim, marginBottom: 14, background: c.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.border}` }}>
        Excel columns: <strong style={{ color: c.textMid }}>name · email · classes · subjects</strong>
        {" "}— classes & subjects: comma-separated in one cell (e.g. "10A, 10B")
      </div>

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, class or subject…"
        style={{ width: "100%", padding: "10px 14px", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, outline: "none", marginBottom: 14, fontFamily: "inherit", boxSizing: "border-box" }} />

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 36 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👩‍🏫</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>
            {search ? "No teachers match" : "No teachers yet"}
          </div>
          <div style={{ fontSize: 13, color: c.textMid }}>Import an Excel file or add teachers one by one.</div>
        </div>
      )}

      {/* Teacher list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((t) => {
          const isEditing = editingId === t.id;
          return (
            <div key={t.id} style={{ ...card, padding: isMobile ? 12 : 16 }}>
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Name *</label>
                      <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Email</label>
                      <input style={{ ...input, fontSize: 12, padding: "7px 10px" }} type="email" value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Classes</label>
                      <TagInput tags={editForm.classes} setTags={(classes) => setEditForm((f) => ({ ...f, classes }))} placeholder="e.g. 10A" />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Subjects</label>
                      <TagInput tags={editForm.subjects} setTags={(subjects) => setEditForm((f) => ({ ...f, subjects }))} placeholder="e.g. Maths" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={{ ...btn.ghost, fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                    <button style={{ ...btn.primary, fontSize: 12, opacity: saving ? 0.6 : 1 }}
                      onClick={() => saveEdit(t.id)} disabled={saving || !editForm.name.trim()}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, background: `${c.purple}20`, border: `1px solid ${c.purple}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.purple, flexShrink: 0 }}>
                    {(t.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{t.name}</div>
                    {t.email && <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>{t.email}</div>}
                    {((t.classes?.length > 0) || (t.subjects?.length > 0)) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                        {(t.classes || []).map((cls) => (
                          <span key={cls} style={{ fontSize: 11, background: c.accentDim, color: c.accent, padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                            {cls}
                          </span>
                        ))}
                        {(t.subjects || []).map((sub) => (
                          <span key={sub} style={{ fontSize: 11, background: `${c.purple}18`, color: c.purple, padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                            {sub}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px" }} onClick={() => startEdit(t)}>Edit</button>
                    <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px", color: c.danger }} onClick={() => deleteTeacher(t.id)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
