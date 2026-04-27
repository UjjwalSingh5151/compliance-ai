import { useState } from "react";
import { api } from "../lib/api";
import { c, card, btn } from "../lib/theme";

export default function PracticeTest({ questions, practiceSetId, testName, onBack, onRefresh, isMobile }) {
  const [answers, setAnswers] = useState({}); // { [qNo]: "A" | "B" | "C" | "D" }
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const p = isMobile ? 16 : 28;

  const select = (qNo, option) => {
    if (result) return; // locked after submit
    setAnswers((prev) => ({ ...prev, [qNo]: option }));
  };

  const submit = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const formatted = questions.map((q) => ({ no: q.no, selected: answers[q.no] || null }));
      const res = await api.submitPracticeAttempt(practiceSetId, formatted);
      setResult(res);
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const answered = Object.keys(answers).length;

  return (
    <div style={{ padding: p, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={{ background: "none", border: "none", color: c.textMid, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          onClick={onBack}>
          ← Back to Result
        </button>
        <div style={{ flex: 1 }} />
        {result && (
          <button style={{ ...btn.ghost, fontSize: 12 }} onClick={() => { setAnswers({}); setResult(null); onRefresh(); }}>
            ↻ New Questions
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: c.text }}>Practice Test</div>
        <div style={{ fontSize: 12, color: c.textMid, marginTop: 2 }}>{testName} · {questions.length} questions</div>
      </div>

      {/* Score banner after submit */}
      {result && (
        <div style={{ ...card, marginBottom: 20, textAlign: "center", padding: 24, background: result.score / result.total >= 0.75 ? `${c.success}10` : `${c.warning}10`, border: `1px solid ${result.score / result.total >= 0.75 ? c.success : c.warning}30` }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: result.score / result.total >= 0.75 ? c.success : c.warning }}>
            {result.score}/{result.total}
          </div>
          <div style={{ fontSize: 14, color: c.textMid, marginTop: 4 }}>
            {result.score / result.total >= 0.75 ? "Great job! 🎉" : result.score / result.total >= 0.5 ? "Good effort — review the explanations below." : "Keep practising — read each explanation carefully."}
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {questions.map((q, idx) => {
          const qResult = result?.results?.find((r) => r.no === q.no);
          const selected = answers[q.no];
          return (
            <div key={q.no} style={{ ...card, padding: isMobile ? 14 : 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12, lineHeight: 1.5 }}>
                <span style={{ color: c.textDim, marginRight: 6 }}>Q{idx + 1}.</span>
                {q.question}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.options || []).map((opt) => {
                  const letter = opt.charAt(0);
                  const isSelected = selected === letter;
                  const isCorrect = qResult?.correctAnswer === letter;
                  const isWrong = result && isSelected && !isCorrect;

                  let bg = "transparent";
                  let border = c.border;
                  let textColor = c.textMid;

                  if (!result && isSelected) { bg = c.accentDim; border = c.accent; textColor = c.accent; }
                  if (result && isCorrect) { bg = `${c.success}15`; border = c.success; textColor = c.success; }
                  if (result && isWrong) { bg = `${c.danger}10`; border = c.danger; textColor = c.danger; }

                  return (
                    <div key={letter} onClick={() => select(q.no, letter)}
                      style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: result ? "default" : "pointer", fontSize: 13, color: textColor, lineHeight: 1.4, transition: "all 0.15s" }}>
                      {opt}
                    </div>
                  );
                })}
              </div>
              {/* Explanation after submit */}
              {result && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: qResult?.correct ? c.success : c.danger }}>
                    {qResult?.correct ? "✓ Correct" : `✗ Correct answer: ${qResult?.correctAnswer}`}
                  </span>
                  {q.explanation && (
                    <div style={{ fontSize: 12, color: c.textMid, marginTop: 4, lineHeight: 1.5 }}>{q.explanation}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!result && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{ ...btn.primary, flex: 1, padding: 12, fontSize: 14, opacity: submitting ? 0.6 : 1 }}
            onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : `Submit (${answered}/${questions.length} answered)`}
          </button>
        </div>
      )}
    </div>
  );
}
