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

// Group tests by class → subject for the Overview breakdown
function buildClassSubjectBreakdown(tests, allResults) {
  const classMap = {};
  for (const test of tests) {
    const cls = test.class ? `Class ${test.class}` : "Unassigned";
    const sub = test.subject || "General";
    if (!classMap[cls]) classMap[cls] = {};
    if (!classMap[cls][sub]) classMap[cls][sub] = { tests: [], results: [] };
    const tr = allResults.filter((r) => r.test_id === test.id);
    classMap[cls][sub].tests.push(test);
    classMap[cls][sub].results.push(...tr);
  }
  // Sort classes numerically (Class 8, 9, 10…), subjects alphabetically
  return Object.entries(classMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([cls, subjects]) => ({
      class: cls,
      totalTests: Object.values(subjects).reduce((s, d) => s + d.tests.length, 0),
      totalResults: Object.values(subjects).reduce((s, d) => s + d.results.length, 0),
      avgScore: avgScore(Object.values(subjects).flatMap((d) => d.results)),
      subjects: Object.entries(subjects)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sub, data]) => ({
          subject: sub,
          testCount: data.tests.length,
          resultCount: data.results.length,
          avgScore: avgScore(data.results),
          topStrengths: topItems(data.results, "strengths", 3),
          topMistakes: topItems(data.results, "improvement_areas", 3),
        })),
    }));
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
      .select("id, name, subject, class, section, total_marks, created_at, teacher_id, created_by")
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

      // Build creator-id → email map so we can match tests by email fallback
      // (tests created via mobile app never have teacher_id set)
      const creatorIds = [...new Set((tests || []).map((t) => t.created_by).filter(Boolean))];
      const creatorEmailMap = {};
      for (const uid of creatorIds) {
        try {
          const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (u?.email) creatorEmailMap[uid] = u.email.toLowerCase();
        } catch {}
      }

      teacherStats = (teachers || []).map((t) => {
        const teacherEmail = t.email?.toLowerCase();
        const tTests = (tests || []).filter((test) =>
          test.teacher_id === t.id ||
          (teacherEmail && test.created_by && creatorEmailMap[test.created_by] === teacherEmail)
        );
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
      classSubjectBreakdown: buildClassSubjectBreakdown(tests || [], results),
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

    // Tests linked to this teacher via teacher_id OR via creator email (mobile app never sets teacher_id)
    const { data: allTests } = await supabaseAdmin
      .from("analyzer_tests")
      .select("id, name, subject, class, section, total_marks, created_at, teacher_id, created_by")
      .eq("school_id", req.school.id)
      .order("created_at", { ascending: false });

    // Build a set of creator user IDs that match this teacher's email
    const teacherEmail = teacher.email?.toLowerCase();
    const creatorIdsForTeacher = new Set();
    const creatorUids = [...new Set((allTests || []).map((t) => t.created_by).filter(Boolean))];
    for (const uid of creatorUids) {
      try {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.email?.toLowerCase() === teacherEmail) creatorIdsForTeacher.add(uid);
      } catch {}
    }

    const tests = (allTests || []).filter((t) =>
      t.teacher_id === teacher.id || (t.created_by && creatorIdsForTeacher.has(t.created_by))
    );

    const testIds = (tests || []).map((t) => t.id);
    let results = [];
    if (testIds.length) {
      const { data } = await supabaseAdmin
        .from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, analysis, analyzed_at, analyzer_students(id, name, roll_no, class)")
        .in("test_id", testIds);
      results = data || [];
    }

    // Per-student performance with full per-test breakdown
    const studentMap = {};
    for (const r of results) {
      const sName = r.analyzer_students?.name || r.analysis?.student?.name || "Unknown";
      const key = r.analyzer_students?.id || r.analyzer_students?.roll_no || sName;
      if (!studentMap[key]) {
        studentMap[key] = {
          name: sName,
          roll: r.analyzer_students?.roll_no || r.analysis?.student?.roll_no,
          class: r.analyzer_students?.class || r.analysis?.student?.class,
          scores: [],
          testBreakdown: [],
        };
      }
      const scorePct = pct(r.marks_obtained, r.total_marks);
      studentMap[key].scores.push(scorePct);
      const test = (tests || []).find((t) => t.id === r.test_id);
      studentMap[key].testBreakdown.push({
        resultId: r.id,
        testId: r.test_id,
        testName: test?.name || "Unknown test",
        subject: test?.subject,
        marks: r.marks_obtained,
        total: r.total_marks,
        score: scorePct,
        analyzedAt: r.analyzed_at,
      });
    }
    const studentList = Object.values(studentMap)
      .map((s) => ({
        ...s,
        avg: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
        testCount: s.scores.length,
      }))
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
      needsAttention: studentList.length > 5 ? [...studentList].reverse().slice(0, 5) : [],
      allStudents: studentList,
    });
  } catch (err) {
    console.error("Analytics /teacher/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/class/:testId
// Class-level analytics for one test — question heatmap, at-risk students, error areas.
// Teachers access their own test; owners can access any test in their school.
router.get("/class/:testId", requireSchool, async (req, res) => {
  try {
    const { testId } = req.params;
    const { school, user, schoolRole } = req;

    const { data: test, error: tErr } = await supabaseAdmin
      .from("analyzer_tests")
      .select("id, name, subject, class, section, total_marks, leniency, teacher_id, created_by")
      .eq("id", testId).eq("school_id", school.id).single();
    if (tErr || !test) return res.status(404).json({ error: "Test not found" });

    // Teachers can only see their own tests
    if (schoolRole === "teacher" && test.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: results } = await supabaseAdmin
      .from("analyzer_results")
      .select("id, marks_obtained, total_marks, analysis, analyzed_at, analyzer_students(id, name, roll_no, class, section)")
      .eq("test_id", testId)
      .order("analyzed_at", { ascending: false });

    const allResults = results || [];

    // ── Question-level heatmap ────────────────────────────────────────────────
    // For each question number: how many students attempted it and success rate
    const qMap = {};
    for (const r of allResults) {
      const qs = r.analysis?.questions || [];
      for (const q of qs) {
        if (!qMap[q.no]) {
          qMap[q.no] = {
            no: q.no,
            question: q.question || null,
            concept_tag: q.concept_tag || null,
            cognitive_level: q.cognitive_level || null,
            marks_available: q.marks_available || 0,
            totalAwarded: 0, totalPossible: 0, attempts: 0, fullMarks: 0,
          };
        }
        qMap[q.no].totalAwarded += q.marks_awarded || 0;
        qMap[q.no].totalPossible += q.marks_available || 0;
        qMap[q.no].attempts++;
        if ((q.marks_awarded || 0) >= (q.marks_available || 1)) qMap[q.no].fullMarks++;
      }
    }
    const questionHeatmap = Object.values(qMap)
      .sort((a, b) => a.no - b.no)
      .map((q) => ({
        ...q,
        successRate: q.totalPossible > 0 ? Math.round((q.totalAwarded / q.totalPossible) * 100) : 0,
        fullMarksRate: q.attempts > 0 ? Math.round((q.fullMarks / q.attempts) * 100) : 0,
      }));

    // ── Top error areas (concept_tag frequency from wrong questions) ──────────
    const conceptErrors = {};
    for (const r of allResults) {
      for (const q of (r.analysis?.questions || [])) {
        if ((q.marks_awarded || 0) < (q.marks_available || 1) && q.concept_tag) {
          const tag = q.concept_tag.trim();
          if (!conceptErrors[tag]) conceptErrors[tag] = { tag, count: 0, cogLevel: q.cognitive_level || null };
          conceptErrors[tag].count++;
        }
      }
    }
    const topErrorAreas = Object.values(conceptErrors)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── At-risk students (below threshold) ───────────────────────────────────
    const AT_RISK_THRESHOLD = 40; // percent
    const studentPerf = allResults.map((r) => {
      const sp = r.total_marks > 0 ? Math.round((r.marks_obtained / r.total_marks) * 100) : 0;
      const s = r.analyzer_students;
      return {
        resultId: r.id,
        name: s?.name || r.analysis?.student?.name || "Unknown",
        roll: s?.roll_no || r.analysis?.student?.roll_no || null,
        class: s?.class || r.analysis?.student?.class || null,
        score: sp,
        marks: r.marks_obtained,
        total: r.total_marks,
        analyzedAt: r.analyzed_at,
      };
    }).sort((a, b) => a.score - b.score);

    const atRisk = studentPerf.filter((s) => s.score < AT_RISK_THRESHOLD);

    res.json({
      test,
      totalPapers: allResults.length,
      classAvg: avgScore(allResults),
      scoreDistribution: scoreDistribution(allResults),
      questionHeatmap,
      topErrorAreas,
      atRisk,
      atRiskThreshold: AT_RISK_THRESHOLD,
      students: studentPerf,
    });
  } catch (err) {
    console.error("Analytics /class/:testId:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/school-overview
// Owner/principal: all classes side by side — per-test summary for each class
router.get("/school-overview", requireSchool, async (req, res) => {
  try {
    const { school, user, schoolRole } = req;
    const isOwner = schoolRole === "owner" || user.id === ADMIN_USER_ID;
    if (!isOwner) return res.status(403).json({ error: "Owner only" });

    const { data: tests } = await supabaseAdmin
      .from("analyzer_tests")
      .select("id, name, subject, class, section, total_marks, created_at, teacher_id")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });

    const testIds = (tests || []).map((t) => t.id);
    let results = [];
    if (testIds.length) {
      const { data } = await supabaseAdmin
        .from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, analysis")
        .in("test_id", testIds);
      results = data || [];
    }

    // Group by class → subject → tests
    const classMap = {};
    for (const test of tests || []) {
      const cls = test.class || "Unknown Class";
      if (!classMap[cls]) classMap[cls] = { class: cls, subjects: {}, testCount: 0, resultCount: 0, avgScore: null };
      const subj = test.subject || "General";
      if (!classMap[cls].subjects[subj]) classMap[cls].subjects[subj] = { subject: subj, tests: [] };

      const testResults = results.filter((r) => r.test_id === test.id);
      classMap[cls].subjects[subj].tests.push({
        ...test,
        resultCount: testResults.length,
        avgScore: avgScore(testResults),
      });
      classMap[cls].testCount++;
      classMap[cls].resultCount += testResults.length;
    }

    // Calculate overall avg per class
    for (const cls of Object.values(classMap)) {
      const classResults = results.filter((r) => (tests || []).some((t) => t.id === r.test_id && (t.class || "Unknown Class") === cls.class));
      cls.avgScore = avgScore(classResults);
      cls.subjects = Object.values(cls.subjects); // convert to array
    }

    res.json({
      school: { id: school.id, name: school.name },
      classes: Object.values(classMap).sort((a, b) => a.class.localeCompare(b.class)),
    });
  } catch (err) {
    console.error("Analytics /school-overview:", err);
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
