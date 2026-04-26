import { useState } from "react";
import { colors } from "../lib/compliance-data";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) setError(error.message);
      else setSuccess("Account created! Check your email to confirm, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: `1px solid ${colors.border}`, background: colors.bg,
    color: colors.text, fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ height: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 360, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.accent }}>ComplianceAI</div>
          <div style={{ fontSize: 12, color: colors.textDim, marginTop: 4 }}>GST · TDS · ITR</div>
        </div>

        <div style={{ display: "flex", background: colors.bg, borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {["login", "signup"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 6, border: "none",
                background: mode === m ? colors.card : "transparent",
                color: mode === m ? colors.text : colors.textDim,
                fontSize: 13, fontWeight: mode === m ? 600 : 400, cursor: "pointer",
                boxShadow: mode === m ? `0 1px 3px rgba(0,0,0,0.3)` : "none",
              }}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input style={inputStyle} placeholder="Your name" value={name}
              onChange={(e) => setName(e.target.value)} required />
          )}
          <input style={inputStyle} type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input style={inputStyle} type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          {error && <div style={{ fontSize: 12, color: colors.danger, padding: "8px 12px", background: `${colors.danger}15`, borderRadius: 6 }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: colors.accent, padding: "8px 12px", background: `${colors.accent}15`, borderRadius: 6 }}>{success}</div>}

          <button type="submit" disabled={loading}
            style={{
              padding: "11px", borderRadius: 8, border: "none",
              background: loading ? colors.border : colors.accent,
              color: loading ? colors.textDim : colors.bg,
              fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 11, color: colors.textDim, textAlign: "center", lineHeight: 1.6 }}>
          Your data is private and only visible to you.
        </div>
      </div>
    </div>
  );
}
