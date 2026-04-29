import { Router } from "express";
import { supabaseAdmin, client, getRequestUser } from "../lib/shared.js";

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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
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
    const wrongQs = (analysis.questions || []).filter(q => q.marks_awarded < q.marks_available);
    const prompt = `You are creating 8 multiple choice practice questions for a student based on their exam mistakes.

Subject: ${result.analyzer_tests?.subject || "General"}
Weak areas: ${(analysis.improvement_areas || []).join(", ")}
Questions they got wrong:
${wrongQs.map(q => `Q${q.no}: Student wrote "${q.student_answer || ""}", correct was "${q.expected_answer || ""}"`).join("\n")}

Generate exactly 8 MCQ questions targeting these specific weak concepts.
Respond ONLY with valid JSON:
{
  "questions": [
    {
      "no": 1,
      "question": "Clear question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A",
      "explanation": "Why this is correct in 1-2 sentences"
    }
  ]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
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
