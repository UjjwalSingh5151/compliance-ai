import { Router } from "express";
import { supabaseAdmin, client, getRequestUser } from "../lib/shared.js";
import { traceStudentGen } from "../lib/langfuse.js";

const router = Router();

async function getStudentByEmail(email) {
  if (!supabaseAdmin || !email) return null;
  const { data } = await supabaseAdmin
    .from("analyzer_students").select("*, schools(name, status)")
    .eq("email", email.toLowerCase()).maybeSingle();
  return data || null;
}

router.get("/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(404).json({ error: "not_a_student" });
    res.json({ student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/results", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("id, marks_obtained, total_marks, analyzed_at, share_token, revision_notes, analyzer_tests(name, subject)")
      .eq("student_id", student.id).order("analyzed_at", { ascending: false });
    if (error) throw error;
    res.json({ student, results: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/results/:id", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks), analyzer_students(name, roll_no, class, section)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (error) throw error;
    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").select("id, questions, created_at")
      .eq("result_id", req.params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    res.json({ result: data, practiceSet: practiceSet || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/results/:id/revision-notes", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data: result } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject), analyzer_students(name)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (!result) return res.status(404).json({ error: "Result not found" });
    if (result.revision_notes) return res.json({ notes: result.revision_notes });

    const analysis = result.analysis || {};
    const prompt = `You are a helpful tutor creating personalized revision notes for a student.

Student: ${result.analyzer_students?.name || "Student"}
Test: ${result.analyzer_tests?.name || "Test"} (${result.analyzer_tests?.subject || ""})
Score: ${result.marks_obtained}/${result.total_marks}

Weak areas: ${(analysis.improvement_areas || []).join(", ")}

Question mistakes:
${(analysis.questions || []).filter(q => q.marks_awarded < q.marks_available)
  .map(q => `Q${q.no}: Got ${q.marks_awarded}/${q.marks_available}. ${q.reasoning || q.feedback || ""}`).join("\n")}

Create concise revision notes that:
1. Explain each concept they got wrong with a clear example
2. Give 2-3 memory tips per weak area
3. End with an encouraging summary

Write directly to the student using "you". Use clear headings. Be specific, not generic.`;

    const { response } = await traceStudentGen({
      type:      "revision-notes",
      resultId:  req.params.id,
      studentId: student.id,
      model:     "claude-sonnet-4-6",
      prompt,
      call: () => client.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const notes = response.content[0].text;
    await supabaseAdmin.from("analyzer_results").update({ revision_notes: notes }).eq("id", req.params.id);
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/results/:id/practice-questions", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data: result } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, question_paper_content), analyzer_students(name)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (!result) return res.status(404).json({ error: "Result not found" });

    const { refresh } = req.body;
    if (!refresh) {
      const { data: existing } = await supabaseAdmin
        .from("practice_sets").select("id, questions")
        .eq("result_id", req.params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return res.json({ practiceSetId: existing.id, questions: existing.questions });
    }

    const analysis = result.analysis || {};
    const subject = result.analyzer_tests?.subject || "General";
    const wrongQs = (analysis.questions || []).filter(q => q.marks_awarded < q.marks_available);

    // Build personalised concept list — from this result + historical recurring mistakes
    const thisConceptTags = wrongQs
      .filter(q => q.concept_tag)
      .map(q => q.concept_tag);

    // Fetch student's last 5 results in the same subject to find recurring weak concepts
    const { data: histResults } = await supabaseAdmin
      .from("analyzer_results")
      .select("analysis, analyzer_tests(subject)")
      .eq("student_id", student.id)
      .neq("id", req.params.id)
      .order("analyzed_at", { ascending: false })
      .limit(10);

    const historicConceptFreq = {};
    for (const r of histResults || []) {
      if (r.analyzer_tests?.subject !== subject) continue;
      for (const q of (r.analysis?.questions || [])) {
        if (q.marks_awarded < q.marks_available && q.concept_tag) {
          const tag = q.concept_tag.trim();
          historicConceptFreq[tag] = (historicConceptFreq[tag] || 0) + 1;
        }
      }
    }
    const recurringConcepts = Object.entries(historicConceptFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    // Merge: prioritise recurring concepts, then this-result concepts
    const priorityConcepts = [...new Set([...recurringConcepts, ...thisConceptTags])].slice(0, 5);
    const cogLevels = [...new Set(wrongQs.filter(q => q.cognitive_level).map(q => q.cognitive_level))];

    const conceptContext = priorityConcepts.length > 0
      ? `\nPriority concepts to target (student has struggled with these repeatedly):\n${priorityConcepts.map((c, i) => `  ${i + 1}. "${c}"${recurringConcepts.includes(c) ? " ← recurring across multiple tests" : ""}`).join("\n")}\n`
      : "";
    const cogContext = cogLevels.length > 0
      ? `\nStudent's weak cognitive levels: ${cogLevels.join(", ")} — bias questions toward these.\n`
      : "";

    const prompt = `You are creating 8 multiple choice practice questions for a student based on their exam mistakes.

Subject: ${subject}
Weak areas: ${(analysis.improvement_areas || []).join(", ")}
${conceptContext}${cogContext}
Questions they got wrong in this test:
${wrongQs.map(q => `Q${q.no}${q.concept_tag ? ` [${q.concept_tag}]` : ""}: Student wrote "${q.student_answer || ""}", correct was "${q.expected_answer || ""}"`).join("\n")}

Generate exactly 8 MCQ questions. Each question MUST target one of the priority concepts above (or a weak concept if no priority list). Vary difficulty — include some recall, some application, and some analysis questions. Make questions specific and educational, not generic.
Respond ONLY with valid JSON:
{
  "questions": [
    {
      "no": 1,
      "question": "Clear question text targeting a specific weak concept",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A",
      "concept_tag": "same concept as targeted",
      "cognitive_level": "recall|application|analysis",
      "explanation": "Why this is correct in 1-2 sentences"
    }
  ]
}`;

    const { response } = await traceStudentGen({
      type:      "practice-questions",
      resultId:  req.params.id,
      studentId: student.id,
      model:     "claude-sonnet-4-6",
      prompt,
      call: () => client.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    let questions;
    try {
      const match = response.content[0].text.match(/\{[\s\S]*\}/);
      questions = JSON.parse(match ? match[0] : response.content[0].text).questions;
    } catch { return res.status(500).json({ error: "Failed to parse questions" }); }

    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").insert({ result_id: req.params.id, student_id: student.id, questions }).select("id").single();
    res.json({ practiceSetId: practiceSet.id, questions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/student/fingerprint — learning profile: recurring weak concepts, cognitive level breakdown, subject trends
router.get("/fingerprint", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });

    const { data: results } = await supabaseAdmin
      .from("analyzer_results")
      .select("marks_obtained, total_marks, analyzed_at, analysis, analyzer_tests(subject)")
      .eq("student_id", student.id)
      .order("analyzed_at", { ascending: true }); // ascending for trend calculation

    if (!results?.length) return res.json({ fingerprint: null });

    // ── Recurring weak concept tags ───────────────────────────────────────────
    const conceptFreq = {};
    const cogLevelFreq = { recall: 0, application: 0, analysis: 0 };
    let totalWrongQ = 0;

    for (const r of results) {
      for (const q of (r.analysis?.questions || [])) {
        if ((q.marks_awarded || 0) < (q.marks_available || 1)) {
          totalWrongQ++;
          if (q.concept_tag) {
            const tag = q.concept_tag.trim();
            conceptFreq[tag] = (conceptFreq[tag] || 0) + 1;
          }
          if (q.cognitive_level && cogLevelFreq.hasOwnProperty(q.cognitive_level)) {
            cogLevelFreq[q.cognitive_level]++;
          }
        }
      }
    }

    const weakConcepts = Object.entries(conceptFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));

    const cogBreakdown = {
      recall:      totalWrongQ > 0 ? Math.round((cogLevelFreq.recall / totalWrongQ) * 100) : 0,
      application: totalWrongQ > 0 ? Math.round((cogLevelFreq.application / totalWrongQ) * 100) : 0,
      analysis:    totalWrongQ > 0 ? Math.round((cogLevelFreq.analysis / totalWrongQ) * 100) : 0,
    };

    // ── Per-subject trend (last 3 results direction) ──────────────────────────
    const subjectResults = {};
    for (const r of results) {
      const subj = r.analyzer_tests?.subject?.trim() || "General";
      if (!subjectResults[subj]) subjectResults[subj] = [];
      const sp = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
      subjectResults[subj].push({ score: sp, date: r.analyzed_at });
    }

    const subjectTrends = Object.entries(subjectResults).map(([subject, rs]) => {
      const last3 = rs.slice(-3);
      let trend = "stable";
      if (last3.length >= 2) {
        const first = last3[0].score;
        const last = last3[last3.length - 1].score;
        if (last - first >= 8) trend = "improving";
        else if (first - last >= 8) trend = "declining";
      }
      const avg = Math.round(last3.reduce((s, r) => s + r.score, 0) / last3.length);
      return { subject, trend, avg, testCount: rs.length, scores: last3.map((r) => r.score) };
    }).sort((a, b) => b.testCount - a.testCount);

    res.json({
      fingerprint: {
        weakConcepts,
        cogBreakdown,
        subjectTrends,
        totalResultsAnalyzed: results.length,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/practice/:id/attempt", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    const { answers } = req.body;
    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").select("questions").eq("id", req.params.id).single();
    if (!practiceSet) return res.status(404).json({ error: "Not found" });
    const questions = practiceSet.questions;
    let score = 0;
    const results = questions.map(q => {
      const answer = (answers || []).find(a => a.no === q.no);
      const correct = answer?.selected === q.correct;
      if (correct) score++;
      return { no: q.no, selected: answer?.selected || null, correct, correctAnswer: q.correct, explanation: q.explanation };
    });
    await supabaseAdmin.from("practice_attempts").insert({
      practice_set_id: req.params.id, student_user_id: user?.id || null,
      answers, score, total: questions.length, completed_at: new Date().toISOString(),
    });
    res.json({ score, total: questions.length, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
