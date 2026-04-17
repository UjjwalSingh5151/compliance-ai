import { useState, useEffect, useRef } from "react";
import { colors } from "../lib/compliance-data";

export default function AgentChat({ reconResults, externalMessages }) {
  const [messages, setMessages] = useState([
    {
      role: "agent",
      text: "Namaste! I'm your AI compliance agent powered by Claude. I can help with GST reconciliation, TDS computation, compliance deadlines, and notice responses.\n\nTo get started:\n• Upload data in the 'Reconciliation' tab for instant 2B matching\n• Check 'Calendar' for upcoming deadlines\n• Or just ask me anything about GST, TDS, penalties, or compliance.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEnd = useRef(null);
  const prevExtLen = useRef(0);

  useEffect(() => {
    if (externalMessages.length > prevExtLen.current) {
      const newMsgs = externalMessages.slice(prevExtLen.current);
      setMessages((prev) => [...prev, ...newMsgs.map((t) => ({ role: "agent", text: t }))]);
      prevExtLen.current = externalMessages.length;
    }
  }, [externalMessages]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const buildReconContext = () => {
    if (!reconResults) return null;
    const stats = {
      total: reconResults.length,
      matched: reconResults.filter((r) => r.status === "matched").length,
      mismatch: reconResults.filter((r) => r.status === "mismatch").length,
      missing: reconResults.filter((r) => r.status === "missing").length,
      extraIn2b: reconResults.filter((r) => r.status === "extra_in_2b").length,
      totalITC: reconResults.reduce((a, r) => a + r.itcAmount, 0),
      atRisk: reconResults.reduce((a, r) => a + r.itcAtRisk, 0),
    };
    const details = reconResults
      .filter((r) => r.status !== "matched" && r.status !== "extra_in_2b")
      .map(
        (r) =>
          `- ${r.invoice?.vendor || "Unknown"} (${r.invoice?.gstin || ""}): ${r.status}, ITC ₹${r.itcAtRisk.toLocaleString()}, reason: ${r.reason}`
      )
      .join("\n");
    return `RECONCILIATION DATA (already run):\nTotal: ${stats.total}, Matched: ${stats.matched}, Mismatch: ${stats.mismatch}, Missing from 2B: ${stats.missing}, Extra in 2B: ${stats.extraIn2b}\nTotal ITC: ₹${stats.totalITC.toLocaleString()}, ITC at risk: ₹${stats.atRisk.toLocaleString()}\nProblematic invoices:\n${details}`;
  };

  const handleSend = async () => {
    if (!input.trim() || typing) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setTyping(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || (m.role === "agent" && m !== messages[0]))
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

      const reconContext = buildReconContext();

      const apiBase = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiBase}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history,
          reconContext,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let agentText = "";

      setMessages((prev) => [...prev, { role: "agent", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) {
                agentText += parsed.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "agent", text: agentText };
                  return updated;
                });
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: `Sorry, I encountered an error: ${err.message}. Please check that the backend is running and your API key is set.`,
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const suggestions = reconResults
    ? ["What's my ITC position?", "Which vendors are non-compliant?", "Help with GSTR-3B", "Explain penalties"]
    : ["How do TDS rates work?", "What are GSTR-3B deadlines?", "How to handle a GST notice?", "What penalties apply?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? "#1a5c3a" : colors.card,
              color: colors.text,
              fontSize: 13,
              lineHeight: 1.65,
              border: m.role === "agent" ? `1px solid ${colors.border}` : "none",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.role === "agent" && (
              <span
                style={{
                  fontSize: 10,
                  color: colors.accent,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 3,
                }}
              >
                🤖 ComplianceAI
              </span>
            )}
            {m.text}
            {m.role === "agent" && m.text === "" && (
              <span style={{ color: colors.textDim }}>Thinking…</span>
            )}
          </div>
        ))}
        {typing && messages[messages.length - 1]?.role !== "agent" && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: "14px 14px 14px 4px",
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.textDim,
              fontSize: 13,
            }}
          >
            <span
              style={{ fontSize: 10, color: colors.accent, fontWeight: 600, display: "block", marginBottom: 3 }}
            >
              🤖 ComplianceAI
            </span>
            Thinking…
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <div style={{ padding: "12px 20px", borderTop: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setInput(s)}
              style={{
                padding: "4px 12px",
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                background: "transparent",
                color: colors.textMid,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about GST, TDS, ITC, penalties, notices..."
            disabled={typing}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: colors.text,
              fontSize: 13,
              outline: "none",
              opacity: typing ? 0.6 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={typing || !input.trim()}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: typing || !input.trim() ? colors.border : colors.accent,
              color: typing || !input.trim() ? colors.textDim : colors.bg,
              fontWeight: 600,
              cursor: typing || !input.trim() ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {typing ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
