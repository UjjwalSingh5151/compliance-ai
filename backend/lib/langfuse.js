/**
 * Langfuse AI observability client.
 * Gracefully degrades to no-ops when LANGFUSE_PUBLIC_KEY is not set,
 * so local dev and staging work without credentials.
 *
 * Usage:
 *   import { lf, startGradingTrace } from "./langfuse.js";
 */

let Langfuse;
try {
  ({ Langfuse } = await import("langfuse"));
} catch {
  Langfuse = null;
}

const enabled =
  !!Langfuse &&
  !!process.env.LANGFUSE_PUBLIC_KEY &&
  !!process.env.LANGFUSE_SECRET_KEY;

export const lf = enabled
  ? new Langfuse({
      publicKey:  process.env.LANGFUSE_PUBLIC_KEY,
      secretKey:  process.env.LANGFUSE_SECRET_KEY,
      baseUrl:    process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
      // Flush immediately in serverless — Render spins down after requests
      flushAt:    1,
      flushInterval: 0,
    })
  : null;

if (lf) {
  console.log("[langfuse] observability enabled");
} else {
  console.log("[langfuse] disabled (no credentials) — set LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY to enable");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wrap a grading Claude call with a Langfuse trace + generation span.
 *
 * @param {object} opts
 * @param {string}   opts.testId
 * @param {string}   opts.schoolId
 * @param {string}   opts.fileName
 * @param {string}   opts.model
 * @param {string}   opts.prompt      — full user prompt text
 * @param {Function} opts.call        — async () => anthropic response
 * @returns {Promise<{ response, traceId }>}
 */
export async function traceGrading({ testId, schoolId, fileName, model, prompt, call }) {
  if (!lf) {
    const response = await call();
    return { response, traceId: null };
  }

  const trace = lf.trace({
    name:     "grade-answer-sheet",
    metadata: { testId, schoolId, fileName },
    tags:     ["grading", model],
  });

  const generation = trace.generation({
    name:            "claude-grading",
    model,
    input:           [{ role: "user", content: prompt }],
    modelParameters: { max_tokens: 8000 },
  });

  let response;
  try {
    response = await call();
  } catch (err) {
    generation.end({ level: "ERROR", statusMessage: err.message });
    await lf.flushAsync();
    throw err;
  }

  generation.end({
    output: response.content[0]?.text || "",
    usage: {
      input:  response.usage?.input_tokens,
      output: response.usage?.output_tokens,
    },
  });

  await lf.flushAsync();
  return { response, traceId: trace.id };
}

/**
 * Wrap a notes or practice generation call.
 *
 * @param {object} opts
 * @param {"revision-notes"|"practice-questions"} opts.type
 * @param {string}   opts.resultId
 * @param {string}   opts.studentId
 * @param {string}   opts.model
 * @param {string}   opts.prompt
 * @param {Function} opts.call
 * @returns {Promise<{ response, traceId }>}
 */
export async function traceStudentGen({ type, resultId, studentId, model, prompt, call }) {
  if (!lf) {
    const response = await call();
    return { response, traceId: null };
  }

  const trace = lf.trace({
    name:     `student-${type}`,
    metadata: { resultId, studentId },
    tags:     [type, model],
  });

  const generation = trace.generation({
    name:            `claude-${type}`,
    model,
    input:           [{ role: "user", content: prompt }],
    modelParameters: { max_tokens: type === "revision-notes" ? 2000 : 3000 },
  });

  let response;
  try {
    response = await call();
  } catch (err) {
    generation.end({ level: "ERROR", statusMessage: err.message });
    await lf.flushAsync();
    throw err;
  }

  generation.end({
    output: response.content[0]?.text || "",
    usage: {
      input:  response.usage?.input_tokens,
      output: response.usage?.output_tokens,
    },
  });

  await lf.flushAsync();
  return { response, traceId: trace.id };
}

/**
 * Score a completed trace after analysis is parsed.
 * Call this AFTER traceGrading to record quality signals.
 *
 * @param {string}  traceId
 * @param {object}  analysis   — the parsed analysis object (or null on parse failure)
 * @param {number}  totalMarks — expected total marks from the test
 */
export async function scoreGrading(traceId, analysis, totalMarks) {
  if (!lf || !traceId) return;

  const parseOk = !!(analysis && !analysis.parse_error);

  lf.score({
    traceId,
    name:  "parse_success",
    value: parseOk ? 1 : 0,
    comment: parseOk ? "JSON parsed cleanly" : "parse_error or null",
  });

  if (parseOk && analysis.marks_obtained != null && totalMarks > 0) {
    const marksMatch =
      Math.abs((analysis.marks_obtained || 0) -
        (analysis.questions || []).reduce((s, q) => s + (q.marks_awarded || 0), 0)) <= 1;

    lf.score({
      traceId,
      name:  "marks_sum_consistent",
      value: marksMatch ? 1 : 0,
      comment: marksMatch
        ? "marks_obtained matches sum of marks_awarded"
        : "marks_obtained does not match question sum",
    });
  }

  await lf.flushAsync();
}
