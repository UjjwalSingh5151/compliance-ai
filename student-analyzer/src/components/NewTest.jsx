import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

const LENIENCY_LEVELS = [
  { value: 1, label: "Very Strict",  desc: "Full marks only for perfect answers with correct terminology and complete working." },
  { value: 2, label: "Strict",       desc: "Minor errors in presentation or terminology result in deductions." },
  { value: 3, label: "Balanced",     desc: "Correct concepts rewarded even if presentation isn't perfect." },
  { value: 4, label: "Lenient",      desc: "Award marks generously if student shows understanding despite minor errors." },
  { value: 5, label: "Very Lenient", desc: "Give benefit of doubt. Award marks for any reasonable attempt." },
];

export default function NewTest({ navigate, isMobile }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [cls, setCls] = useState("");
  const [section, setSection] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [leniency, setLeniency] = useState(3);
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const fileRef = useRef();
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getTeachers().then(({ teachers }) => setTeachers(teachers || [])).catch(() => {});
  }, []);

  const handlePaperFile = async (f) => {
    if (!f) return;
    setFile(f);
    setExtracting(true);
    setError(null);
    try {
      const data = await api.extractPaper(f);
      if (data.name) setName(data.name);
      if (data.subject) setSubject(data.subject);
      if (data.totalMarks && data.totalMarks > 0) setTotalMarks(String(data.totalMarks));
      if (data.instructions) setInstructions(data.instructions);
    } catch (e) {
      // Extraction failed — user can fill fields manually, don't block
    } finally {
      setExtracting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("subject", subject.trim());
      fd.append("class", cls.trim());
      fd.append("section", section.trim());
      if (teacherId) fd.append("teacherId", teacherId);
      fd.append("totalMarks", totalMarks);
      fd.append("leniency", leniency);
      fd.append("instructions", instructions.trim());
      if (file) fd.append("questionPaper", file);
      const { test } = await api.createTest(fd);
      navigate("upload", { testId: test.id, testName: test.name });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const selected = LENIENCY_LEVELS.find((l) => l.value === leniency);

  return (
    <div style={{ padding: p, maxWidth: 600, margin: "0 auto" }}>
      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={() => navigate("dashboard")}>
        ← Back
      </button>
      <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text, marginBottom: 4 }}>New Test</h1>
      <p style={{ fontSize: 13, color: c.textMid, marginBottom: 20 }}>
        Upload the question paper — Claude will auto-fill the details for you.
      </p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Question paper — FIRST */}
        <div style={card}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>
            QUESTION PAPER <span style={{ color: c.textDim, fontWeight: 400 }}>(PDF or image)</span>
          </label>
          {file ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: extracting ? `${c.warning}15` : c.accentDim, borderRadius: 8, border: `1px solid ${extracting ? c.warning : c.accent}` }}>
              <span>{extracting ? "⏳" : "📄"}</span>
              <span style={{ flex: 1, fontSize: 13, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              {extracting
                ? <span style={{ fontSize: 11, color: c.warning, flexShrink: 0 }}>Extracting details…</span>
                : <button type="button" style={{ ...btn.ghost, padding: "2px 8px", color: c.danger }} onClick={() => { setFile(null); setName(""); setSubject(""); setTotalMarks("100"); setInstructions(""); }}>✕</button>
              }
            </div>
          ) : (
            <div style={{ border: `2px dashed ${c.border}`, borderRadius: 8, padding: isMobile ? 20 : 28, textAlign: "center", cursor: "pointer" }}
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.accent; }}
              onDragLeave={(e) => e.currentTarget.style.borderColor = c.border}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = c.border; handlePaperFile(e.dataTransfer.files[0] || null); }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>☁️</div>
              <div style={{ fontSize: 13, color: c.textMid }}>Tap to upload or drag & drop</div>
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>PDF, JPG, PNG — Claude will extract test details automatically</div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
                onChange={(e) => handlePaperFile(e.target.files[0] || null)} />
            </div>
          )}
        </div>

        <div style={card}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>TEST NAME *</label>
          <input style={input} placeholder="e.g. Unit 3 Test" value={name} onChange={(e) => setName(e.target.value)} required disabled={extracting} />
        </div>

        <div style={{ ...card, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>CLASS</label>
            <input style={input} placeholder="e.g. 10" value={cls} onChange={(e) => setCls(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>SECTION</label>
            <input style={input} placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>SUBJECT</label>
            <input style={input} placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={extracting} />
          </div>
        </div>

        <div style={{ ...card, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>TEACHER</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              style={{ ...input, appearance: "none", WebkitAppearance: "none" }}>
              <option value="">— None —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.subjects?.length ? ` (${t.subjects.join(", ")})` : ""}
                </option>
              ))}
            </select>
            {teachers.length === 0 && (
              <div style={{ fontSize: 11, color: c.textDim, marginTop: 5 }}>
                Add teachers in Teacher CRM first to link them here.
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>TOTAL MARKS</label>
            <input style={input} type="number" min="1" max="1000" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} disabled={extracting} />
          </div>
        </div>

        <div style={card}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 10 }}>GRADING STRICTNESS</label>
          <div style={{ display: "flex", gap: isMobile ? 4 : 6, marginBottom: 10 }}>
            {LENIENCY_LEVELS.map((l) => (
              <button key={l.value} type="button" onClick={() => setLeniency(l.value)}
                style={{ flex: 1, padding: isMobile ? "6px 2px" : "8px 4px", borderRadius: 8, border: `2px solid`,
                  borderColor: leniency === l.value ? c.accent : c.border,
                  background: leniency === l.value ? c.accentDim : "transparent",
                  color: leniency === l.value ? c.accent : c.textMid,
                  fontSize: isMobile ? 9 : 11, fontWeight: leniency === l.value ? 700 : 400,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                }}>
                {l.value}
                <div style={{ fontSize: isMobile ? 8 : 9, marginTop: 2, fontWeight: 400 }}>{l.label.split(" ").pop()}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: c.textMid, background: c.bg, borderRadius: 6, padding: "8px 10px", lineHeight: 1.5 }}>
            <strong style={{ color: c.text }}>{selected.label}:</strong> {selected.desc}
          </div>
        </div>

        <div style={card}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>
            GRADING INSTRUCTIONS <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea style={{ ...input, minHeight: 80, resize: "vertical", lineHeight: 1.6 }}
            placeholder={"e.g.\n- Q3 accepts two valid approaches\n- Diagrams compulsory for Q5"}
            value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={extracting} />
        </div>

        {error && <div style={{ fontSize: 13, color: c.danger, background: c.dangerDim, padding: "10px 14px", borderRadius: 8 }}>{error}</div>}

        <button type="submit" style={{ ...btn.primary, padding: 12, opacity: (loading || extracting) ? 0.6 : 1 }} disabled={loading || extracting || !name.trim()}>
          {loading ? "Creating…" : extracting ? "Extracting details…" : "Create Test →"}
        </button>
      </form>
    </div>
  );
}
