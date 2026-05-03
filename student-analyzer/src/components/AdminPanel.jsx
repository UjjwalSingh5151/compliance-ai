import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

// ─── Usage metrics panel ──────────────────────────────────────────────────────
function MetricsPanel({ isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getAdminMetrics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>;
  if (error) return <div style={{ color: c.danger, fontSize: 13 }}>Error: {error}</div>;

  const { totalPapers, papersThisMonth, papersLastMonth, momGrowth, approvedSchools, activeSchools, perSchool } = data;
  const growthColor = momGrowth > 0 ? c.success : momGrowth < 0 ? c.danger : c.textMid;

  const statBoxStyle = { ...card, padding: "14px 18px", textAlign: "center", minWidth: 110, flex: "1 1 110px" };

  return (
    <div>
      <div style={{ fontSize: 12, color: c.textMid, marginBottom: 16, lineHeight: 1.6 }}>
        Live usage stats. Use these numbers in interviews — no SQL needed.
      </div>

      {/* Top stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.accent }}>{totalPapers}</div>
          <div style={{ fontSize: 11, color: c.textDim }}>Papers graded (all time)</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.text }}>{papersThisMonth}</div>
          <div style={{ fontSize: 11, color: c.textDim }}>Papers this month</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 28, fontWeight: 800, color: growthColor }}>
            {momGrowth > 0 ? "+" : ""}{momGrowth}%
          </div>
          <div style={{ fontSize: 11, color: c.textDim }}>MoM growth</div>
          <div style={{ fontSize: 10, color: c.textDim, marginTop: 1 }}>vs last month ({papersLastMonth} papers)</div>
        </div>
        <div style={statBoxStyle}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.success }}>{activeSchools}</div>
          <div style={{ fontSize: 11, color: c.textDim }}>Active schools</div>
          <div style={{ fontSize: 10, color: c.textDim, marginTop: 1 }}>of {approvedSchools} approved</div>
        </div>
      </div>

      {/* Per-school breakdown */}
      {perSchool?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>
            PER-SCHOOL USAGE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {perSchool.map((s) => (
              <div key={s.id} style={{ ...card, padding: isMobile ? 12 : 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</div>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: c.accent }}>{s.total}</div>
                    <div style={{ fontSize: 10, color: c.textDim }}>all time</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: s.thisMonth > 0 ? c.success : c.textDim }}>{s.thisMonth}</div>
                    <div style={{ fontSize: 10, color: c.textDim }}>this month</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!perSchool || perSchool.length === 0) && (
        <div style={{ ...card, textAlign: "center", padding: 32, color: c.textDim, fontSize: 13 }}>
          No graded papers yet.
        </div>
      )}
    </div>
  );
}

// ─── Accuracy benchmark panel ─────────────────────────────────────────────────
function BenchmarkPanel({ isMobile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getAdminBenchmark()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data?.benchmarkRows?.length) return;
    const header = "School,Subject,Class,Papers with overrides,Total overrides,AI agreement %\n";
    const rows = data.benchmarkRows.map((r) =>
      `"${r.schoolName}","${r.subject}","${r.class}",${r.papers},${r.totalOverrides},${r.agreementPct ?? "N/A"}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-accuracy-benchmark.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>;
  if (error) return <div style={{ color: c.danger, fontSize: 13 }}>Error: {error}</div>;

  const { benchmarkRows, overallAgreement, totalOverrides, note } = data;

  return (
    <div>
      <div style={{ fontSize: 12, color: c.textMid, marginBottom: 16, lineHeight: 1.6 }}>
        AI-teacher agreement % based on teacher mark overrides. <br />
        <em>"Our system agrees with teacher grades {overallAgreement ?? "—"}% of the time."</em>
      </div>

      {/* Overall agreement headline */}
      {overallAgreement !== null && (
        <div style={{ ...card, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: overallAgreement >= 85 ? c.success : overallAgreement >= 70 ? c.warning : c.danger }}>
            {overallAgreement}%
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Overall AI-Teacher Agreement</div>
            <div style={{ fontSize: 12, color: c.textDim, marginTop: 2 }}>
              Across {totalOverrides} teacher corrections in {benchmarkRows.length} subject/class group{benchmarkRows.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button style={{ ...btn.ghost, fontSize: 12, marginLeft: "auto" }} onClick={exportCSV}>
            ↓ Export CSV
          </button>
        </div>
      )}

      {note && (
        <div style={{ ...card, padding: 16, marginBottom: 16, background: `${c.warning}0A`, border: `1px solid ${c.warning}30` }}>
          <div style={{ fontSize: 12, color: c.textMid }}>{note}</div>
          <div style={{ fontSize: 11, color: c.textDim, marginTop: 8 }}>
            To generate data: teachers can click "Override marks" on any question in a result to log a correction. Each correction is counted here.
          </div>
        </div>
      )}

      {benchmarkRows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {benchmarkRows.map((row, i) => (
            <div key={i} style={{ ...card, padding: isMobile ? 12 : 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                  {row.subject} · Class {row.class}
                </div>
                <div style={{ fontSize: 11, color: c.textMid, marginTop: 1 }}>{row.schoolName} · {row.papers} papers</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: c.textDim }}>Overrides</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{row.totalOverrides}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: c.textDim }}>Agreement</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: row.agreementPct >= 85 ? c.success : row.agreementPct >= 70 ? c.warning : c.danger }}>
                    {row.agreementPct ?? "—"}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Invite school sub-panel ──────────────────────────────────────────────────
function InvitePanel({ isMobile }) {
  const [email, setEmail]       = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState([]);   // list of successfully invited emails
  const [error, setError]       = useState(null);

  const send = async () => {
    if (!email.trim()) return;
    setSending(true); setError(null);
    try {
      await api.inviteSchool(email.trim());
      setSent((prev) => [email.trim(), ...prev]);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: c.textMid, marginBottom: 18, lineHeight: 1.6 }}>
        Enter the school admin's email. They'll receive a magic link that logs them in directly —
        no OTP expiry issues. Once they complete setup, their school appears in the Pending list for you to approve.
      </div>

      <div style={{ ...card, padding: isMobile ? 16 : 20, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 8 }}>
          SCHOOL ADMIN EMAIL
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...input, flex: 1, minWidth: 200, fontSize: 13 }}
            type="email"
            placeholder="principal@school.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={sending}
          />
          <button
            style={{ ...btn.primary, fontSize: 13, opacity: sending ? 0.6 : 1, whiteSpace: "nowrap" }}
            onClick={send}
            disabled={sending || !email.trim()}
          >
            {sending ? "Sending…" : "Send Invite"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: c.danger, background: `${c.danger}12`, padding: "8px 12px", borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>

      {sent.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.success, marginBottom: 8, letterSpacing: 0.5 }}>
            INVITES SENT ({sent.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sent.map((e) => (
              <div key={e} style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>✉️</span>
                <div>
                  <div style={{ fontSize: 13, color: c.text }}>{e}</div>
                  <div style={{ fontSize: 11, color: c.textDim, marginTop: 1 }}>
                    Magic link sent — they'll appear in Pending once they complete setup
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_COLOR = { approved: c.success, pending: c.warning, rejected: c.danger };

// ─── Credits sub-panel ────────────────────────────────────────────────────────
function CreditsPanel({ isMobile }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);   // schoolId being edited
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null); // { schoolId, txns }

  const load = () => {
    setLoading(true);
    api.getAdminCredits()
      .then(({ schools }) => setSchools(schools || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (schoolId) => {
    const amt = parseInt(amount);
    if (!amt || isNaN(amt)) return;
    setSaving(true);
    try {
      const { newBalance } = await api.addSchoolCredits(schoolId, amt, note || "Admin adjustment");
      setSchools((prev) => prev.map((s) => s.id === schoolId ? { ...s, credits: newBalance } : s));
      setAdding(null); setAmount(""); setNote("");
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const loadHistory = async (schoolId) => {
    if (history?.schoolId === schoolId) { setHistory(null); return; }
    try {
      const { transactions } = await api.getSchoolCreditHistory(schoolId);
      setHistory({ schoolId, txns: transactions || [] });
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>;

  const approved = schools.filter((s) => s.status === "approved");

  return (
    <div>
      <div style={{ fontSize: 12, color: c.textMid, marginBottom: 14 }}>
        Credits are deducted per page analyzed: 1 credit/page for answer sheets, 5 for AI paper generation, 3 for transcription.
      </div>

      {approved.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 32, color: c.textDim, fontSize: 13 }}>No approved schools yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {approved.map((s) => (
          <div key={s.id}>
            <div style={{ ...card, padding: isMobile ? 12 : 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.name}</div>
                  {s.contact_email && <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>{s.contact_email}</div>}
                  {s.usageLast7Days > 0 && (
                    <div style={{ fontSize: 11, color: c.textDim, marginTop: 2 }}>Used {s.usageLast7Days} credits in last 7 days</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.credits > 20 ? c.success : s.credits > 0 ? c.warning : c.danger }}>
                      {s.credits}
                    </div>
                    <div style={{ fontSize: 10, color: c.textDim }}>credits</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...btn.primary, fontSize: 11, padding: "5px 12px" }} onClick={() => setAdding(adding === s.id ? null : s.id)}>
                      {adding === s.id ? "✕" : "+ Add"}
                    </button>
                    <button style={{ ...btn.ghost, fontSize: 11, padding: "5px 10px" }} onClick={() => loadHistory(s.id)}>
                      {history?.schoolId === s.id ? "Hide" : "History"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Add credits form */}
              {adding === s.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Amount (use − to deduct)</label>
                    <input style={{ ...input, width: 100, fontSize: 12, padding: "6px 10px" }}
                      type="number" placeholder="e.g. 100" value={amount}
                      onChange={(e) => setAmount(e.target.value)} autoFocus />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: c.textDim, display: "block", marginBottom: 3 }}>Note (optional)</label>
                    <input style={{ ...input, fontSize: 12, padding: "6px 10px", width: "100%", boxSizing: "border-box" }}
                      placeholder="e.g. Monthly top-up" value={note}
                      onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <button style={{ ...btn.primary, fontSize: 12, opacity: saving ? 0.6 : 1 }}
                    onClick={() => submit(s.id)} disabled={saving || !amount}>
                    {saving ? "Saving…" : "Confirm"}
                  </button>
                </div>
              )}
            </div>

            {/* Transaction history */}
            {history?.schoolId === s.id && (
              <div style={{ ...card, marginTop: 4, padding: "10px 16px", background: c.bg }}>
                {history.txns.length === 0 ? (
                  <div style={{ fontSize: 12, color: c.textDim }}>No transactions yet.</div>
                ) : history.txns.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${c.border}`, fontSize: 12 }}>
                    <div>
                      <span style={{ color: t.amount > 0 ? c.success : c.danger, fontWeight: 600 }}>
                        {t.amount > 0 ? "+" : ""}{t.amount}
                      </span>
                      <span style={{ color: c.textMid, marginLeft: 10 }}>{t.description || t.type}</span>
                    </div>
                    <div style={{ color: c.textDim }}>
                      bal {t.balance_after} · {new Date(t.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main admin panel ─────────────────────────────────────────────────────────
export default function AdminPanel({ navigate, isMobile }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [tab, setTab] = useState("schools"); // "schools" | "invite" | "credits" | "metrics" | "benchmark"
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getAdminSchools()
      .then(({ schools }) => setSchools(schools || []))
      .finally(() => setLoading(false));
  }, []);

  const setStatus = async (id, status) => {
    setUpdating(id);
    try {
      const { school } = await api.updateSchoolStatus(id, status);
      setSchools((prev) => prev.map((s) => s.id === id ? school : s));
    } catch (e) { alert(e.message); }
    finally { setUpdating(null); }
  };

  const pending = schools.filter((s) => s.status === "pending");
  const others  = schools.filter((s) => s.status !== "pending");

  return (
    <div style={{ padding: p, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Admin Panel</h1>
        <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
          {schools.length} school{schools.length !== 1 ? "s" : ""} · {pending.length} pending approval
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${c.border}` }}>
        {[["schools", "🏫 Schools"], ["invite", "✉️ Invite School"], ["credits", "💳 Credits"], ["metrics", "📈 Metrics"], ["benchmark", "📊 Benchmark"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 16px", fontSize: 13, background: "transparent", border: "none",
              borderBottom: tab === id ? `2px solid ${c.accent}` : "2px solid transparent",
              color: tab === id ? c.accent : c.textMid, fontWeight: tab === id ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "invite"    && <InvitePanel    isMobile={isMobile} />}
      {tab === "credits"   && <CreditsPanel   isMobile={isMobile} />}
      {tab === "metrics"   && <MetricsPanel   isMobile={isMobile} />}
      {tab === "benchmark" && <BenchmarkPanel isMobile={isMobile} />}

      {tab === "schools" && (
        <>
          {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}

          {pending.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.warning, marginBottom: 10, letterSpacing: 0.5 }}>
                PENDING APPROVAL ({pending.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {pending.map((s) => (
                  <div key={s.id} style={{ ...card, padding: isMobile ? 14 : 18 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{s.name}</div>
                        {s.contact_email && <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>{s.contact_email}</div>}
                        <div style={{ fontSize: 11, color: c.textDim, marginTop: 3 }}>
                          Registered {new Date(s.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: c.warning, background: `${c.warning}15`, padding: "3px 8px", borderRadius: 6 }}>
                        PENDING
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...btn.primary, flex: 1, fontSize: 13, opacity: updating === s.id ? 0.6 : 1 }}
                        onClick={() => setStatus(s.id, "approved")} disabled={updating === s.id}>
                        ✓ Approve
                      </button>
                      <button style={{ ...btn.ghost, flex: 1, fontSize: 13, color: c.danger, border: `1px solid ${c.danger}30`, opacity: updating === s.id ? 0.6 : 1 }}
                        onClick={() => setStatus(s.id, "rejected")} disabled={updating === s.id}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {others.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>
                ALL SCHOOLS ({others.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {others.map((s) => (
                  <div key={s.id} style={{ ...card, padding: isMobile ? 12 : 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: c.textMid, marginTop: 1 }}>
                        {s.contact_email && <span style={{ marginRight: 10 }}>{s.contact_email}</span>}
                        <span>{new Date(s.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[s.status] || c.textDim, background: `${STATUS_COLOR[s.status] || c.border}15`, padding: "3px 8px", borderRadius: 6 }}>
                        {s.status.toUpperCase()}
                      </span>
                      {s.status !== "pending" && (
                        <button style={{ ...btn.ghost, fontSize: 11, padding: "3px 10px", opacity: updating === s.id ? 0.6 : 1 }}
                          onClick={() => setStatus(s.id, s.status === "approved" ? "rejected" : "approved")}
                          disabled={updating === s.id}>
                          {s.status === "approved" ? "Revoke" : "Approve"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && schools.length === 0 && (
            <div style={{ ...card, textAlign: "center", padding: 40, color: c.textDim, fontSize: 13 }}>
              No schools registered yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
