/**
 * StudentHomeScreen — shown when the logged-in user is a student
 * (matched by email in the school's student CRM).
 * Lists all their graded results across all tests.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
import { c } from "../lib/theme";

export default function StudentHomeScreen({ navigation }: any) {
  const [student, setStudent] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getStudentResults();
      setStudent(res.student);
      setResults(res.results || []);
    } catch (e: any) {
      if (!quiet) Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const renderResult = ({ item }: { item: any }) => {
    const pct = item.total_marks > 0
      ? Math.round((item.marks_obtained / item.total_marks) * 100) : 0;
    const color = pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger;
    const test = item.analyzer_tests || {};
    const date = item.analyzed_at
      ? new Date(item.analyzed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : "";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("StudentResultDetail", { resultId: item.id })}
        activeOpacity={0.75}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <Text style={styles.testName} numberOfLines={1}>{test.name || "Test"}</Text>
            {test.subject && <Text style={styles.testMeta}>{test.subject}</Text>}
            <Text style={styles.testMeta}>{date}</Text>
          </View>
          <View style={[styles.scoreBadge, { borderColor: color, backgroundColor: `${color}15` }]}>
            <Text style={[styles.scoreNum, { color }]}>{pct}%</Text>
            <Text style={[styles.scoreMarks, { color }]}>
              {item.marks_obtained}/{item.total_marks}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📝 EduGrade</Text>
          {student && (
            <Text style={styles.headerSub}>
              👤 {student.name}
              {student.roll_no ? `  ·  Roll ${student.roll_no}` : ""}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => Alert.alert("Sign out", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: signOut },
        ])}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      {results.length > 0 && (() => {
        const avg = Math.round(
          results.reduce((s, r) => s + (r.total_marks > 0 ? (r.marks_obtained / r.total_marks) * 100 : 0), 0) / results.length
        );
        return (
          <View style={styles.statsRow}>
            <Stat label="Tests taken" value={`${results.length}`} />
            <View style={styles.statDivider} />
            <Stat label="Average score" value={`${avg}%`} color={avg >= 75 ? c.success : avg >= 40 ? c.warning : c.danger} />
          </View>
        );
      })()}

      <Text style={styles.sectionLabel}>MY RESULTS</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={renderResult}
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={c.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptyText}>
                Your teacher hasn't graded any of your answer sheets yet.
                Check back after your next exam!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:    { fontSize: 20, fontWeight: "700", color: c.text },
  headerSub:      { fontSize: 13, color: c.textMid, marginTop: 4 },
  signOut:        { fontSize: 13, color: c.textDim, paddingTop: 4 },
  // Stats
  statsRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  stat:           { flex: 1, alignItems: "center" },
  statVal:        { fontSize: 22, fontWeight: "800", color: c.accent },
  statLabel:      { fontSize: 11, color: c.textDim, marginTop: 2 },
  statDivider:    { width: 1, height: 32, backgroundColor: c.border },
  // Section
  sectionLabel:   { fontSize: 11, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, paddingHorizontal: 16, paddingVertical: 12 },
  // List
  list:           { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  // Card
  card:           { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
  cardRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  cardLeft:       { flex: 1, gap: 3 },
  testName:       { fontSize: 15, fontWeight: "600", color: c.text },
  testMeta:       { fontSize: 12, color: c.textMid },
  scoreBadge:     { alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, minWidth: 70 },
  scoreNum:       { fontSize: 18, fontWeight: "800" },
  scoreMarks:     { fontSize: 11, fontWeight: "600", marginTop: 1 },
  // Empty
  empty:          { alignItems: "center", paddingTop: 60 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
