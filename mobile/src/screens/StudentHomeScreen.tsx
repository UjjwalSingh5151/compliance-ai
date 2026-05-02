import React, { useState, useCallback } from "react";
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
import { c } from "../lib/theme";

export default function StudentHomeScreen({ navigation }: any) {
  const [student, setStudent]     = useState<any>(null);
  const [sections, setSections]   = useState<{ title: string; data: any[] }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [avgPct, setAvgPct]       = useState(0);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getStudentResults();
      setStudent(res.student);

      const results: any[] = res.results || [];
      setTotalResults(results.length);

      // Average score
      if (results.length > 0) {
        const avg = Math.round(
          results.reduce((s, r) =>
            s + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0
          ) / results.length
        );
        setAvgPct(avg);
      }

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

      {/* Stats */}
      {totalResults > 0 && (
        <View style={styles.statsRow}>
          <StatItem label="Tests taken" value={`${totalResults}`} />
          <View style={styles.statDivider} />
          <StatItem
            label="Average score" value={`${avgPct}%`}
            color={avgPct >= 75 ? c.success : avgPct >= 40 ? c.warning : c.danger}
          />
        </View>
      )}

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
        />
      )}
    </View>
  );
}

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
  // Empty
  empty:             { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji:        { fontSize: 48, marginBottom: 16 },
  emptyTitle:        { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:         { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20 },
});
