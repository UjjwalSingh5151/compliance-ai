import { Router } from "express";
import { supabaseAdmin, client, requireSchool, ADMIN_USER_ID } from "../lib/shared.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Count frequency of text items across all results for a given JSONB array field
function topItems(results, field, limit = 8) {
  const freq = {};
  for (const r of results) {
    for (const item of (r.analysis?.[field] || [])) {
      const key = item.toLowerCase().trim();
      if (!freq[key]) freq[key] = { text: item, count: 0 };
      freq[key].count++;
    }
  }
  return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, limit);
}

function pct(obtained, total) {
  if (!total) return 0;
  return Math.round((obtained / total) * 100);
}

function avgScore(results) {
  if (!results.length) return null;
  return Math.round(results.reduce((s, r) => s + pct(r.marks_obtained, r.total_marks), 0) / results.length);
}

function scoreDistribution(results) {
  return [
    { label: "0–40%",   count: results.filter((r) => pct(r.marks_obtained, r.total_marks) < 40).length },
    { label: "40–60%",  count: results.filter((r) => { const p = pct(r.marks_obtained, r.total_marks); return p >= 40 && p < 60; }).length },
    { label: "60–80%",  count: results.filter((r) => { const p = pct(r.marks_obtained, r.total_marks); return p >= 60 && p < 80; }).length },
    { label: "80–100%", count: results.filter((r) => pct(r.marks_obtained, r.total_marks) >= 80).length },
  ];
}

function buildTestStats(tests, allResults) {
  return tests.map((test) => {
    const tr = allResults.filter((r) => r.test_id === test.id);
    return {
      ...test,
      resultCount: tr.length,
      avgScore: avgScore(tr),
      scoreDistribution: scoreDistribution(tr),
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/analytics/me
// Teacher → their tests + aggregated student performance
// Owner  → school-wide stats + per-teacher breakdown
router.get("/me", requireSchool, async (req, res) => {
  try {
    const { school, user, schoolRole } = req;
    const isOwner = schoolRole === "owner" || user.id === ADMIN_USER_ID;

    // 1. Tests
    let testQuery = supabaseAdmin
      .from("analyzer_tests")
      .select("id, name, subject, class, section, total_marks, created_at, teacher_id")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    if (!isOwner) testQuery = testQuery.eq("created_by", user.id);
    const { data: tests } = await testQuery;

    const testIds = (tests || []).map((t) => t.id);

    // 2. Results for those tests
    let results = [];
    if (testIds.length) {
      const { data } = await supabaseAdmin
        .from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, analysis, analyzed_at")
        .in("test_id", testIds);
      results = data || [];
    }

    // 3. Per-teacher breakdown (owner only)
    let teacherStats = null;
    if (isOwner) {
      const { data: teachers } = await supabaseAdmin
        .from("school_teachers")
        .select("id, name, email, subjects, classes")
        .eq("school_id", school.id)
        .order("name");

      teacherStats = (teachers || []).map((t) => {
        const tTests = (tests || []).filter((test) => test.teacher_id === t.id);
        const tResults = results.filter((r) => tTests.some((tt) => tt.id === r.test_id));
        return {
          id: t.id, name: t.name, email: t.email,
          subjects: t.subjects, classes: t.classes,
          testCount: tTests.length,
          resultCount: tResults.length,
          avgScore: avgScore(tResults),
        };
      });
    }

    res.json({
      role: schoolRole,
      totalTests: tests?.length || 0,
      totalResults: results.length,
      avgScore: avgScore(results),
      testStats: buildTestStats(tests || [], results),
      topStrengths: topItems(results, "strengths"),
      topMistakes: topItems(results, "improvement_areas"),
      teacherStats,
    });
  } catch (err) {
    console.error("Analytics /me:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/teacher/:teacherId
// Owner drills into a specific teacher's performance
router.get("/teacher/:teacherId", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner" && req.user.id !== ADMIN_USER_ID) {
      return res.status(403).json({ error: "Owner only" });
    }

    const { data: teacher, error: tErr } = await supabaseAdmin
      .from("school_teachers").select("*")
      .eq("id", req.params.teacherId).eq("school_id", req.school.id).single();
    if (tErr || !teacher) return res.status(404).json({ error: "Teacher not found" });

    // Tests linked to this teacher via teacher_id
    const { data: tests } = await supabaseAdmin
      .from("analyzer_tests")
      .select("id, name, subject, class, section, total_marks, created_at")
      .eq("school_id", req.school.id)
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: false });

    const testIds = (tests || []).map((t) => t.id);
    let results = [];
    if (testIds.length) {
      const { data } = await supabaseAdmin
        .from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, analysis, analyzed_at, analyzer_students(name, roll_no, class)")
        .in("test_id", testIds);
      results = data || [];
    }

    // Per-student performance
    const studentMap = {};
    for (const r of results) {
      const name = r.analyzer_students?.name || "Unknown";
      const key = r.analyzer_students?.roll_no || name;
      if (!studentMap[key]) studentMap[key] = { name, roll: r.analyzer_students?.roll_no, scores: [] };
      studentMap[key].scores.push(pct(r.marks_obtained, r.total_marks));
    }
    const studentList = Object.values(studentMap)
      .map((s) => ({ ...s, avg: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) }))
      .sort((a, b) => b.avg - a.avg);

    res.json({
      teacher,
      totalTests: tests?.length || 0,
      totalResults: results.length,
      avgScore: avgScore(results),
      scoreDistribution: scoreDistribution(results),
      testStats: buildTestStats(tests || [], results),
      topStrengths: topItems(results, "strengths"),
      topMistakes: topItems(results, "improvement_areas"),
      topStudents: studentList.slice(0, 5),
      needsAttention: [...studentList].reverse().slice(0, 5),
    });
  } catch (err) {
    console.error("Analytics /teacher/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analytics/plan
// Generate a customized teaching or revision plan using Claude
router.post("/plan", requireSchool, async (req, res) => {
  try {
    const { type = "teaching", subject = "General", avgScore: avg, mistakes = [], strengths = [] } = req.body;

    const mistakeList = mistakes.slice(0, 6).map((m) => `• ${m.text} (mentioned ${m.count}x)`).join("\n");
    const strengthList = strengths.slice(0, 6).map((s) => `• ${s.text} (mentioned ${s.count}x)`).join("\n");

    const prompt = `You are an expert educational consultant helping a school teacher in India.

Create a practical, structured ${type === "revision" ? "REVISION" : "TEACHING"} plan for the following context:

Subject: ${subject}
Average class score: ${avg !== null && avg !== undefined ? `${avg}%` : "Not available"}

Most common student mistakes:
${mistakeList || "• No data available"}

Student strengths:
${strengthList || "• No data available"}

Generate a ${type === "revision" ? "2-week revision" : "4-week teaching"} plan in clean markdown. Include:
1. **Priority focus areas** — based on the mistakes data
2. **Week-by-week breakdown** — specific topics and activities each week
3. **Teaching strategies** — methods best suited to address the identified gaps
4. **Quick assessment ideas** — simple checks to measure improvement
5. **Tips for students doing well** — to extend their learning

Keep it concise, actionable, and appropriate for an Indian school context. Max 700 words.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ plan: response.content[0]?.text || "" });
  } catch (err) {
    console.error("Analytics /plan:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
