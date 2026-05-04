import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Clipboard,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Test } from "../lib/api";
import { signOut } from "../lib/auth";
import { c } from "../lib/theme";
import { getLogs, clearLogs, errorCount, lastErrorSummary } from "../lib/errorLog";

export default function HomeScreen({ navigation }: any) {
  const [tests, setTests]         = useState<Test[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits]     = useState<number | null>(null);
  const [errCount, setErrCount]   = useState(0);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [testsRes, creditsRes] = await Promise.all([
        api.getTests(),
        api.getCredits().catch(() => ({ credits: null })),
      ]);
      setTests(testsRes.tests || []);
      setCredits((creditsRes as any).credits ?? null);
    } catch (e: any) {
      if (!quiet) Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setErrCount(errorCount());
    }
  };

  useFocusEffect(useCallback(() => {
    load(true);
    setErrCount(errorCount());
  }, []));

  const showErrorLog = () => {
    const summary = lastErrorSummary();
    if (!summary) return Alert.alert("✅ No errors", "Everything looks good!");
    Alert.alert(
      `⚠ ${errCount} error${errCount !== 1 ? "s" : ""}`,
      summary,
      [
        {
          text: "Copy all",
          onPress: () => {
            const full = getLogs().map((l) => `[${l.ts}] [${l.ctx || "App"}] ${l.msg}`).join("\n");
            Clipboard.setString(full);
            Alert.alert("Copied", "Paste it in a message to report the issue.");
          },
        },
        { text: "Clear", style: "destructive", onPress: () => { clearLogs(); setErrCount(0); } },
        { text: "OK", style: "cancel" },
      ]
    );
  };

  const renderTest = ({ item }: { item: Test }) => {
    const resultCount = item.analyzer_results?.[0]?.count ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("TestResults", { test: item })}
        activeOpacity={0.75}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardLeft}>
            <Text style={styles.testName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.testMeta}>
              {[item.subject, item.class && `Class ${item.class}`, item.section && `§${item.section}`]
                .filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.testMeta}>
              {resultCount} notebook{resultCount !== 1 ? "s" : ""} scanned · {item.total_marks} marks
            </Text>
          </View>
          <View style={styles.cardActions}>
            {resultCount > 0 && (
              <TouchableOpacity
                style={styles.insightsPill}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate("Insights", { testId: item.id, testName: item.name });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.insightsPillText}>📊</Text>
              </TouchableOpacity>
            )}
            <View style={styles.scanPill}>
              <Text style={styles.scanPillText}>+ Scan</Text>
            </View>
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
          <Text style={styles.headerTitle}>📝 Kelzo</Text>
          {credits !== null && (
            <Text style={[styles.creditsText, {
              color: credits > 20 ? c.success : credits > 0 ? c.warning : c.danger,
            }]}>
              💳 {credits} credits
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {errCount > 0 && (
            <TouchableOpacity style={styles.errBadge} onPress={showErrorLog}>
              <Text style={styles.errBadgeText}>⚠ {errCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Action buttons ─────────────────────────────── */}
      <View style={styles.actionRow}>
        {/* New Paper */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: c.accent, backgroundColor: `${c.accent}18` }]}
          onPress={() => navigation.navigate("NewPaper")}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📄</Text>
          <Text style={[styles.actionLabel, { color: c.accent }]}>New Paper</Text>
          <Text style={styles.actionSub}>Scan question paper{"\n"}+ answer sheets</Text>
        </TouchableOpacity>

        {/* Add Notebook to existing */}
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: c.purple, backgroundColor: `${c.purple}18` }]}
          onPress={() => navigation.navigate("SelectTest")}
          activeOpacity={0.8}
        >
          <Text style={styles.actionIcon}>📚</Text>
          <Text style={[styles.actionLabel, { color: c.purple }]}>Add Notebook</Text>
          <Text style={styles.actionSub}>Add to an{"\n"}existing paper</Text>
        </TouchableOpacity>
      </View>

      {/* ── Corrected Copies link ──────────────────────── */}
      <TouchableOpacity
        style={styles.correctedBtn}
        onPress={() => navigation.navigate("CorrectedCopies")}
        activeOpacity={0.8}
      >
        <Text style={styles.correctedBtnText}>📂 View Corrected Copies</Text>
        <Text style={styles.correctedBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Tests list ─────────────────────────────────── */}
      <Text style={styles.sectionLabel}>RECENT PAPERS</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(t) => t.id}
          renderItem={renderTest}
          contentContainerStyle={tests.length === 0 ? styles.emptyContainer : styles.list}
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
              <Text style={styles.emptyTitle}>No papers yet</Text>
              <Text style={styles.emptyText}>
                Tap "New Paper" to create your first test and scan answer sheets.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  // Header
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:    { fontSize: 20, fontWeight: "700", color: c.text },
  creditsText:    { fontSize: 12, fontWeight: "600", marginTop: 4 },
  headerRight:    { flexDirection: "row", alignItems: "center", gap: 10 },
  errBadge:       { backgroundColor: `${c.warning}25`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${c.warning}50` },
  errBadgeText:   { fontSize: 12, color: c.warning, fontWeight: "700" },
  profileBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  profileIcon:    { fontSize: 16 },
  // Action buttons
  actionRow:      { flexDirection: "row", gap: 12, padding: 16 },
  actionBtn:      { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: "center" },
  actionIcon:     { fontSize: 28, marginBottom: 6 },
  actionLabel:    { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  actionSub:      { fontSize: 11, color: c.textDim, textAlign: "center", lineHeight: 16 },
  // Corrected copies button
  correctedBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 12, backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: c.border },
  correctedBtnText: { fontSize: 14, fontWeight: "600", color: c.text },
  correctedBtnArrow:{ fontSize: 20, color: c.textDim },
  // Section
  sectionLabel:   { fontSize: 11, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 8 },
  // List
  list:           { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  card:           { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
  cardRow:        { flexDirection: "row", alignItems: "center" },
  cardLeft:       { flex: 1 },
  testName:       { fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 4 },
  testMeta:       { fontSize: 12, color: c.textMid, marginTop: 2 },
  cardActions:    { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 },
  scanPill:       { backgroundColor: c.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  scanPillText:   { fontSize: 12, color: c.accent, fontWeight: "700" },
  insightsPill:   { backgroundColor: `${c.purple}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: `${c.purple}40` },
  insightsPillText: { fontSize: 14 },
  // Empty
  empty:          { alignItems: "center", paddingTop: 60 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
