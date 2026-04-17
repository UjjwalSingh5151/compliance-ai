import { useState } from "react";
import { colors, COMPLIANCE_ITEMS } from "../lib/compliance-data";

const Pill = ({ color, children }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: `${color}15`,
      color,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

export default function Calendar() {
  const today = new Date("2026-04-17");
  const [filter, setFilter] = useState("all");
  const sections = ["all", "GST", "Income Tax", "MCA", "Labour", "State"];
  const filtered =
    filter === "all" ? COMPLIANCE_ITEMS : COMPLIANCE_ITEMS.filter((c) => c.section === filter);

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 700 }}>
        Compliance Calendar — FY 2026-27
      </h2>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "4px 0 16px" }}>
        {COMPLIANCE_ITEMS.length} deadlines tracked · Auto-updated with regulatory changes
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: `1px solid ${filter === s ? colors.accent : colors.border}`,
              background: filter === s ? colors.accentDim : "transparent",
              color: filter === s ? colors.accent : colors.textMid,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((item, i) => {
          const d = new Date(item.date);
          const daysLeft = Math.ceil((d - today) / 86400000);
          const isUrgent = daysLeft >= 0 && daysLeft <= 7;
          const isPast = daysLeft < 0;
          const urgColor = isPast
            ? colors.danger
            : isUrgent
            ? colors.warn
            : daysLeft <= 30
            ? colors.accent
            : colors.textDim;
          const prioColor =
            item.priority === "critical"
              ? colors.danger
              : item.priority === "high"
              ? colors.warn
              : colors.textMid;

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr auto 80px",
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 8,
                background: isUrgent ? `${colors.warn}08` : colors.card,
                border: `1px solid ${isUrgent ? `${colors.warn}30` : colors.border}`,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: urgColor,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </div>
                <div style={{ fontSize: 11, color: urgColor }}>
                  {isPast ? "OVERDUE" : daysLeft === 0 ? "TODAY" : `${daysLeft}d left`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{item.task}</div>
                <div style={{ fontSize: 11, color: colors.textDim }}>Penalty: {item.penalty}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Pill color={prioColor}>{item.priority}</Pill>
                <Pill color={colors.info}>{item.section}</Pill>
              </div>
              <div style={{ textAlign: "right" }}>
                {daysLeft <= 14 && daysLeft >= 0 ? (
                  <button
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: colors.accent,
                      color: colors.bg,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Prepare
                  </button>
                ) : isPast ? (
                  <button
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: colors.danger,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Urgent
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: colors.textDim }}>Scheduled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
