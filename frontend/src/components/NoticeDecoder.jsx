import { useState } from "react";
import { colors } from "../lib/compliance-data";

const StatCard = ({ label, value, color }) => (
  <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "14px 16px" }}>
    <div style={{ fontSize: 10, color: colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: color || colors.accent, marginTop: 4, lineHeight: 1.3 }}>{value}</div>
  </div>
);

function classifyNotice(text) {
  const t = text.toLowerCase();
  if (t.includes("143(1)") || t.includes("intimation") || t.includes("cpc")) {
    return {
      type: "CPC Intimation u/s 143(1)",
      severity: "Low-Medium",
      severityColor: colors.warn,
      deadline: "30 days from receipt",
      summary: "Automated processing intimation from CPC Bangalore. Differences found between your filed return and CPC-computed values. Common causes: TDS mismatch, unreported income, disallowed deduction.",
      actions: [
        "Compare CPC computation with your filed ITR line by line",
        "Check Form 26AS / AIS for updated TDS credits",
        "If you agree: pay differential if demanded, no further action",
        "If you disagree: file rectification u/s 154 within 30 days on e-filing portal",
        "Keep Form 16, TDS certificates, and investment proofs ready",
      ],
      draftResponse: "Respected Sir/Madam,\n\nRef: Intimation u/s 143(1) for AY 2025-26 (PAN: [PAN])\n\nI respectfully submit that the adjustments require reconsideration. The income and deductions claimed are correct as per:\n\n1. [Specify discrepancy and your position]\n2. [Attach supporting documents]\n\nA rectification u/s 154 is being filed concurrently.\n\nRegards,\n[Name]",
    };
  }
  if (t.includes("drc-01") || t.includes("show cause") || (t.includes("gst") && t.includes("demand"))) {
    return {
      type: "GST Show Cause Notice (DRC-01)",
      severity: "High",
      severityColor: colors.danger,
      deadline: "30 days from notice date (extendable by 30 days on request)",
      summary: "Formal show cause notice under GST law. Department alleges tax short-payment, wrong ITC claim, or classification error. Requires detailed written response with supporting documents.",
      actions: [
        "Note the exact demand amount and period covered",
        "Identify whether demand relates to: output tax, ITC reversal, classification dispute, or penalty",
        "Gather all invoices, returns, and reconciliation data for the disputed period",
        "Prepare a detailed reply addressing each point raised",
        "File reply on GST portal under 'View Additional Notices' within 30 days",
        "Request personal hearing if amount exceeds ₹5 lakhs",
      ],
      draftResponse: "Respected Sir/Madam,\n\nSub: Reply to Show Cause Notice No. [Number] dated [Date] for Tax Period [Period]\n\n1. The notice alleges [brief summary of allegation]\n2. I submit that [your position with supporting facts]\n3. Enclosed documents in support:\n   a. [Document list]\n\nIn view of the above, proceedings may kindly be dropped.\n\nRegards,\n[Name]\n[GSTIN]",
    };
  }
  if (t.includes("asmt-10") || t.includes("scrutiny") || (t.includes("gst") && t.includes("verify"))) {
    return {
      type: "GST Scrutiny Notice (ASMT-10)",
      severity: "Medium",
      severityColor: colors.warn,
      deadline: "30 days from notice date",
      summary: "GST officer flagged discrepancies in your returns and seeks clarification. This is pre-demand — a good response can prevent escalation to DRC-01.",
      actions: [
        "Identify which return period and specific discrepancies are flagged",
        "Cross-check GSTR-1 vs GSTR-3B figures for the relevant period",
        "Verify ITC claimed vs GSTR-2B auto-populated figures",
        "Prepare reconciliation statement with explanations",
        "Reply via ASMT-11 form on GST portal within 30 days",
      ],
      draftResponse: "Respected Sir/Madam,\n\nSub: Reply to Scrutiny Notice ASMT-10 Ref. No. [Number]\n\nDiscrepancies addressed below:\n\n1. [Discrepancy 1]: [Explanation]\n2. [Discrepancy 2]: [Explanation]\n\nReconciliation statements and supporting documents are attached.\n\nRegards,\n[Name]",
    };
  }
  return {
    type: "Unclassified Notice",
    severity: "Review Required",
    severityColor: colors.info,
    deadline: "Check the notice for specific deadline",
    summary: "Could not auto-classify from the text provided. Ensure you've pasted the complete notice including section numbers and issuing authority. Look for section numbers like 143, 148, DRC-01, ASMT-10.",
    actions: [
      "Identify the issuing authority (CPC, jurisdictional officer, GST proper officer)",
      "Find the section/rule number in the notice",
      "Note the response deadline carefully",
      "Consult your CA for complex or high-value notices",
    ],
    draftResponse: "Please paste more complete notice text for a draft response.",
  };
}

export default function NoticeDecoder({ onAgentMessage }) {
  const [noticeText, setNoticeText] = useState("");
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeNotice = () => {
    if (!noticeText.trim()) return;
    setAnalyzing(true);
    setTimeout(() => {
      const classification = classifyNotice(noticeText);
      setResult(classification);
      setAnalyzing(false);
      onAgentMessage(`Notice analyzed: ${classification.type} — Severity: ${classification.severity}. Deadline: ${classification.deadline}. Check the Notice Decoder tab for the full analysis and draft response.`);
    }, 1200);
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 700 }}>Notice Decoder</h2>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "4px 0 16px" }}>
        Paste any GST or Income Tax notice — I'll classify it, extract deadlines, and draft a response
      </p>

      <textarea
        value={noticeText}
        onChange={(e) => { setNoticeText(e.target.value); setResult(null); }}
        placeholder={'Paste the notice text here...\n\nExample: "INTIMATION UNDER SECTION 143(1) OF THE INCOME TAX ACT, 1961\nAssessment Year: 2025-26..."'}
        style={{
          width: "100%", minHeight: 160, padding: 16, borderRadius: 10,
          border: `1px solid ${colors.border}`, background: colors.card,
          color: colors.text, fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
          resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box",
        }}
      />

      <button
        onClick={analyzeNotice}
        disabled={!noticeText.trim() || analyzing}
        style={{
          marginTop: 12, padding: "10px 24px", borderRadius: 8, border: "none",
          background: noticeText.trim() && !analyzing ? colors.accent : colors.border,
          color: noticeText.trim() && !analyzing ? colors.bg : colors.textDim,
          fontSize: 13, fontWeight: 600,
          cursor: noticeText.trim() && !analyzing ? "pointer" : "default",
        }}
      >
        {analyzing ? "Analyzing..." : "Analyze Notice"}
      </button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <StatCard label="Notice Type" value={result.type} color={result.severityColor} />
            <StatCard label="Severity" value={result.severity} color={result.severityColor} />
            <StatCard label="Response Deadline" value={result.deadline} color={colors.warn} />
          </div>

          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, color: colors.text }}>📋 Summary</h3>
            <p style={{ margin: 0, fontSize: 13, color: colors.textMid, lineHeight: 1.7 }}>{result.summary}</p>
          </div>

          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: colors.text }}>✅ Recommended Actions</h3>
            {result.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13, color: colors.textMid, lineHeight: 1.6 }}>
                <span style={{ color: colors.accent, fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                <span>{a}</span>
              </div>
            ))}
          </div>

          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: colors.text }}>📝 Draft Response</h3>
              <button
                onClick={() => navigator.clipboard?.writeText(result.draftResponse)}
                style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${colors.border}`, background: "transparent", color: colors.textMid, fontSize: 11, cursor: "pointer" }}
              >
                Copy
              </button>
            </div>
            <pre style={{
              margin: 0, fontSize: 12, color: colors.textMid, lineHeight: 1.7,
              fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap",
              background: colors.bg, padding: 16, borderRadius: 8,
            }}>
              {result.draftResponse}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
