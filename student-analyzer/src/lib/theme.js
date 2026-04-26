export const c = {
  bg:        "#0d1117",
  card:      "#161b22",
  cardHover: "#1c2330",
  border:    "#30363d",
  text:      "#e6edf3",
  textMid:   "#8b949e",
  textDim:   "#484f58",
  accent:    "#4f8ef7",
  accentDim: "rgba(79,142,247,0.12)",
  success:   "#3fb950",
  successDim:"rgba(63,185,80,0.12)",
  warning:   "#d29922",
  warningDim:"rgba(210,153,34,0.12)",
  danger:    "#f85149",
  dangerDim: "rgba(248,81,73,0.12)",
  purple:    "#a371f7",
  purpleDim: "rgba(163,113,247,0.12)",
};

export const btn = {
  primary: {
    background: c.accent, color: "#fff", border: "none",
    padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  secondary: {
    background: "transparent", color: c.textMid, border: `1px solid ${c.border}`,
    padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
  ghost: {
    background: "transparent", color: c.textMid, border: "none",
    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  },
};

export const card = {
  background: c.card,
  border: `1px solid ${c.border}`,
  borderRadius: 12,
  padding: 20,
};

export const input = {
  width: "100%", padding: "9px 12px",
  background: c.bg, border: `1px solid ${c.border}`,
  borderRadius: 8, color: c.text, fontSize: 13,
  outline: "none", fontFamily: "inherit",
};
