import { useState } from "react";
import { api } from "../lib/api";
import { c, card, btn, input } from "../lib/theme";

export default function SchoolSetup({ onDone, isMobile }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const p = isMobile ? 20 : 40;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      await api.registerSchool(name.trim(), email.trim());
      onDone();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: p }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 6 }}>Register Your School</div>
          <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.6 }}>
            Once registered, your school will be reviewed and approved by the platform admin.
            You'll get access within 24 hours.
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>SCHOOL NAME *</label>
            <input style={input} placeholder="e.g. Delhi Public School, Rohini" value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>

          <div style={card}>
            <label style={{ fontSize: 12, fontWeight: 600, color: c.textMid, display: "block", marginBottom: 6 }}>
              CONTACT EMAIL <span style={{ color: c.textDim, fontWeight: 400 }}>(optional)</span>
            </label>
            <input style={input} type="email" placeholder="principal@school.edu" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: c.danger, background: c.dangerDim, padding: "10px 14px", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" style={{ ...btn.primary, padding: 12, opacity: loading ? 0.6 : 1 }}
            disabled={loading || !name.trim()}>
            {loading ? "Registering…" : "Register School →"}
          </button>
        </form>
      </div>
    </div>
  );
}
