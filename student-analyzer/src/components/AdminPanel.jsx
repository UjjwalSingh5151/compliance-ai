import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

const STATUS_COLOR = { approved: c.success, pending: c.warning, rejected: c.danger };

export default function AdminPanel({ navigate, isMobile }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: c.text }}>Admin Panel</h1>
        <p style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>
          {schools.length} school{schools.length !== 1 ? "s" : ""} registered · {pending.length} pending approval
        </p>
      </div>

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
    </div>
  );
}
