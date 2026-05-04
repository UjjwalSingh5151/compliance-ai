import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

// ─── Tiny markdown renderer (bold, bullets, headings) ─────────────────────────
function SimpleMD({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{ fontSize: 13, color: c.text, lineHeight: 1.75 }}>
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          const content = line.replace(/^#+\s/, "");
          return <div key={i} style={{ fontWeight: 700, fontSize: 14, color: c.text, marginTop: 14, marginBottom: 4 }}>{content}</div>;
        }
        if (/^\d+\.\s/.test(line)) {
          return <div key={i} style={{ marginLeft: 12, color: c.text }}>{line}</div>;
        }
        if (/^[-*•]\s/.test(line)) {
          const content = line.replace(/^[-*•]\s/, "");
          return <div key={i} style={{ marginLeft: 12, color: c.textMid, display: "flex", gap: 6 }}><span style={{ color: c.accent, flexShrink: 0 }}>•</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} /></div>;
        }
        if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ color: c.textMid }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong style='color:${c.text}'>$1</strong>") }} />;
      })}
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ fontSize: 12, color: c.textDim }}>—</span>;
  const color = score >= 75 ? c.success : score >= 50 ? c.warning : c.danger;
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color, background: `${color}18`, padding: "2px 8px", borderRadius: 12 }}>
      {score}%
    </span>
  );
}

// ─── Score distribution mini-bar ──────────────────────────────────────────────
function DistBar({ dist }) {
  if (!dist?.length) return null;
  const total = dist.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  const colors = [c.danger, c.warning, c.accent, c.success];
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
      {dist.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.count}`}
          style={{ width: `${(d.count / total) * 100}%`, background: colors[i], minWidth: d.count > 0 ? 2 : 0 }} />
      ))}
    </div>
  );
}

// ─── Topic chip list ──────────────────────────────────────────────────────────
function TopicList({ items, color }) {
  if (!items?.length) return <div style={{ fontSize: 12, color: c.textDim }}>No data yet</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, i) => (
        <span key={i} style={{
          fontSize: 12, padding: "4px 10px", borderRadius: 20,
          background: `${color}15`, color, border: `1px solid ${color}30`,
          fontWeight: 500,
        }}>
          {item.text}
          {item.count > 1 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>×{item.count}</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...card, padding: "16px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || c.text }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: c.textMid, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Plan modal ───────────────────────────────────────────────────────────────
function PlanModal({ data, onClose, isMobile }) {
  const [type, setType] = useState("teaching");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.generatePlan({
        type,
        subject: data.subject || "General",
        avgScore: data.avgScore,
        mistakes: data.topMistakes || [],
        strengths: data.topStrengths || [],
      });
      setPlan(res.plan || "");
      setGenerated(true);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const copyPlan = () => {
    navigator.clipboard.writeText(plan).then(() => alert("Copied to clipboard!"));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: c.card, border: `1px solid ${c.border}`, borderRadius: isMobile ? "16px 16px 0 0" : 12,
        width: isMobile ? "100%" : "min(680px, 95vw)", maxHeight: "85vh", display: "flex", flexDirection: "column",
        ...(isMobile ? {} : { marginBottom: "7.5vh" }),
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>📋 Generate Plan</div>
          <button style={{ ...btn.ghost, padding: "4px 10px", fontSize: 12 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Type selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["teaching", "📚 Teaching Plan"], ["revision", "🔄 Revision Plan"]].map(([val, label]) => (
              <button key={val} onClick={() => setType(val)}
                style={{ ...btn.ghost, flex: 1, fontSize: 12, fontWeight: type === val ? 700 : 400,
                  background: type === val ? c.accentDim : "transparent",
                  color: type === val ? c.accent : c.textMid,
                  border: `1px solid ${type === val ? c.accent : c.border}` }}>
                {label}
              </button>
            ))}
          </div>

          {/* Context preview */}
          <div style={{ ...card, padding: 12, marginBottom: 16, background: c.bg }}>
            <div style={{ fontSize: 11, color: c.textDim, marginBottom: 6, fontWeight: 600 }}>USING THIS DATA</div>
            <div style={{ fontSize: 12, color: c.textMid }}>
              Subject: <strong style={{ color: c.text }}>{data.subject || "General"}</strong> ·
              Avg: <strong style={{ color: c.text }}>{data.avgScore !== null ? `${data.avgScore}%` : "—"}</strong> ·
              {data.topMistakes?.length || 0} mistake patterns · {data.topStrengths?.length || 0} strength patterns
            </div>
          </div>

          {!generated ? (
            <button style={{ ...btn.primary, width: "100%", opacity: loading ? 0.6 : 1 }}
              onClick={generate} disabled={loading}>
              {loading ? "Generating…" : `Generate ${type === "revision" ? "Revision" : "Teaching"} Plan →`}
            </button>
          ) : (
            <div>
              <div style={{ ...card, padding: "16px", background: c.bg, marginBottom: 12 }}>
                <SimpleMD text={plan} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...btn.secondary, flex: 1, fontSize: 12 }} onClick={copyPlan}>📋 Copy</button>
                <button style={{ ...btn.ghost, flex: 1, fontSize: 12 }} onClick={() => setGenerated(false)}>← Regenerate</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Per-student breakdown table ─────────────────────────────────────────────
function AllStudentsTable({ students, isMobile }) {
  const [expanded, setExpanded] = useState(null); // roll/name key of expanded row

  if (!students?.length) return null;

  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>
        ALL STUDENTS ({students.length})
      </div>

      {/* Header row */}
      <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${c.border}`, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 11, color: c.textDim, fontWeight: 600 }}>STUDENT</div>
        {!isMobile && <div style={{ width: 60, fontSize: 11, color: c.textDim, fontWeight: 600, textAlign: "center" }}>TESTS</div>}
        <div style={{ width: 70, fontSize: 11, color: c.textDim, fontWeight: 600, textAlign: "right" }}>AVG</div>
        <div style={{ width: 20 }} />
      </div>

      {students.map((s, i) => {
        const key = s.roll || s.name || i;
        const isOpen = expanded === key;
        return (
          <div key={key}>
            {/* Student row */}
            <div
              onClick={() => setExpanded(isOpen ? null : key)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 0",
                borderBottom: `1px solid ${c.border}`, cursor: s.testBreakdown?.length > 0 ? "pointer" : "default",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>
                  {s.roll && <span style={{ marginRight: 8 }}>Roll: {s.roll}</span>}
                  {s.class && <span>Class {s.class}</span>}
                </div>
              </div>
              {!isMobile && (
                <div style={{ width: 60, textAlign: "center", fontSize: 13, color: c.textMid }}>{s.testCount}</div>
              )}
              <div style={{ width: 70, textAlign: "right" }}>
                <ScoreBadge score={s.avg} />
              </div>
              <div style={{ width: 20, textAlign: "center", fontSize: 12, color: c.textDim }}>
                {s.testBreakdown?.length > 0 ? (isOpen ? "▲" : "▼") : ""}
              </div>
            </div>

            {/* Per-test breakdown */}
            {isOpen && s.testBreakdown?.length > 0 && (
              <div style={{ background: c.bg, borderLeft: `2px solid ${c.border}`, marginLeft: 8, marginBottom: 4, borderRadius: "0 0 6px 6px" }}>
                {s.testBreakdown.map((t, ti) => (
                  <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: ti < s.testBreakdown.length - 1 ? `1px solid ${c.border}` : "none" }}>
                    <div>
                      <div style={{ fontSize: 12, color: c.text, fontWeight: 500 }}>{t.testName}</div>
                      <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>
                        {t.subject && <span style={{ marginRight: 6 }}>{t.subject}</span>}
                        <span>{t.marks}/{t.total} marks</span>
                      </div>
                    </div>
                    <ScoreBadge score={t.score} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Teacher drill-down view ──────────────────────────────────────────────────
function TeacherDetail({ teacherId, teacherName, onBack, isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlan, setShowPlan] = useState(false);
  const p = isMobile ? 16 : 24;

  const loadTeacher = () => {
    setLoading(true);
    setError(null);
    api.getTeacherAnalytics(teacherId)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(loadTeacher, [teacherId]);

  if (loading) return <div style={{ padding: p, color: c.textDim, fontSize: 13 }}>Loading…</div>;
  if (error || !data) return (
    <div style={{ padding: p }}>
      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={onBack}>← Back</button>
      <div style={{ background: `${c.danger}15`, border: `1px solid ${c.danger}40`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.danger, marginBottom: 4 }}>Failed to load teacher analytics</div>
          <div style={{ fontSize: 13, color: c.textMid, marginBottom: 12 }}>{error || "Unexpected error"}</div>
          <button style={{ ...btn.secondary, fontSize: 12 }} onClick={loadTeacher}>Try again</button>
        </div>
      </div>
    </div>
  );

  const subjectLabel = data.teacher.subjects?.join(", ") || "—";

  return (
    <div style={{ padding: p }}>
      <button style={{ ...btn.ghost, marginBottom: 16, paddingLeft: 0, color: c.textMid }} onClick={onBack}>
        ← Back to Analytics
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: c.text }}>{data.teacher.name}</h2>
          <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {data.teacher.email && <span style={{ marginRight: 10 }}>{data.teacher.email}</span>}
            {data.teacher.subjects?.length > 0 && <span>Subjects: {subjectLabel}</span>}
          </div>
        </div>
        <button style={{ ...btn.secondary, fontSize: 12 }} onClick={() => setShowPlan(true)}>
          📋 Generate Plan
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Tests" value={data.totalTests} />
        <StatCard label="Answer Sheets" value={data.totalResults} />
        <StatCard label="Avg Score" value={data.avgScore !== null ? `${data.avgScore}%` : "—"}
          color={data.avgScore >= 75 ? c.success : data.avgScore >= 50 ? c.warning : c.danger} />
      </div>

      {/* Strengths & Mistakes */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 10, letterSpacing: 0.5 }}>COMMON STRENGTHS</div>
          <TopicList items={data.topStrengths} color={c.success} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.danger, marginBottom: 10, letterSpacing: 0.5 }}>COMMON MISTAKES</div>
          <TopicList items={data.topMistakes} color={c.danger} />
        </div>
      </div>

      {/* All students — per-student breakdown */}
      {data.allStudents?.length > 0 && (
        <AllStudentsTable students={data.allStudents} isMobile={isMobile} />
      )}

      {/* Test list */}
      {data.testStats?.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>TESTS ({data.testStats.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.testStats.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>
                    {t.subject} {t.class && `· Class ${t.class}`} · {t.resultCount} sheet{t.resultCount !== 1 ? "s" : ""}
                  </div>
                  <div style={{ marginTop: 4, width: 120 }}><DistBar dist={t.scoreDistribution} /></div>
                </div>
                <ScoreBadge score={t.avgScore} />
              </div>
            ))}
          </div>
        </div>
      )}

      {showPlan && (
        <PlanModal
          data={{ subject: data.teacher.subjects?.[0], avgScore: data.avgScore, topMistakes: data.topMistakes, topStrengths: data.topStrengths }}
          onClose={() => setShowPlan(false)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ─── Main Analytics component ─────────────────────────────────────────────────
export default function Analytics({ isMobile, schoolRole }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview"); // "overview" | "teachers"
  const [drillTeacherId, setDrillTeacherId] = useState(null);
  const [drillTeacherName, setDrillTeacherName] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const p = isMobile ? 16 : 28;

  const isOwner = schoolRole === "owner";

  const load = () => {
    setLoading(true);
    setError(null);
    api.getMyAnalytics()
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load analytics"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div style={{ padding: p, display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <div style={{ fontSize: 13, color: c.textDim }}>Loading analytics…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: p }}>
        <div style={{ background: `${c.danger}15`, border: `1px solid ${c.danger}40`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.danger, marginBottom: 4 }}>Failed to load analytics</div>
            <div style={{ fontSize: 13, color: c.textMid, marginBottom: 12 }}>{error}</div>
            <button style={{ ...btn.secondary, fontSize: 12 }} onClick={load}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // Teacher drill-down
  if (drillTeacherId) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <TeacherDetail
          teacherId={drillTeacherId}
          teacherName={drillTeacherName}
          onBack={() => setDrillTeacherId(null)}
          isMobile={isMobile}
        />
      </div>
    );
  }

  const noData = !data || (data.totalTests === 0 && data.totalResults === 0);

  return (
    <div style={{ padding: p, maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>
            {isOwner ? "School Analytics" : "My Analytics"}
          </h1>
          <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
            {data?.totalTests || 0} test{data?.totalTests !== 1 ? "s" : ""} · {data?.totalResults || 0} answer sheets analyzed
          </p>
        </div>
        {!noData && (
          <button style={{ ...btn.secondary, fontSize: 12 }} onClick={() => setShowPlan(true)}>
            📋 Generate Plan
          </button>
        )}
      </div>

      {noData ? (
        <div style={{ ...card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>No analytics yet</div>
          <div style={{ fontSize: 13, color: c.textMid }}>
            {isOwner
              ? "Upload answer sheets to tests to start seeing class performance data."
              : "Once you create tests and upload answer sheets, your analytics will appear here."}
          </div>
        </div>
      ) : (
        <>
          {/* Stat summary */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Tests" value={data.totalTests} />
            <StatCard label="Sheets Analyzed" value={data.totalResults} />
            <StatCard
              label="Avg Score"
              value={data.avgScore !== null ? `${data.avgScore}%` : "—"}
              color={data.avgScore >= 75 ? c.success : data.avgScore >= 50 ? c.warning : c.danger}
            />
          </div>

          {/* Tab bar (owner only) */}
          {isOwner && (
            <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${c.border}` }}>
              {[["overview", "Overview"], ["teachers", "By Teacher"]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ ...btn.ghost, padding: "8px 16px", fontSize: 13, borderRadius: "6px 6px 0 0",
                    color: tab === id ? c.accent : c.textMid, fontWeight: tab === id ? 700 : 400,
                    borderBottom: tab === id ? `2px solid ${c.accent}` : "2px solid transparent" }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Overview tab */}
          {tab === "overview" && (
            <>
              {/* Strengths & Mistakes */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.success, marginBottom: 10, letterSpacing: 0.5 }}>
                    MOST COMMON STRENGTHS
                  </div>
                  <TopicList items={data.topStrengths} color={c.success} />
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.danger, marginBottom: 10, letterSpacing: 0.5 }}>
                    MOST COMMON MISTAKES
                  </div>
                  <TopicList items={data.topMistakes} color={c.danger} />
                </div>
              </div>

              {/* Test performance table */}
              {data.testStats?.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.textMid, marginBottom: 12, letterSpacing: 0.5 }}>
                    TEST PERFORMANCE
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {data.testStats.map((t, i) => (
                      <div key={t.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 0",
                        borderBottom: i < data.testStats.length - 1 ? `1px solid ${c.border}` : "none",
                        gap: 12,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>
                            {t.subject && <span style={{ marginRight: 8 }}>{t.subject}</span>}
                            {t.class && <span style={{ marginRight: 8 }}>Class {t.class}</span>}
                            <span>{t.resultCount} sheet{t.resultCount !== 1 ? "s" : ""}</span>
                          </div>
                          {t.scoreDistribution && (
                            <div style={{ marginTop: 5, width: isMobile ? "100%" : 160 }}>
                              <DistBar dist={t.scoreDistribution} />
                            </div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <ScoreBadge score={t.avgScore} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* By Teacher tab (owner only) */}
          {tab === "teachers" && isOwner && (
            <div>
              {!data.teacherStats?.length ? (
                <div style={{ ...card, textAlign: "center", padding: 32, color: c.textMid, fontSize: 13 }}>
                  No teachers have been assigned to tests yet. Add teachers in the Teachers tab and assign them when creating tests.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.teacherStats.map((t) => (
                    <div key={t.id} style={{ ...card, padding: isMobile ? 14 : 18, cursor: t.testCount > 0 ? "pointer" : "default" }}
                      onClick={() => t.testCount > 0 && (setDrillTeacherId(t.id), setDrillTeacherName(t.name))}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 20, background: `${c.purple}20`, border: `1px solid ${c.purple}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: c.purple, flexShrink: 0 }}>
                          {(t.name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{t.name}</div>
                            <ScoreBadge score={t.avgScore} />
                          </div>
                          {t.email && <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>{t.email}</div>}
                          <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                            <div style={{ fontSize: 12, color: c.textDim }}>
                              <strong style={{ color: c.text }}>{t.testCount}</strong> test{t.testCount !== 1 ? "s" : ""}
                            </div>
                            <div style={{ fontSize: 12, color: c.textDim }}>
                              <strong style={{ color: c.text }}>{t.resultCount}</strong> sheet{t.resultCount !== 1 ? "s" : ""} analyzed
                            </div>
                          </div>
                          {(t.subjects?.length > 0 || t.classes?.length > 0) && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                              {(t.classes || []).map((cls) => (
                                <span key={cls} style={{ fontSize: 11, background: c.accentDim, color: c.accent, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{cls}</span>
                              ))}
                              {(t.subjects || []).map((sub) => (
                                <span key={sub} style={{ fontSize: 11, background: `${c.purple}18`, color: c.purple, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{sub}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {t.testCount > 0 && (
                          <div style={{ fontSize: 18, color: c.textDim, flexShrink: 0 }}>›</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showPlan && data && (
        <PlanModal
          data={{
            subject: data.testStats?.[0]?.subject,
            avgScore: data.avgScore,
            topMistakes: data.topMistakes,
            topStrengths: data.topStrengths,
          }}
          onClose={() => setShowPlan(false)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
