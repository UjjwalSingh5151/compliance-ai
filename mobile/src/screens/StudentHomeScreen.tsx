import React, { useState, useCallback } from "react";
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, LearningFingerprint } from "../lib/api";
import { c } from "../lib/theme";

export default function StudentHomeScreen({ navigation }: any) {
  const [student, setStudent]         = useState<any>(null);
  const [sections, setSections]       = useState<{ title: string; data: any[] }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [avgPct, setAvgPct]           = useState(0);
  const [fingerprint, setFingerprint] = useState<LearningFingerprint | null>(null);
  const [allResults, setAllResults]   = useState<any[]>([]);
  const [weakCount, setWeakCount]     = useState(0);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    // Fetch fingerprint in parallel (non-blocking)
    api.getStudentFingerprint()
      .then(({ fingerprint: fp }) => setFingerprint(fp))
      .catch(() => {}); // fingerprint is optional, never block load
    try {
      const res = await api.getStudentResults();
      setStudent(res.student);

      const results: any[] = res.results || [];
      setTotalResults(results.length);
      setAllResults(results);

      // Average score
      if (results.length > 0) {
        const avg = Math.round(
          results.reduce((s, r) =>
            s + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0
          ) / results.length
        );
        setAvgPct(avg);
      }

      // Weak concept count (concept_tags with >0 wrong answers across all questions)
      const conceptWrong: Record<string, number> = {};
      for (const r of results) {
        for (const q of (r.analysis?.questions || [])) {
          if (!q.concept_tag) continue;
          const isCorrect = q.is_correct || (q.marks_awarded >= q.marks_available);
          if (!isCorrect) conceptWrong[q.concept_tag] = (conceptWrong[q.concept_tag] || 0) + 1;
        }
      }
      setWeakCount(Object.keys(conceptWrong).length);

      // Group by subject
      const grouped: Record<string, any[]> = {};
      for (const r of results) {
        const subj = r.analyzer_tests?.subject?.trim() || "General";
        if (!grouped[subj]) grouped[subj] = [];
        grouped[subj].push(r);
      }

      const secs = Object.keys(grouped)
        .sort()
        .map((title) => ({ title, data: grouped[title] }));
      setSections(secs);
    } catch (e: any) {
      if (!quiet) Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const go = (resultId: string, tab: string) =>
    navigation.navigate("StudentResultDetail", { resultId, initialTab: tab });

  const renderItem = ({ item }: { item: any }) => {
    const pct = item.total_marks > 0
      ? Math.round((item.marks_obtained / item.total_marks) * 100) : 0;
    const scoreColor = pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger;
    const test = item.analyzer_tests || {};
    const date = item.analyzed_at
      ? new Date(item.analyzed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : "";
    const hasNotes = !!item.revision_notes;

    return (
      <View style={styles.testCard}>
        {/* Test row */}
        <View style={styles.testRow}>
          <View style={styles.testLeft}>
            <Text style={styles.testName} numberOfLines={1}>{test.name || "Test"}</Text>
            <Text style={styles.testDate}>{date}</Text>
          </View>
          <View style={[styles.scorePill, { borderColor: scoreColor, backgroundColor: `${scoreColor}15` }]}>
            <Text style={[styles.scoreNum, { color: scoreColor }]}>{pct}%</Text>
            <Text style={[styles.scoreMarks, { color: scoreColor }]}>{item.marks_obtained}/{item.total_marks}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <ActionBtn
            icon="📊" label="Results"
            onPress={() => go(item.id, "analysis")}
            color={c.accent}
          />
          <ActionBtn
            icon="📝" label={hasNotes ? "Notes ✓" : "Notes"}
            onPress={() => go(item.id, "notes")}
            color={c.purple}
          />
          <ActionBtn
            icon="🎯" label="Practice"
            onPress={() => go(item.id, "practice")}
            color={c.success}
          />
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title.toUpperCase()}</Text>
      <Text style={styles.sectionCount}>{section.data.length} test{section.data.length !== 1 ? "s" : ""}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📝 EduGrade</Text>
          {student && (
            <Text style={styles.headerSub}>
              👤 {student.name}{student.roll_no ? `  ·  Roll ${student.roll_no}` : ""}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No results yet</Text>
          <Text style={styles.emptyText}>
            Your teacher hasn't graded any answer sheets yet. Check back after your next exam!
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={c.accent}
            />
          }
          ListHeaderComponent={
            <>
              {/* Stats row — pulled to full width, flush with screen edges */}
              <View style={[styles.statsRow, { marginHorizontal: -16, marginTop: -16 }]}>
                <StatItem label="Tests taken" value={`${totalResults}`} />
                <View style={styles.statDivider} />
                <StatItem
                  label="Average score" value={`${avgPct}%`}
                  color={avgPct >= 75 ? c.success : avgPct >= 40 ? c.warning : c.danger}
                />
                {weakCount > 0 && (
                  <>
                    <View style={styles.statDivider} />
                    <StatItem label="Weak areas" value={`${weakCount}`} color={c.danger} />
                  </>
                )}
              </View>
              {/* Analytics panel */}
              <PerformancePanel results={allResults} fingerprint={fingerprint} />
              {/* Results label */}
              <View style={styles.resultsSectionLabel}>
                <Text style={styles.sectionHeaderText}>MY RESULTS</Text>
                <Text style={styles.sectionCount}>{totalResults} test{totalResults !== 1 ? "s" : ""}</Text>
              </View>
            </>
          }
        />
      )}
    </View>
  );
}

// ─── Rich performance analytics panel ─────────────────────────────────────────
function PerformancePanel({ results, fingerprint }: {
  results: any[];
  fingerprint: LearningFingerprint | null;
}) {
  const [showAll, setShowAll] = useState(false);

  // ── Compute analytics from results ──────────────────────────────────────────
  // Subject breakdown
  const subjectMap: Record<string, { obtained: number; total: number; count: number }> = {};
  for (const r of results) {
    const subj = r.analyzer_tests?.subject?.trim() || "General";
    if (!subjectMap[subj]) subjectMap[subj] = { obtained: 0, total: 0, count: 0 };
    subjectMap[subj].obtained += r.marks_obtained || 0;
    subjectMap[subj].total    += r.total_marks    || 0;
    subjectMap[subj].count    += 1;
  }
  const subjects = Object.entries(subjectMap).map(([subj, d]) => ({
    subject: subj,
    avg: d.total > 0 ? Math.round((d.obtained / d.total) * 100) : 0,
    count: d.count,
  })).sort((a, b) => b.avg - a.avg);

  // All questions across all results
  const allQuestions: any[] = results.flatMap((r) => (r.analysis?.questions || []).map((q: any) => ({
    ...q,
    subject: r.analyzer_tests?.subject?.trim() || "General",
  })));

  // Concept-level breakdown
  const conceptMap: Record<string, { correct: number; wrong: number; subject: string }> = {};
  for (const q of allQuestions) {
    if (!q.concept_tag) continue;
    if (!conceptMap[q.concept_tag]) conceptMap[q.concept_tag] = { correct: 0, wrong: 0, subject: q.subject };
    const isCorrect = q.is_correct || (q.marks_awarded >= q.marks_available);
    if (isCorrect) conceptMap[q.concept_tag].correct++;
    else           conceptMap[q.concept_tag].wrong++;
  }
  const weakConcepts  = Object.entries(conceptMap)
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 6);
  const strongConcepts = Object.entries(conceptMap)
    .filter(([, v]) => v.wrong === 0 && v.correct > 0)
    .sort((a, b) => b[1].correct - a[1].correct)
    .slice(0, 4);

  // Cognitive level accuracy
  const cogMap: Record<string, { awarded: number; available: number }> = {
    recall: { awarded: 0, available: 0 },
    application: { awarded: 0, available: 0 },
    analysis: { awarded: 0, available: 0 },
  };
  for (const q of allQuestions) {
    const level = q.cognitive_level;
    if (!level || !cogMap[level]) continue;
    cogMap[level].awarded   += q.marks_awarded   || 0;
    cogMap[level].available += q.marks_available || 0;
  }
  const cogStats = (["recall", "application", "analysis"] as const).map((level) => {
    const d = cogMap[level];
    const acc = d.available > 0 ? Math.round((d.awarded / d.available) * 100) : null;
    return { level, acc, available: d.available };
  }).filter((s) => s.available > 0);

  // Overall Q accuracy
  const totalQ   = allQuestions.length;
  const correctQ = allQuestions.filter((q) => q.is_correct || q.marks_awarded >= q.marks_available).length;
  const partialQ = allQuestions.filter((q) => !q.is_correct && q.marks_awarded > 0 && q.marks_awarded < q.marks_available).length;
  const wrongQ   = totalQ - correctQ - partialQ;

  const cogColor = (level: string) =>
    level === "recall" ? c.success : level === "application" ? c.warning : c.purple;
  const cogIcon  = (level: string) =>
    level === "recall" ? "💭" : level === "application" ? "⚙️" : "🔬";

  const SHOW_LIMIT = 2; // concepts to show before "show more"

  return (
    <View style={fpStyles.panel}>
      <Text style={fpStyles.panelTitle}>📊 My Performance Breakdown</Text>

      {/* ── Subject bars ── */}
      <View style={fpStyles.section}>
        <Text style={fpStyles.sectionLabel}>SUBJECTS</Text>
        {subjects.map(({ subject, avg, count }) => {
          const col = avg >= 75 ? c.success : avg >= 40 ? c.warning : c.danger;
          return (
            <View key={subject} style={fpStyles.barRow}>
              <Text style={fpStyles.barLabel} numberOfLines={1}>{subject}</Text>
              <View style={fpStyles.barTrack}>
                <View style={[fpStyles.barFill, { width: `${avg}%` as any, backgroundColor: col }]} />
              </View>
              <Text style={[fpStyles.barPct, { color: col }]}>{avg}%</Text>
              <Text style={fpStyles.barCount}>{count}t</Text>
            </View>
          );
        })}
      </View>

      {/* ── Q accuracy summary ── */}
      {totalQ > 0 && (
        <View style={fpStyles.section}>
          <Text style={fpStyles.sectionLabel}>QUESTION ACCURACY ({totalQ} questions total)</Text>
          <View style={fpStyles.qBar}>
            {correctQ > 0 && <View style={[fpStyles.qBarSeg, { flex: correctQ, backgroundColor: c.success }]} />}
            {partialQ > 0 && <View style={[fpStyles.qBarSeg, { flex: partialQ, backgroundColor: c.warning }]} />}
            {wrongQ   > 0 && <View style={[fpStyles.qBarSeg, { flex: wrongQ,   backgroundColor: c.danger  }]} />}
          </View>
          <View style={fpStyles.qLegend}>
            <View style={fpStyles.qLegendItem}>
              <View style={[fpStyles.qDot, { backgroundColor: c.success }]} />
              <Text style={fpStyles.qLegendText}>Correct {correctQ}</Text>
            </View>
            <View style={fpStyles.qLegendItem}>
              <View style={[fpStyles.qDot, { backgroundColor: c.warning }]} />
              <Text style={fpStyles.qLegendText}>Partial {partialQ}</Text>
            </View>
            <View style={fpStyles.qLegendItem}>
              <View style={[fpStyles.qDot, { backgroundColor: c.danger }]} />
              <Text style={fpStyles.qLegendText}>Wrong {wrongQ}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Cognitive level accuracy ── */}
      {cogStats.length > 0 && (
        <View style={fpStyles.section}>
          <Text style={fpStyles.sectionLabel}>ACCURACY BY QUESTION TYPE</Text>
          <View style={fpStyles.cogRow}>
            {cogStats.map(({ level, acc }) => {
              const col = cogColor(level);
              return (
                <View key={level} style={[fpStyles.cogBox, { borderColor: `${col}40`, backgroundColor: `${col}10` }]}>
                  <Text style={fpStyles.cogIcon}>{cogIcon(level)}</Text>
                  <Text style={[fpStyles.cogAcc, { color: col }]}>{acc}%</Text>
                  <Text style={fpStyles.cogLabel}>{level}</Text>
                  <Text style={fpStyles.cogHint}>
                    {acc! >= 80 ? "Strong ✓" : acc! >= 50 ? "Moderate" : "Needs work"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Weak concepts ── */}
      {weakConcepts.length > 0 && (
        <View style={fpStyles.section}>
          <Text style={fpStyles.sectionLabel}>🔴 TOPICS TO FOCUS ON</Text>
          {(showAll ? weakConcepts : weakConcepts.slice(0, SHOW_LIMIT)).map(([tag, v]) => (
            <View key={tag} style={fpStyles.conceptRow}>
              <View style={fpStyles.conceptLeft}>
                <Text style={fpStyles.conceptTag}>{tag}</Text>
                <Text style={fpStyles.conceptSubj}>{v.subject}</Text>
              </View>
              <View style={fpStyles.conceptRight}>
                <Text style={fpStyles.conceptWrong}>{v.wrong} wrong</Text>
                {v.correct > 0 && <Text style={fpStyles.conceptRight2}>{v.correct} correct</Text>}
              </View>
            </View>
          ))}
          {weakConcepts.length > SHOW_LIMIT && (
            <TouchableOpacity onPress={() => setShowAll((v) => !v)} style={fpStyles.showMore}>
              <Text style={fpStyles.showMoreText}>
                {showAll ? "Show less ▲" : `+${weakConcepts.length - SHOW_LIMIT} more topics ▼`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Strong concepts ── */}
      {strongConcepts.length > 0 && (
        <View style={fpStyles.section}>
          <Text style={fpStyles.sectionLabel}>✅ STRONG TOPICS</Text>
          <View style={fpStyles.chipRow}>
            {strongConcepts.map(([tag]) => (
              <View key={tag} style={fpStyles.strongChip}>
                <Text style={fpStyles.strongChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Fingerprint insights (if available) ── */}
      {fingerprint?.weakConcepts && fingerprint.weakConcepts.length > 0 && weakConcepts.length === 0 && (
        <View style={fpStyles.section}>
          <Text style={fpStyles.sectionLabel}>🔴 RECURRING WEAK CONCEPTS</Text>
          <View style={fpStyles.chipRow}>
            {fingerprint.weakConcepts.map((wc) => (
              <View key={wc.tag} style={[fpStyles.strongChip, { backgroundColor: `${c.danger}12`, borderColor: `${c.danger}30` }]}>
                <Text style={[fpStyles.strongChipText, { color: c.danger }]}>{wc.tag} ({wc.count}×)</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const fpStyles = StyleSheet.create({
  panel:         { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginTop: 14, marginBottom: 0, padding: 14 },
  panelTitle:    { fontSize: 14, fontWeight: "700", color: c.text, marginBottom: 14 },
  section:       { marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  sectionLabel:  { fontSize: 10, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, marginBottom: 10 },
  // Subject bars
  barRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  barLabel:      { fontSize: 12, color: c.text, fontWeight: "600", width: 72 },
  barTrack:      { flex: 1, height: 8, backgroundColor: c.bg, borderRadius: 4, overflow: "hidden" },
  barFill:       { height: 8, borderRadius: 4 },
  barPct:        { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  barCount:      { fontSize: 10, color: c.textDim, width: 18 },
  // Q accuracy bar
  qBar:          { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", gap: 1, marginBottom: 8 },
  qBarSeg:       { borderRadius: 2 },
  qLegend:       { flexDirection: "row", gap: 14 },
  qLegendItem:   { flexDirection: "row", alignItems: "center", gap: 5 },
  qDot:          { width: 8, height: 8, borderRadius: 4 },
  qLegendText:   { fontSize: 11, color: c.textMid },
  // Cognitive
  cogRow:        { flexDirection: "row", gap: 8 },
  cogBox:        { flex: 1, alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 10, gap: 2 },
  cogIcon:       { fontSize: 18 },
  cogAcc:        { fontSize: 20, fontWeight: "800" },
  cogLabel:      { fontSize: 10, color: c.textDim, textTransform: "capitalize" },
  cogHint:       { fontSize: 9, color: c.textDim, marginTop: 2 },
  // Weak concept rows
  conceptRow:    { flexDirection: "row", alignItems: "center", backgroundColor: c.bg, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: `${c.danger}20` },
  conceptLeft:   { flex: 1 },
  conceptTag:    { fontSize: 13, fontWeight: "600", color: c.text },
  conceptSubj:   { fontSize: 11, color: c.textDim, marginTop: 2 },
  conceptRight:  { alignItems: "flex-end" },
  conceptWrong:  { fontSize: 12, fontWeight: "700", color: c.danger },
  conceptRight2: { fontSize: 11, color: c.success, marginTop: 1 },
  showMore:      { alignItems: "center", marginTop: 4 },
  showMoreText:  { fontSize: 12, color: c.accent, fontWeight: "600" },
  // Strong concepts chips
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  strongChip:    { backgroundColor: `${c.success}12`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: `${c.success}30` },
  strongChipText:{ fontSize: 12, color: c.success, fontWeight: "600" },
});

function ActionBtn({ icon, label, onPress, color }: {
  icon: string; label: string; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: c.bg },
  // Header
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:       { fontSize: 20, fontWeight: "700", color: c.text },
  headerSub:         { fontSize: 13, color: c.textMid, marginTop: 4 },
  profileBtn:        { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  profileIcon:       { fontSize: 16 },
  // Stats
  statsRow:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  stat:              { flex: 1, alignItems: "center" },
  statVal:           { fontSize: 22, fontWeight: "800", color: c.accent },
  statLabel:         { fontSize: 11, color: c.textDim, marginTop: 2 },
  statDivider:       { width: 1, height: 32, backgroundColor: c.border },
  // List
  listContent:       { padding: 16, paddingBottom: 32 },
  // Section header
  sectionHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingTop: 20 },
  sectionHeaderText: { fontSize: 12, fontWeight: "700", color: c.accent, letterSpacing: 1 },
  sectionCount:      { fontSize: 11, color: c.textDim },
  // Test card
  testCard:          { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10, overflow: "hidden" },
  testRow:           { flexDirection: "row", alignItems: "center", padding: 14, paddingBottom: 10 },
  testLeft:          { flex: 1, gap: 3 },
  testName:          { fontSize: 15, fontWeight: "600", color: c.text },
  testDate:          { fontSize: 12, color: c.textDim },
  scorePill:         { alignItems: "center", borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6, minWidth: 64 },
  scoreNum:          { fontSize: 17, fontWeight: "800" },
  scoreMarks:        { fontSize: 10, fontWeight: "600", marginTop: 1 },
  // Action row
  actionRow:         { flexDirection: "row", gap: 8, padding: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.border },
  actionBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingVertical: 7 },
  actionIcon:        { fontSize: 14 },
  actionLabel:       { fontSize: 12, fontWeight: "700" },
  // Results section label (inside ListHeaderComponent)
  resultsSectionLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 4 },
  // Empty
  empty:             { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji:        { fontSize: 48, marginBottom: 16 },
  emptyTitle:        { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:         { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20 },
});
