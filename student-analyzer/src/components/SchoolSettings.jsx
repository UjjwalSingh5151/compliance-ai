import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

export default function SchoolSettings({ school, isMobile }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const p = isMobile ? 16 : 28;

  useEffect(() => {
    api.getMembers()
      .then(({ members }) => setMembers(members || []))
      .finally(() => setLoading(false));
  }, []);

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true); setError(null); setSuccess(null);
    try {
      const { member } = await api.inviteMember(email.trim());
      setMembers((prev) => [...prev.filter((m) => m.id !== member.id), member]);
      setEmail("");
      setSuccess(`Invite sent to ${member.invited_email}. They'll get access when they log in.`);
    } catch (e) {
      setError(e.message);
    } finally { setInviting(false); }
  };

  const remove = async (id) => {
    setRemoving(id);
    try {
      await api.removeMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (e) { alert(e.message); }
    finally { setRemoving(null); }
  };

  return (
    <div style={{ padding: p, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>School Settings</h1>
        <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>{school?.name}</p>
      </div>

      {/* Invite teacher */}
      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>
        INVITE TEACHER
      </div>
      <div style={{ ...card, marginBottom: 24 }}>
        <form onSubmit={invite} style={{ display: "flex", gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <input style={{ ...input, flex: 1 }} type="email" placeholder="teacher@school.edu"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" style={{ ...btn.primary, whiteSpace: "nowrap", opacity: inviting ? 0.6 : 1 }}
            disabled={inviting}>
            {inviting ? "Inviting…" : "Send Invite"}
          </button>
        </form>
        {error && <div style={{ fontSize: 12, color: c.danger, marginTop: 8 }}>{error}</div>}
        {success && <div style={{ fontSize: 12, color: c.success, marginTop: 8 }}>{success}</div>}
        <div style={{ fontSize: 11, color: c.textDim, marginTop: 8, lineHeight: 1.5 }}>
          The teacher will get access automatically when they sign in with this email address.
        </div>
      </div>

      {/* Members list */}
      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMid, marginBottom: 10, letterSpacing: 0.5 }}>
        TEACHERS ({members.length})
      </div>
      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map((m) => (
          <div key={m.id} style={{ ...card, padding: isMobile ? 12 : 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: c.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.accent, flexShrink: 0 }}>
              {(m.invited_email || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.invited_email}
              </div>
              <div style={{ fontSize: 11, color: m.status === "accepted" ? c.success : c.warning, marginTop: 1 }}>
                {m.status === "accepted" ? "Active" : "Invite pending"}
              </div>
            </div>
            <button style={{ ...btn.ghost, fontSize: 11, color: c.danger, border: `1px solid ${c.danger}20`, padding: "4px 10px", opacity: removing === m.id ? 0.5 : 1 }}
              onClick={() => remove(m.id)} disabled={removing === m.id}>
              Remove
            </button>
          </div>
        ))}
        {!loading && members.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 28, color: c.textDim, fontSize: 13 }}>
            No teachers added yet.
          </div>
        )}
      </div>
    </div>
  );
}
