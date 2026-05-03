/**
 * InsightsScreen — Teacher class-level analytics.
 * Shows Q-by-Q heatmap, top error concepts, at-risk students
 * for a specific test. Opened from TestResultsScreen via "📊 Insights" button,
 * OR from HomeScreen via "📊 Insights" quick-access button.
 *
 * Props via route.params:
 *   testId   — required
 *   testName — display label (optional)
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { api, ClassAnalyticsData } from "../lib/api";
import { c } from "../lib/theme";

// ─── Mini components ────────────────────────────────────────────���─────────────

function StatCard({ label, value, color, sub }: {
  label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, { color: color || c.accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function HeatBar({ value }: { value: number }) {
  const color = value >= 70 ? c.success : value >= 40 ? c.warning : c.danger;
  return (
    <View style={styles.heatBarRow}>
      <View style={styles.heatBarBg}>
        <View style={[styles.heatBarFill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.heatPct, { color }]}>{value}%</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InsightsScreen({ route, navigation }: any) {
  const { testId, testName } = route.params || {};
  const [data, setData] = useState<ClassAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) { setError("No test selected."); setLoading(false); return; }
    api.getClassAnalytics(testId)
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={c.accent} size="large" />
        <Text style={styles.loadingText}>Generating class report…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error || "Not found"}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { test, totalPapers, classAvg, scoreDistribution, questionHeatmap, topErrorAreas, atRisk, atRiskThreshold, students } = data;
  const avgColor = classAvg != null ? (classAvg >= 70 ? c.success : classAvg >= 40 ? c.warning : c.danger) : c.textDim;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          📊 {testName || test?.name || "Class Report"}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Test meta */}
        {(test?.subject || test?.class) && (
          <Text style={styles.testMeta}>
            {[test.subject, test.class && `Class ${test.class}`, test.section].filter(Boolean).join(" · ")}
          </Text>
        )}

        {/* Stat row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statScroll}
          contentContainerStyle={styles.statRow}>
          <StatCard label="Papers" value={totalPapers} />
          <StatCard label="Class avg" value={classAvg != null ? `${classAvg}%` : "—"} color={avgColor} />
          <StatCard label="At-risk" value={atRisk.length} color={atRisk.length > 0 ? c.danger : c.success}
            sub={`< ${atRiskThreshold}%`} />
          <StatCard label="Questions" value={questionHeatmap.length} />
        </ScrollView>

        {/* Score distribution */}
        {scoreDistribution && scoreDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SCORE DISTRIBUTION</Text>
            <View style={styles.distRow}>
              {scoreDistribution.map((band) => (
                <View key={band.label} style={styles.distBand}>
                  <Text style={styles.distCount}>{band.count}</Text>
                  <Text style={styles.distLabel}>{band.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Question heatmap */}
        {questionHeatmap.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUESTION SUCCESS RATE</Text>
            {questionHeatmap.map((q) => (
              <View key={q.no} style={styles.qRow}>
                <View style={styles.qLeft}>
                  <Text style={styles.qNo}>Q{q.no}</Text>
                  {(q.concept_tag || q.cognitive_level) && (
                    <View style={styles.tagRow}>
                      {q.concept_tag && (
                        <View style={styles.tagPill}>
                          <Text style={styles.tagText}>🏷 {q.concept_tag}</Text>
                        </View>
                      )}
                      {q.cognitive_level && (
                        <View style={[styles.tagPill, { backgroundColor: `${c.purple}20` }]}>
                          <Text style={[styles.tagText, { color: c.purple }]}>🧠 {q.cognitive_level}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.qBarContainer}>
                  <HeatBar value={q.successRate} />
                  <Text style={styles.qAttempts}>{q.attempts} papers</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Top error areas */}
        {topErrorAreas.length > 0 && (
          <View style={[styles.section, styles.dangerSection]}>
            <Text style={[styles.sectionTitle, { color: c.danger }]}>TOP CLASS-WIDE ERRORS</Text>
            {topErrorAreas.map((ea, i) => (
              <View key={ea.tag} style={styles.errorRow}>
                <Text style={styles.errorRank}>{i + 1}.</Text>
                <Text style={styles.errorTag}>{ea.tag}</Text>
                {ea.cogLevel && <Text style={styles.errorCog}>{ea.cogLevel}</Text>}
                <View style={styles.errorBadge}>
                  <Text style={styles.errorBadgeText}>{ea.count}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* At-risk students */}
        {atRisk.length > 0 && (
          <View style={[styles.section, styles.warningSection]}>
            <Text style={[styles.sectionTitle, { color: c.warning }]}>
              ⚠ AT-RISK STUDENTS (below {atRiskThreshold}%)
            </Text>
            {atRisk.map((s) => (
              <View key={s.resultId} style={styles.studentRow}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentAvatarText}>{(s.name || "?").slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{s.name}</Text>
                  {s.roll && <Text style={styles.studentMeta}>Roll: {s.roll}</Text>}
                </View>
                <Text style={[styles.studentScore, { color: c.danger }]}>{s.score}%</Text>
                <Text style={styles.studentMarks}>{s.marks}/{s.total}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All students */}
        {students.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ALL STUDENTS ({students.length})</Text>
            {students.map((s, i) => {
              const color = s.score >= 70 ? c.success : s.score >= 40 ? c.warning : c.danger;
              return (
                <View key={s.resultId} style={[styles.studentRow, i < students.length - 1 && styles.studentRowBorder]}>
                  <Text style={styles.studentRank}>{i + 1}</Text>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{s.name}</Text>
                    {s.roll && <Text style={styles.studentMeta}>Roll: {s.roll}</Text>}
                  </View>
                  <Text style={[styles.studentScore, { color }]}>{s.score}%</Text>
                  <Text style={styles.studentMarks}>{s.marks}/{s.total}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: c.bg },
  center:          { alignItems: "center", justifyContent: "center" },
  // Header
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  backLink:        { fontSize: 14, color: c.accent },
  headerTitle:     { fontSize: 15, fontWeight: "700", color: c.text, flex: 1, textAlign: "center", marginHorizontal: 8 },
  testMeta:        { fontSize: 12, color: c.textMid, textAlign: "center", paddingVertical: 8, paddingHorizontal: 16 },
  // Loading/error
  loadingText:     { color: c.textMid, marginTop: 12, fontSize: 14 },
  errorText:       { fontSize: 14, color: c.danger, marginBottom: 16, textAlign: "center", padding: 20 },
  backBtn:         { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  backBtnText:     { fontSize: 14, color: c.accent },
  scroll:          { paddingBottom: 48 },
  // Stat row
  statScroll:      { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  statRow:         { flexDirection: "row", gap: 10, paddingRight: 16 },
  statCard:        { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", minWidth: 90 },
  statVal:         { fontSize: 22, fontWeight: "800" },
  statLabel:       { fontSize: 10, color: c.textDim, marginTop: 2, textAlign: "center" },
  statSub:         { fontSize: 10, color: c.textDim, marginTop: 1 },
  // Sections
  section:         { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, margin: 16, marginBottom: 0, padding: 16 },
  dangerSection:   { borderColor: `${c.danger}40`, backgroundColor: `${c.danger}06` },
  warningSection:  { borderColor: `${c.warning}40`, backgroundColor: `${c.warning}06` },
  sectionTitle:    { fontSize: 11, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, marginBottom: 14 },
  // Score distribution
  distRow:         { flexDirection: "row", gap: 8 },
  distBand:        { flex: 1, backgroundColor: c.bg, borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: c.border },
  distCount:       { fontSize: 20, fontWeight: "800", color: c.text },
  distLabel:       { fontSize: 10, color: c.textDim, marginTop: 2, textAlign: "center" },
  // Q heatmap
  qRow:            { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  qLeft:           { minWidth: 70 },
  qNo:             { fontSize: 13, fontWeight: "700", color: c.textMid },
  tagRow:          { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tagPill:         { backgroundColor: `${c.accent}18`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText:         { fontSize: 9, color: c.accent, fontWeight: "600" },
  qBarContainer:   { flex: 1 },
  heatBarRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  heatBarBg:       { flex: 1, height: 8, backgroundColor: c.border, borderRadius: 4, overflow: "hidden" },
  heatBarFill:     { height: 8, borderRadius: 4 },
  heatPct:         { fontSize: 12, fontWeight: "700", minWidth: 36, textAlign: "right" },
  qAttempts:       { fontSize: 10, color: c.textDim, marginTop: 3 },
  // Error areas
  errorRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  errorRank:       { fontSize: 12, color: c.textDim, minWidth: 18 },
  errorTag:        { fontSize: 13, fontWeight: "600", color: c.text, flex: 1 },
  errorCog:        { fontSize: 10, color: c.textDim, backgroundColor: c.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  errorBadge:      { backgroundColor: `${c.danger}18`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  errorBadgeText:  { fontSize: 12, fontWeight: "700", color: c.danger },
  // Students
  studentRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  studentRowBorder:{ borderBottomWidth: 1, borderBottomColor: c.border },
  studentAvatar:   { width: 32, height: 32, borderRadius: 16, backgroundColor: `${c.danger}20`, alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 11, fontWeight: "700", color: c.danger },
  studentRank:     { fontSize: 11, color: c.textDim, minWidth: 22 },
  studentInfo:     { flex: 1 },
  studentName:     { fontSize: 13, fontWeight: "600", color: c.text },
  studentMeta:     { fontSize: 11, color: c.textDim, marginTop: 1 },
  studentScore:    { fontSize: 15, fontWeight: "800" },
  studentMarks:    { fontSize: 12, color: c.textDim, minWidth: 44, textAlign: "right" },
});
