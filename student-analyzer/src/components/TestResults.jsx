import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { shareUrl, whatsappUrl } from "../lib/share";
import { c, card, btn, input } from "../lib/theme";

const fmtIST = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

function ScoreRing({ pct, size = 52 }) {
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `3px solid ${color}`, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.27, fontWeight: 700, color }}>{pct}%</span>
    </div>
  );
}

function AssignModal({ resultId, onAssign, onClose }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    api.getSchoolStudents()
      .then(({ students }) => setStudents(students || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.name || "").toLowerCase().includes(q)
      || (s.roll_no || "").toLowerCase().includes(q)
      || (s.class || "").toLowerCase().includes(q);
  });

  const assign = async (studentId) => {
    setAssigning(true);
    try {
      const { student } = await api.assignResult(resultId, studentId);
      onAssign(student);
    } catch (e) { alert(e.message); setAssigning(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: c.card, borderRadius: 12, width: "100%", maxWidth: 460, border: `1px solid ${c.border}`, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Assign to Student</div>
          <button style={{ background: "none", border: "none", color: c.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "10px 12px", flexShrink: 0 }}>
          <input style={{ ...input, fontSize: 13 }} placeholder="Search by name, roll no, class…"
            value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ overflowY: "auto", padding: "0 12px 12px", flex: 1 }}>
          {loading && <div style={{ color: c.textDim, fontSize: 13, textAlign: "center", padding: 24 }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ color: c.textDim, fontSize: 13, textAlign: "center", padding: 24 }}>No students found</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((s) => (
              <button key={s.id} disabled={assigning}
                onClick={() => assign(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: `1px solid ${c.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", opacity: assigning ? 0.6 : 1, transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1c2330"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: c.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
                  {(s.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name || "Unknown"}</div>
                  <div style={{ fontSize: 11, color: c.textMid, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {s.roll_no && <span>Roll: {s.roll_no}</span>}
                    {s.class && <span>Class: {s.class}{s.section ? `-${s.section}` : ""}</span>}
                    {s.academic_year && <span>{s.academic_year}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditStudentForm({ student, onSave, onCancel, isMobile }) {
  const [form, setForm] = useState({
    name: student?.name || "",
    roll_no: student?.roll_no || "",
    class: student?.class || "",
    section: student?.section || "",
    academic_year: student?.academic_year || "",
    email: student?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fieldStyle = { ...input, fontSize: 12, padding: "6px 10px" };

  const save = async () => {
    if (!student?.id) return;
    setSaving(true);
    try {
      await api.updateStudent(student.id, form);
      onSave({ ...student, ...form });
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 8, letterSpacing: 0.5 }}>EDIT STUDENT DETAILS</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Name</label><input style={fieldStyle} value={form.name} onChange={set("name")} /></div>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Roll No</label><input style={fieldStyle} value={form.roll_no} onChange={set("roll_no")} /></div>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Class</label><input style={fieldStyle} value={form.class} onChange={set("class")} /></div>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Section</label><input style={fieldStyle} value={form.section} onChange={set("section")} /></div>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Academic Year</label><input style={fieldStyle} value={form.academic_year} onChange={set("academic_year")} /></div>
        <div><label style={{ fontSize: 10, color: c.textDim, display: "block", marginBottom: 2 }}>Email</label><input style={fieldStyle} type="email" value={form.email} onChange={set("email")} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={{ ...btn.ghost, fontSize: 11 }} onClick={onCancel}>Cancel</button>
        <button style={{ ...btn.primary, fontSize: 11, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ThreeDotMenu({ onEdit, onAssign, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const item = (label, color, onClick) => (
    <button onClick={() => { setOpen(false); onClick(); }}
      style={{ display: "block", width: "100%", padding: "9px 14px", background: "transparent", border: "none", color: color || c.textMid, fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#1c2330"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: c.textMid, fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>
        ⋮
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", zIndex: 200, minWidth: 170, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          {item("✎ Edit Details", null, onEdit)}
          {item("👤 Assign to Student", null, onAssign)}
          {item("🗑 Delete Copy", c.danger, onDelete)}
        </div>
      )}
    </div>
  );
}

export default function TestResults({ params, navigate, isMobile }) {
  const { testId } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getTestResults(testId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [testId]);

  const updateStudent = (resultId, updatedStudent) => {
    setData((prev) => ({
      ...prev,
      results: prev.results.map((r) =>
        r.id === resultId ? { ...r, analyzer_students: updatedStudent } : r
      ),
    }));
    setEditingId(null);
  };

  const handleAssign = (resultId, student) => {
    setData((prev) => ({
      ...prev,
      results: prev.results.map((r) =>
        r.id === resultId ? { ...r, analyzer_students: student } : r
      ),
    }));
    setAssigningId(null);
  };

  const handleDelete = async (resultId) => {
    if (!window.confirm("Delete this checked copy? This cannot be undone.")) return;
    try {
      await api.deleteResult(resultId);
      setData((prev) => ({ ...prev, results: prev.results.filter((r) => r.id !== resultId) }));
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div style={{ padding: p, color: c.textDim, fontSize: 13 }}>Loading…</div>;
  if (error || !data?.test) return <div style={{ padding: p, color: c.danger, fontSize: 13 }}>Error: {error || "Test not found"}</div>;

  const { test, results } = data;
  const total = results.length;
  const avg = total > 0
    ? Math.round(results.reduce((s, r) => s + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0) / total)
    : 0;

  return (
    <div style={{ padding: p, maxWidth: 820, margin: "0 auto" }}>
      <button style={{ background: "none", border: "none", color: c.textMid, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0, fontFamily: "inherit" }}
        onClick={() => navigate("dashboard")}>
        ← Back to Tests
      </button>

      {/* Test header */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: c.text }}>{test.name}</div>
            <div style={{ fontSize: 12, color: c.textMid, marginTop: 3 }}>
              {test.subject && <span style={{ marginRight: 10 }}>{test.subject}</span>}
              <span>{test.total_marks} marks</span>
            </div>
          </div>
          <button style={{ ...btn.primary, fontSize: 12 }}
            onClick={() => navigate("upload", { testId: test.id, testName: test.name })}>
            + Upload More
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.border}`, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>{total}</div>
            <div style={{ fontSize: 11, color: c.textDim }}>Sheets</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: avg >= 75 ? c.success : avg >= 50 ? c.warning : c.danger }}>{avg}%</div>
            <div style={{ fontSize: 11, color: c.textDim }}>Avg Score</div>
          </div>
          {total > 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.success }}>
                {Math.max(...results.map((r) => r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0))}%
              </div>
              <div style={{ fontSize: 11, color: c.textDim }}>Highest</div>
            </div>
          )}
        </div>
      </div>

      {/* Results list */}
      {results.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40, color: c.textDim, fontSize: 13 }}>
          No answer sheets analyzed yet.
          <div style={{ marginTop: 12 }}>
            <button style={btn.primary} onClick={() => navigate("upload", { testId: test.id, testName: test.name })}>
              Upload Sheets
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((r) => {
            const student = r.analyzer_students;
            const pct = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
            const isEditing = editingId === r.id;

            return (
              <div key={r.id} style={{ ...card, padding: isMobile ? 14 : 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <ScoreRing pct={pct} size={isMobile ? 44 : 52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                      {student?.name || <span style={{ color: c.textDim, fontStyle: "italic" }}>Unknown Student</span>}
                    </div>
                    <div style={{ fontSize: 12, color: c.textMid, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {student?.roll_no && <span>Roll: {student.roll_no}</span>}
                      {student?.class && <span>Class: {student.class}{student.section ? `-${student.section}` : ""}</span>}
                      {student?.academic_year && <span>{student.academic_year}</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.text, marginTop: 3 }}>
                      {r.marks_obtained}/{r.total_marks} marks
                      {r.analyzed_at && <span style={{ fontSize: 11, fontWeight: 400, color: c.textDim, marginLeft: 8 }}>· {fmtIST(r.analyzed_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <button style={{ ...btn.secondary, fontSize: 11, padding: "5px 10px" }}
                      onClick={() => navigate("result", { resultId: r.id })}>
                      View →
                    </button>
                    <ThreeDotMenu
                      onEdit={() => setEditingId(isEditing ? null : r.id)}
                      onAssign={() => setAssigningId(r.id)}
                      onDelete={() => handleDelete(r.id)}
                    />
                  </div>
                </div>

                {/* Share row */}
                {!isEditing && r.share_token && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${c.border}` }}>
                    <a href={whatsappUrl(r.share_token, student?.name, test.name)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px", textDecoration: "none", color: c.success, border: `1px solid ${c.success}30`, borderRadius: 6 }}>
                      📲 WhatsApp
                    </a>
                    <button style={{ ...btn.ghost, fontSize: 11, padding: "4px 10px" }}
                      onClick={() => navigator.clipboard.writeText(shareUrl(r.share_token))}>
                      🔗 Copy link
                    </button>
                  </div>
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <EditStudentForm
                    student={student}
                    onSave={(updated) => updateStudent(r.id, updated)}
                    onCancel={() => setEditingId(null)}
                    isMobile={isMobile}
                  />
                )}

                {/* Parse error badge */}
                {r.analysis?.parse_error && (
                  <div style={{ marginTop: 8, fontSize: 11, color: c.warning }}>
                    ⚠ Analysis parse error —{" "}
                    <button style={{ background: "none", border: "none", color: c.accent, cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit" }}
                      onClick={() => navigate("result", { resultId: r.id })}>View details</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign modal */}
      {assigningId && (
        <AssignModal
          resultId={assigningId}
          onAssign={(student) => handleAssign(assigningId, student)}
          onClose={() => setAssigningId(null)}
        />
      )}
    </div>
  );
}
