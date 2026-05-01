/**
 * TestResultsScreen — all scanned notebooks for one test.
 * Header has a "Scan Answer Sheet" button.
 * Tapping a result opens ResultDetailScreen.
 */

import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { c } from "../lib/theme";

function ScoreBadge({ obtained, total }: { obtained: number; total: number }) {
  const pct = total ? Math.round((obtained / total) * 100) : 0;
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
      <Text style={[styles.badgeScore, { color }]}>{obtained}/{total}</Text>
      <Text style={[styles.badgePct, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function TestResultsScreen({ route, navigation }: any) {
  const { test } = route.params;
  const [results, setResults]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getTestResults(test.id);
      setResults(res.results || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const renderResult = ({ item }: { item: any }) => {
    const student = item.analyzer_students;
    const name    = student?.name || item.analysis?.student?.name || "Unknown student";
    const roll    = student?.roll_no || item.analysis?.student?.roll_no;
    const date    = item.analyzed_at
      ? new Date(item.analyzed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : "";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("ResultDetail", { resultId: item.id, testName: test.name })}
        activeOpacity={0.75}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.studentName}>{name}</Text>
          {roll  && <Text style={styles.meta}>Roll: {roll}</Text>}
          {date  && <Text style={styles.meta}>{date}</Text>}
        </View>
        <ScoreBadge obtained={item.marks_obtained} total={item.total_marks || test.total_marks} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>{test.name}</Text>
          {(test.subject || test.class) && (
            <Text style={styles.subtitle}>
              {[test.subject, test.class && `Class ${test.class}`].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
        {/* Scan button */}
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => navigation.navigate("Scan", { test })}
        >
          <Text style={styles.scanBtnText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      {!loading && results.length > 0 && (() => {
        const avg = Math.round(
          results.reduce((s, r) => s + Math.round((r.marks_obtained / (r.total_marks || test.total_marks)) * 100), 0)
          / results.length
        );
        const avgColor = avg >= 75 ? c.success : avg >= 50 ? c.warning : c.danger;
        return (
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{results.length}</Text>
              <Text style={styles.statLabel}>Scanned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: avgColor }]}>{avg}%</Text>
              <Text style={styles.statLabel}>Avg score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{test.total_marks}</Text>
              <Text style={styles.statLabel}>Total marks</Text>
            </View>
          </View>
        );
      })()}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={c.accent} />
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
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No notebooks scanned yet</Text>
              <Text style={styles.emptyText}>Tap "📷 Scan" above to scan the first answer sheet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: c.bg },
  // Header
  header:       { flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  back:         { fontSize: 14, color: c.accent, minWidth: 52 },
  headerCenter: { flex: 1 },
  title:        { fontSize: 15, fontWeight: "700", color: c.text },
  subtitle:     { fontSize: 11, color: c.textMid, marginTop: 2 },
  scanBtn:      { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  scanBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  // Stats bar
  statsBar:     { flexDirection: "row", backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, padding: 12 },
  statItem:     { flex: 1, alignItems: "center" },
  statNum:      { fontSize: 18, fontWeight: "700", color: c.text },
  statLabel:    { fontSize: 10, color: c.textDim, marginTop: 2 },
  statDivider:  { width: 1, backgroundColor: c.border, marginVertical: 4 },
  // List
  list:         { padding: 14, gap: 10 },
  emptyContainer: { flex: 1 },
  card:         { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
  cardLeft:     { flex: 1 },
  studentName:  { fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 3 },
  meta:         { fontSize: 12, color: c.textMid, marginTop: 1 },
  badge:        { borderRadius: 10, borderWidth: 1, padding: 8, alignItems: "center", minWidth: 64 },
  badgeScore:   { fontSize: 14, fontWeight: "700" },
  badgePct:     { fontSize: 11, fontWeight: "600", marginTop: 1 },
  // Empty
  empty:        { alignItems: "center", paddingTop: 80 },
  emptyEmoji:   { fontSize: 48, marginBottom: 16 },
  emptyTitle:   { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:    { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20, paddingHorizontal: 32 },
});
