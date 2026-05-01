/**
 * ResultDetailScreen — full evaluation for one scanned answer sheet.
 * Shows: student info, score, feedback, strengths, improvements, per-question breakdown.
 */

import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert,
} from "react-native";
import { api } from "../lib/api";
import { c } from "../lib/theme";

export default function ResultDetailScreen({ route, navigation }: any) {
  const { resultId, testName } = route.params;
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getResult(resultId)
      .then((r) => setResult(r.result))
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: c.danger, fontSize: 14 }}>Could not load result.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: c.accent }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const a           = result.analysis || {};
  const student     = result.analyzer_students || a.student || {};
  const test        = result.analyzer_tests || {};
  const obtained    = result.marks_obtained ?? a.marks_obtained ?? 0;
  const total       = result.total_marks   ?? a.total_marks   ?? test.total_marks ?? 0;
  const pct         = total ? Math.round((obtained / total) * 100) : 0;
  const scoreColor  = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  const date        = result.analyzed_at
    ? new Date(result.analyzed_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const answers: any[] = a.answers || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {test.name || testName || "Result"}
        </Text>
        <View style={{ width: 52 }} />
      </View>

      {/* Score card */}
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreNum, { color: scoreColor }]}>{obtained}/{total}</Text>
        <Text style={[styles.scorePct, { color: scoreColor }]}>{pct}%</Text>

        {student.name && <Text style={styles.studentName}>{student.name}</Text>}
        <View style={styles.metaRow}>
          {student.roll_no && <Text style={styles.metaChip}>Roll: {student.roll_no}</Text>}
          {(student.class || a.student?.class) && (
            <Text style={styles.metaChip}>Class {student.class || a.student?.class}</Text>
          )}
          {test.subject && <Text style={styles.metaChip}>{test.subject}</Text>}
        </View>
        {date && <Text style={styles.dateText}>Scanned {date}</Text>}
      </View>

      {/* Parse warning */}
      {a.parse_error && (
        <View style={[styles.section, { borderColor: c.warning }]}>
          <Text style={[styles.sectionLabel, { color: c.warning }]}>⚠ SCAN WARNING</Text>
          <Text style={styles.bodyText}>
            Could not fully read this sheet. Retake with better lighting and ensure pages are flat.
          </Text>
        </View>
      )}

      {/* Overall feedback */}
      {a.overall_feedback && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OVERALL FEEDBACK</Text>
          <Text style={styles.bodyText}>{a.overall_feedback}</Text>
        </View>
      )}

      {/* Strengths */}
      {a.strengths?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.success }]}>✓ STRENGTHS</Text>
          {a.strengths.map((s: string, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: c.success }]}>•</Text>
              <Text style={[styles.bulletText, { color: c.success }]}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Improvements */}
      {a.improvement_areas?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.warning }]}>→ NEEDS IMPROVEMENT</Text>
          {a.improvement_areas.map((s: string, i: number) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: c.warning }]}>•</Text>
              <Text style={[styles.bulletText, { color: c.warning }]}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Per-question breakdown */}
      {answers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUESTION-WISE BREAKDOWN</Text>
          {answers.map((ans: any, i: number) => {
            const qPct = ans.max_marks
              ? Math.round((ans.marks_awarded / ans.max_marks) * 100) : null;
            const qColor = qPct === null ? c.textMid : qPct >= 75 ? c.success : qPct >= 40 ? c.warning : c.danger;
            return (
              <View key={i} style={styles.answerRow}>
                <View style={styles.answerLeft}>
                  <Text style={styles.questionNo}>
                    Q{ans.question_no ?? i + 1}
                  </Text>
                  {ans.feedback && (
                    <Text style={styles.answerFeedback}>{ans.feedback}</Text>
                  )}
                </View>
                {ans.max_marks !== undefined && (
                  <View style={[styles.marksPill, { borderColor: `${qColor}50`, backgroundColor: `${qColor}12` }]}>
                    <Text style={[styles.marksText, { color: qColor }]}>
                      {ans.marks_awarded}/{ans.max_marks}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: c.bg },
  center:       { alignItems: "center", justifyContent: "center" },
  content:      { paddingBottom: 40 },
  // Header
  header:       { flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  back:         { fontSize: 14, color: c.accent, minWidth: 52 },
  headerTitle:  { flex: 1, fontSize: 15, fontWeight: "700", color: c.text, textAlign: "center" },
  // Score card
  scoreCard:    { backgroundColor: c.card, margin: 16, borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: c.border },
  scoreNum:     { fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  scorePct:     { fontSize: 22, fontWeight: "700", marginTop: 2 },
  studentName:  { fontSize: 18, fontWeight: "700", color: c.text, marginTop: 16 },
  metaRow:      { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 8 },
  metaChip:     { fontSize: 12, color: c.textMid, backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  dateText:     { fontSize: 11, color: c.textDim, marginTop: 10 },
  // Sections
  section:      { backgroundColor: c.card, marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: c.textMid, letterSpacing: 0.8, marginBottom: 10 },
  bodyText:     { fontSize: 13, color: c.text, lineHeight: 20 },
  bulletRow:    { flexDirection: "row", gap: 8, marginBottom: 6 },
  bullet:       { fontSize: 14, lineHeight: 20, width: 14 },
  bulletText:   { fontSize: 13, lineHeight: 20, flex: 1 },
  // Answer breakdown
  answerRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 10 },
  answerLeft:   { flex: 1 },
  questionNo:   { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 3 },
  answerFeedback: { fontSize: 12, color: c.textMid, lineHeight: 18 },
  marksPill:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignItems: "center", justifyContent: "center" },
  marksText:    { fontSize: 13, fontWeight: "700" },
});
