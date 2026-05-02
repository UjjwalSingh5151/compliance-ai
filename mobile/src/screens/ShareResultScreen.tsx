/**
 * ShareResultScreen — public, no auth required.
 * Opened via deep link: https://app.kelzo.ai/share/{token}
 * Shows a read-only view of a student's result.
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { api } from "../lib/api";
import { c } from "../lib/theme";

export default function ShareResultScreen({ route, navigation }: any) {
  const token: string = route.params?.token || "";
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>📝 EduGrade</Text>
        <Text style={styles.shareLabel}>Shared Result</Text>
      </View>

      {/* Score card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRing}>
          <Text style={[styles.scoreNum, { color: pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger }]}>
            {pct}%
          </Text>
        </View>
        <View style={styles.scoreRight}>
          <Text style={styles.studentName}>{student.name || "Student"}</Text>
          {student.roll_no && <Text style={styles.chip}>Roll {student.roll_no}</Text>}
          {(student.class || student.section) && (
            <Text style={styles.chip}>
              {[student.class && `Class ${student.class}`, student.section].filter(Boolean).join(" · ")}
            </Text>
          )}
          <Text style={styles.marks}>{result.marks_obtained} / {result.total_marks} marks</Text>
          <Text style={styles.testName}>{test.name}{test.subject ? ` · ${test.subject}` : ""}</Text>
        </View>
      </View>

      {/* Overall feedback */}
      {analysis.overall_feedback && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Feedback</Text>
          <Text style={styles.feedbackText}>{analysis.overall_feedback}</Text>
        </View>
      )}

      {/* Strengths */}
      {(analysis.strengths || []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✓ Strengths</Text>
          {analysis.strengths.map((s: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: c.success }]}>•</Text>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Improvements */}
      {(analysis.improvement_areas || []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>→ Areas to Improve</Text>
          {analysis.improvement_areas.map((a: string, i: number) => (
            <View key={i} style={styles.bullet}>
              <Text style={[styles.bulletDot, { color: c.warning }]}>•</Text>
              <Text style={styles.bulletText}>{a}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Q-by-Q */}
      {questions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Question Breakdown</Text>
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
        <Text style={styles.qPreview} numberOfLines={open ? undefined : 1}>
          {q.feedback || q.question || ""}
        </Text>
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
  logo:         { fontSize: 18, fontWeight: "700", color: c.text },
  shareLabel:   { fontSize: 12, color: c.textDim, fontWeight: "600" },
  // Score card
  scoreCard:    { flexDirection: "row", alignItems: "center", gap: 16, margin: 16, padding: 20, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  scoreRing:    { width: 80, height: 80, borderRadius: 40, backgroundColor: c.bg, borderWidth: 3, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  scoreNum:     { fontSize: 22, fontWeight: "800" },
  scoreRight:   { flex: 1, gap: 3 },
  studentName:  { fontSize: 17, fontWeight: "700", color: c.text },
  chip:         { fontSize: 12, color: c.textMid },
  marks:        { fontSize: 14, fontWeight: "700", color: c.accent, marginTop: 4 },
  testName:     { fontSize: 12, color: c.textDim },
  // Sections
  section:      { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: c.textMid, letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },
  feedbackText: { fontSize: 14, color: c.text, lineHeight: 22 },
  bullet:       { flexDirection: "row", gap: 8, marginBottom: 6 },
  bulletDot:    { fontSize: 16, lineHeight: 22 },
  bulletText:   { flex: 1, fontSize: 14, color: c.text, lineHeight: 22 },
  // Q card
  qCard:        { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8, overflow: "hidden" },
  qHeader:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  qNum:         { fontSize: 13, fontWeight: "700", color: c.textMid, minWidth: 28 },
  qPreview:     { flex: 1, fontSize: 13, color: c.text },
  qMarks:       { fontSize: 13, fontWeight: "700" },
  qChevron:     { fontSize: 10, color: c.textDim, marginLeft: 4 },
  qBody:        { padding: 12, paddingTop: 0, gap: 10 },
  fieldRow:     { gap: 4 },
  fieldLabel:   { fontSize: 10, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue:   { fontSize: 14, color: c.text, lineHeight: 20 },
});
