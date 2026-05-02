/**
 * StudentResultDetailScreen — read-only result view for students.
 * Same layout as ResultDetailScreen but without teacher notes / save.
 * Tabs: Answer Sheet (PDF) | Analysis (Q-by-Q)
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert,
} from "react-native";
import WebView from "react-native-webview";
import { api } from "../lib/api";
import { c } from "../lib/theme";

type Tab = "sheet" | "analysis";

export default function StudentResultDetailScreen({ route, navigation }: any) {
  const { resultId } = route.params;
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("analysis");

  useEffect(() => {
    api.getStudentResult(resultId)
      .then(({ result }) => {
        setResult(result);
        // Default to sheet tab if PDF exists
        if (result?.original_sheet_url) setTab("analysis");
      })
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} size="large" />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Result not found</Text>
      </View>
    );
  }

  const analysis = result.analysis || {};
  const student = result.analyzer_students || analysis.student || {};
  const test = result.analyzer_tests || {};
  const questions: any[] = analysis.questions || [];
  const pct = result.total_marks > 0
    ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;
  const hasSheet = !!result.original_sheet_url;

  const sheetUrl = hasSheet
    ? result.original_sheet_url.match(/\.(pdf)(\?|$)/i)
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(result.original_sheet_url)}&embedded=true`
      : result.original_sheet_url
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{test.name || "Result"}</Text>
          {test.subject && <Text style={styles.headerSub}>{test.subject}</Text>}
        </View>
      </View>

      {/* Tab bar — only show if answer sheet exists */}
      {hasSheet && (
        <View style={styles.tabBar}>
          {(["sheet", "analysis"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "sheet" ? "📄 Answer Sheet" : "📊 Analysis"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Answer Sheet tab */}
      {tab === "sheet" && sheetUrl ? (
        <WebView
          source={{ uri: sheetUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.loadingText}>Loading answer sheet…</Text>
            </View>
          )}
        />
      ) : (
        /* Analysis tab */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Score ring */}
          <View style={styles.scoreCard}>
            <View style={[styles.ring, {
              borderColor: pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger,
            }]}>
              <Text style={[styles.ringPct, {
                color: pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger,
              }]}>{pct}%</Text>
              <Text style={styles.ringMarks}>{result.marks_obtained}/{result.total_marks}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name || "Student"}</Text>
              {student.roll_no && <Text style={styles.chip}>Roll {student.roll_no}</Text>}
              {(student.class || student.section) && (
                <Text style={styles.chip}>
                  {[student.class && `Class ${student.class}`, student.section].filter(Boolean).join(" · ")}
                </Text>
              )}
              {hasSheet && (
                <TouchableOpacity style={styles.viewSheetBtn} onPress={() => setTab("sheet")}>
                  <Text style={styles.viewSheetText}>📄 View Answer Sheet</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Overall feedback */}
          {analysis.overall_feedback && (
            <InfoSection title="Overall Feedback">
              <Text style={styles.feedbackText}>{analysis.overall_feedback}</Text>
            </InfoSection>
          )}

          {/* Strengths */}
          {(analysis.strengths || []).length > 0 && (
            <InfoSection title="✓ Strengths">
              {analysis.strengths.map((s: string, i: number) => (
                <BulletItem key={i} text={s} color={c.success} />
              ))}
            </InfoSection>
          )}

          {/* Improvements */}
          {(analysis.improvement_areas || []).length > 0 && (
            <InfoSection title="→ Areas to Improve">
              {analysis.improvement_areas.map((a: string, i: number) => (
                <BulletItem key={i} text={a} color={c.warning} />
              ))}
            </InfoSection>
          )}

          {/* Q-by-Q */}
          {questions.length > 0 && (
            <InfoSection title="Question Breakdown">
              {questions.map((q: any) => (
                <QuestionCard key={q.no} q={q} />
              ))}
            </InfoSection>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletDot, { color }]}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function QuestionCard({ q }: { q: any }) {
  const [open, setOpen] = useState(false);
  const awarded = q.marks_awarded ?? 0;
  const available = q.marks_available ?? 0;
  const full = awarded >= available;
  const zero = awarded === 0;
  const color = full ? c.success : zero ? c.danger : c.warning;

  return (
    <TouchableOpacity
      style={styles.qCard}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={0.8}
    >
      <View style={styles.qHeader}>
        <Text style={styles.qNum}>Q{q.no}</Text>
        <Text style={styles.qPreview} numberOfLines={open ? undefined : 1}>
          {q.feedback || q.question || ""}
        </Text>
        <Text style={[styles.qMarks, { color }]}>{awarded}/{available}</Text>
        <Text style={styles.qChevron}>{open ? "▲" : "▼"}</Text>
      </View>

      {open && (
        <View style={styles.qBody}>
          {q.question && <QField label="QUESTION" value={q.question} />}
          {q.student_answer && <QField label="YOUR ANSWER" value={q.student_answer} />}
          {q.expected_answer && <QField label="EXPECTED ANSWER" value={q.expected_answer} color={c.success} />}
          {q.reasoning && <QField label="REASONING" value={q.reasoning} />}
          {q.feedback && <QField label="FEEDBACK" value={q.feedback} color={c.accent} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

function QField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  center:         { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
  errorText:      { color: c.textMid, fontSize: 15 },
  loadingText:    { color: c.textMid, marginTop: 10, fontSize: 13 },
  // Header
  header:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backArrow:      { fontSize: 22, color: c.accent },
  headerTitle:    { fontSize: 16, fontWeight: "700", color: c.text },
  headerSub:      { fontSize: 12, color: c.textMid, marginTop: 1 },
  // Tabs
  tabBar:         { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border },
  tab:            { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:      { borderBottomColor: c.accent },
  tabText:        { fontSize: 13, fontWeight: "600", color: c.textMid },
  tabTextActive:  { color: c.accent },
  // Scroll
  scrollContent:  { padding: 16, gap: 16 },
  // Score card
  scoreCard:      { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  ring:           { width: 90, height: 90, borderRadius: 45, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ringPct:        { fontSize: 22, fontWeight: "800" },
  ringMarks:      { fontSize: 12, color: c.textMid, marginTop: 2 },
  studentInfo:    { flex: 1, gap: 4 },
  studentName:    { fontSize: 17, fontWeight: "700", color: c.text },
  chip:           { fontSize: 12, color: c.textMid },
  viewSheetBtn:   { marginTop: 6, alignSelf: "flex-start", backgroundColor: c.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  viewSheetText:  { fontSize: 12, color: c.accent, fontWeight: "600" },
  // Sections
  section:        { gap: 8 },
  sectionTitle:   { fontSize: 12, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  feedbackText:   { fontSize: 14, color: c.text, lineHeight: 22 },
  bullet:         { flexDirection: "row", gap: 8 },
  bulletDot:      { fontSize: 16, lineHeight: 22 },
  bulletText:     { flex: 1, fontSize: 14, color: c.text, lineHeight: 22 },
  // Q cards
  qCard:          { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  qHeader:        { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  qNum:           { fontSize: 13, fontWeight: "700", color: c.textMid, minWidth: 28 },
  qPreview:       { flex: 1, fontSize: 13, color: c.text },
  qMarks:         { fontSize: 13, fontWeight: "700" },
  qChevron:       { fontSize: 10, color: c.textDim, marginLeft: 4 },
  qBody:          { padding: 12, paddingTop: 0, gap: 10 },
  fieldRow:       { gap: 4 },
  fieldLabel:     { fontSize: 10, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue:     { fontSize: 14, color: c.text, lineHeight: 20 },
});
