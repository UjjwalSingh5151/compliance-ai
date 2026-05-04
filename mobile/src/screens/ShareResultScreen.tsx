/**
 * ShareResultScreen — public, no auth required.
 * WhatsApp-optimised parent report card.
 * Opened via deep link: https://app.kelzo.ai/share/{token}
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Linking, Share,
} from "react-native";
import { api } from "../lib/api";
import { c } from "../lib/theme";
import { shareUrl } from "../lib/branding";

export default function ShareResultScreen({ route, navigation }: any) {
  const token: string = route.params?.token || "";
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid share link."); setLoading(false); return; }
    api.getShare(token)
      .then(({ result }) => setResult(result))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} size="large" />
        <Text style={styles.loadingText}>Loading result…</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🔗</Text>
        <Text style={styles.errorTitle}>Link not found</Text>
        <Text style={styles.errorSub}>{error || "This share link may have expired."}</Text>
      </View>
    );
  }

  const analysis = result.analysis || {};
  const student = result.analyzer_students || analysis.student || {};
  const test = result.analyzer_tests || {};
  const pct = result.total_marks > 0
    ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;
  const questions: any[] = analysis.questions || [];
  const improvements: string[] = (analysis.improvement_areas || []).slice(0, 3);
  const strengths: string[] = (analysis.strengths || []).slice(0, 2);
  const wrongQs = questions.filter((q) => (q.marks_awarded ?? 0) < (q.marks_available ?? 1));
  const practiceHint = wrongQs[0]?.concept_tag
    ? `Practice "${wrongQs[0].concept_tag}" — your weakest area this test.`
    : wrongQs[0]?.feedback
    ? wrongQs[0].feedback
    : null;

  const scoreColor = pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger;
  const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : "D";

  // ── WhatsApp share text ────────────────────────────────────────────────────
  const waText = [
    `📝 *${student.name || "Student"}'s Result*`,
    `${test.name || "Test"}${test.subject ? ` — ${test.subject}` : ""}`,
    ``,
    `Score: *${result.marks_obtained}/${result.total_marks} (${pct}% · Grade ${grade})*`,
    analysis.overall_feedback
      ? `\n"${analysis.overall_feedback.slice(0, 120)}${analysis.overall_feedback.length > 120 ? "…" : ""}"`
      : "",
    improvements.length
      ? `\n📌 Needs work on:\n${improvements.map((a) => `• ${a}`).join("\n")}`
      : "",
    practiceHint ? `\n💡 ${practiceHint}` : "",
    `\n🔗 Full report: ${shareUrl(token)}`,
  ].filter(Boolean).join("\n");

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(waText);
    Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() => {
      // WhatsApp not installed — fall back to system share
      Share.share({ message: waText, url: shareUrl(token) });
    });
  };

  const shareNative = () => Share.share({ message: waText, url: shareUrl(token) });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>📝 Kelzo</Text>
        <Text style={styles.shareLabel}>Result Card</Text>
      </View>

      {/* ── Main card ───────────────────────────────────────────────────────── */}
      <View style={styles.mainCard}>
        {/* Score ring + name */}
        <View style={styles.topRow}>
          <View style={[styles.scoreRing, { borderColor: scoreColor, backgroundColor: `${scoreColor}15` }]}>
            <Text style={[styles.scoreNum, { color: scoreColor }]}>{pct}%</Text>
            <Text style={[styles.gradeText, { color: scoreColor }]}>{grade}</Text>
          </View>
          <View style={styles.nameCol}>
            <Text style={styles.studentName}>{student.name || "Student"}</Text>
            {student.roll_no && <Text style={styles.chip}>Roll {student.roll_no}</Text>}
            {(student.class || student.section) && (
              <Text style={styles.chip}>
                {[student.class && `Class ${student.class}`, student.section].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text style={styles.marks}>{result.marks_obtained} / {result.total_marks} marks</Text>
          </View>
        </View>

        {/* Test info */}
        <View style={styles.testRow}>
          <Text style={styles.testName}>{test.name || "Test"}</Text>
          {test.subject && <Text style={styles.testSub}>{test.subject}</Text>}
        </View>

        {/* Overall feedback — 2-line summary */}
        {analysis.overall_feedback && (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackText} numberOfLines={3}>
              {analysis.overall_feedback}
            </Text>
          </View>
        )}
      </View>

      {/* ── Strengths ──────────────────────────────────────────────────────── */}
      {strengths.length > 0 && (
        <View style={[styles.section, { borderColor: `${c.success}30` }]}>
          <Text style={[styles.sectionTitle, { color: c.success }]}>✓ Strengths</Text>
          {strengths.map((s, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: c.success }]}>•</Text>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Top 3 improvement areas ─────────────────────────────���──────────── */}
      {improvements.length > 0 && (
        <View style={[styles.section, { borderColor: `${c.warning}30` }]}>
          <Text style={[styles.sectionTitle, { color: c.warning }]}>📌 Focus areas</Text>
          {improvements.map((a, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: c.warning }]}>{i + 1}.</Text>
              <Text style={styles.bulletText}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Practice recommendation ────────────────────────────────────────── */}
      {practiceHint && (
        <View style={[styles.section, { borderColor: `${c.accent}30`, backgroundColor: `${c.accent}08` }]}>
          <Text style={[styles.sectionTitle, { color: c.accent }]}>💡 Next step</Text>
          <Text style={styles.bulletText}>{practiceHint}</Text>
        </View>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.waBtn} onPress={openWhatsApp} activeOpacity={0.85}>
          <Text style={styles.waBtnText}>📲 Share on WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={shareNative} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>↗ Share</Text>
        </TouchableOpacity>
      </View>

      {/* ── Q-by-Q detail (collapsible) ────────────────────────────────────── */}
      <TouchableOpacity style={styles.detailToggle} onPress={() => setShowDetail((v) => !v)}>
        <Text style={styles.detailToggleText}>
          {showDetail ? "▲ Hide question breakdown" : "▼ Show question breakdown"}
        </Text>
      </TouchableOpacity>

      {showDetail && questions.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>QUESTION BREAKDOWN</Text>
          {questions.map((q: any) => (
            <QuestionCard key={q.no} q={q} />
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function QuestionCard({ q }: { q: any }) {
  const [open, setOpen] = useState(false);
  const full = (q.marks_awarded ?? 0) >= (q.marks_available ?? 0);
  const zero = (q.marks_awarded ?? 0) === 0;
  const color = full ? c.success : zero ? c.danger : c.warning;

  return (
    <TouchableOpacity style={styles.qCard} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
      <View style={styles.qHeader}>
        <Text style={styles.qNum}>Q{q.no}</Text>
        <View style={styles.qMid}>
          <Text style={styles.qPreview} numberOfLines={open ? undefined : 1}>
            {q.feedback || q.question || ""}
          </Text>
          {q.concept_tag && !open && (
            <Text style={styles.qConceptTag}>{q.concept_tag}</Text>
          )}
        </View>
        <Text style={[styles.qMarks, { color }]}>
          {q.marks_awarded ?? "?"}/{q.marks_available ?? "?"}
        </Text>
        <Text style={styles.qChevron}>{open ? "▲" : "▼"}</Text>
      </View>
      {open && (
        <View style={styles.qBody}>
          {q.question && <Field label="QUESTION" value={q.question} />}
          {q.student_answer && <Field label="STUDENT'S ANSWER" value={q.student_answer} />}
          {q.expected_answer && <Field label="EXPECTED ANSWER" value={q.expected_answer} color={c.success} />}
          {q.feedback && <Field label="FEEDBACK" value={q.feedback} />}
          {q.concept_tag && <Field label="CONCEPT" value={q.concept_tag} color={c.accent} />}
          {q.cognitive_level && <Field label="COGNITIVE LEVEL" value={q.cognitive_level} color={c.purple} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: c.bg },
  content:      { paddingBottom: 40 },
  center:       { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText:  { color: c.textMid, marginTop: 12, fontSize: 14 },
  errorEmoji:   { fontSize: 48, marginBottom: 16 },
  errorTitle:   { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8 },
  errorSub:     { fontSize: 14, color: c.textMid, textAlign: "center" },
  // Header
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: c.border },
  logo:         { fontSize: 17, fontWeight: "700", color: c.text },
  shareLabel:   { fontSize: 11, color: c.textDim, fontWeight: "600" },
  // Main card
  mainCard:     { margin: 16, padding: 20, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  topRow:       { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  scoreRing:    { width: 84, height: 84, borderRadius: 42, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  scoreNum:     { fontSize: 22, fontWeight: "800" },
  gradeText:    { fontSize: 13, fontWeight: "700", marginTop: 1 },
  nameCol:      { flex: 1, gap: 3 },
  studentName:  { fontSize: 18, fontWeight: "700", color: c.text },
  chip:         { fontSize: 12, color: c.textMid },
  marks:        { fontSize: 14, fontWeight: "700", color: c.accent, marginTop: 4 },
  testRow:      { paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 2 },
  testName:     { fontSize: 14, fontWeight: "600", color: c.text },
  testSub:      { fontSize: 12, color: c.textDim },
  feedbackBox:  { marginTop: 12, padding: 12, backgroundColor: c.bg, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  feedbackText: { fontSize: 13, color: c.textMid, lineHeight: 20 },
  // Sections
  section:      { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: c.card, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: c.textMid, letterSpacing: 0.5, marginBottom: 8 },
  bullet:       { flexDirection: "row", gap: 8, marginBottom: 5 },
  bulletDot:    { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  bulletText:   { flex: 1, fontSize: 13, color: c.text, lineHeight: 20 },
  // Action buttons
  actionRow:    { flexDirection: "row", gap: 10, margin: 16, marginBottom: 6 },
  waBtn:        { flex: 2, backgroundColor: "#25D366", borderRadius: 12, padding: 14, alignItems: "center" },
  waBtnText:    { fontSize: 14, fontWeight: "700", color: "#fff" },
  shareBtn:     { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: c.border },
  shareBtnText: { fontSize: 14, fontWeight: "600", color: c.accent },
  // Detail toggle
  detailToggle: { alignItems: "center", padding: 14 },
  detailToggleText: { fontSize: 13, color: c.textDim },
  detailSection:{ marginHorizontal: 16 },
  // Q card
  qCard:        { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: "hidden" },
  qHeader:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  qNum:         { fontSize: 13, fontWeight: "700", color: c.textMid, minWidth: 28 },
  qMid:         { flex: 1 },
  qPreview:     { fontSize: 13, color: c.text },
  qConceptTag:  { fontSize: 10, color: c.accent, marginTop: 2 },
  qMarks:       { fontSize: 13, fontWeight: "700" },
  qChevron:     { fontSize: 10, color: c.textDim, marginLeft: 4 },
  qBody:        { padding: 12, paddingTop: 0, gap: 10 },
  fieldRow:     { gap: 4 },
  fieldLabel:   { fontSize: 10, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue:   { fontSize: 13, color: c.text, lineHeight: 20 },
});
