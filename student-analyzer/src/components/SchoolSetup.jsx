import { useState } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { c, card, btn, input } from "../lib/theme";

export default function SchoolSetup({ onDone, isMobile }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const p = isMobile ? 20 : 40;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      await api.registerSchool(name.trim(), email.trim());
      setDone(true);
      // Give the welcome screen a moment, then transition to dashboard
      setTimeout(() => onDone(), 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: p }}>
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>You're all set!</div>
          <div style={{ ...card, padding: 20, textAlign: "left", marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.success, marginBottom: 8 }}>✓ School registered and active</div>
            <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.7 }}>
              You've been given <strong style={{ color: c.accent }}>100 free evaluation credits</strong> to get started.
              Each answer sheet costs 1 credit to grade. Start by uploading your first question paper.
            </div>
          </div>
          <div style={{ fontSize: 12, color: c.textDim, marginTop: 16 }}>Taking you to your dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: p }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 6 }}>Register Your School</div>
          <div style={{ fontSize: 13, color: c.textMid, lineHeight: 1.6 }}>
            One-time setup — your school is approved instantly.{" "}
            <strong style={{ color: c.accent }}>100 free evaluation credits</strong> included.
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
            {loading ? "Setting up…" : "Get Started Free →"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 28, paddingTop: 20, borderTop: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 12, color: c.textDim, marginBottom: 8 }}>Already have an account?</div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ fontSize: 13, color: c.textMid, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" }}>
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
