import { useState } from "react";
import { supabase } from "../lib/supabase";
import { c, btn, input } from "../lib/theme";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) {
        if (error.message?.toLowerCase().includes("rate limit") || error.status === 429) {
          setError("Too many sign-up attempts. Please wait a few minutes and try again, or contact your admin to be invited directly.");
        } else {
          setError(error.message);
        }
      } else setSuccess("Account created! Check your email to confirm, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg }}>
      <div style={{ width: 360, background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.text }}>Kelzo</div>
          <div style={{ fontSize: 12, color: c.textDim, marginTop: 3 }}>AI Answer Sheet Analyzer</div>
        </div>

        <div style={{ display: "flex", background: c.bg, borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {["login", "signup"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", fontFamily: "inherit",
                background: mode === m ? c.card : "transparent",
                color: mode === m ? c.text : c.textDim,
                fontSize: 13, fontWeight: mode === m ? 600 : 400, cursor: "pointer",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
              }}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input style={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          {error && <div style={{ fontSize: 12, color: c.danger, background: c.dangerDim, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: c.success, background: c.successDim, padding: "8px 12px", borderRadius: 6 }}>{success}</div>}

          <button type="submit" disabled={loading}
            style={{ ...btn.primary, width: "100%", padding: 11, marginTop: 4, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
