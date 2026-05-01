/**
 * CorrectedCopiesScreen — browse all corrected copies hierarchically.
 * Structure: Class → Subject → Papers → Results (TestResultsScreen)
 */

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Test } from "../lib/api";
import { c } from "../lib/theme";

// ─── Group tests by class → subject ──────────────────────────────────────────
function groupTests(tests: Test[]) {
  const map: Record<string, Record<string, Test[]>> = {};
  for (const t of tests) {
    const cls = t.class?.trim() || "No Class";
    const sub = t.subject?.trim() || "General";
    if (!map[cls]) map[cls] = {};
    if (!map[cls][sub]) map[cls][sub] = [];
    map[cls][sub].push(t);
  }
  // Sort classes and subjects alphabetically
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cls, subjects]) => ({
      cls,
      subjects: Object.entries(subjects)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sub, papers]) => ({ sub, papers })),
    }));
}

export default function CorrectedCopiesScreen({ navigation }: any) {
  const [tests, setTests]         = useState<Test[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getTests();
      const withResults = (res.tests || []).filter(
        (t) => (t.analyzer_results?.[0]?.count ?? 0) > 0
      );
      setTests(withResults);
      // Auto-expand first class
      const first = withResults[0]?.class?.trim() || "No Class";
      setExpanded({ [first]: true });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const toggleClass = (cls: string) =>
    setExpanded((prev) => ({ ...prev, [cls]: !prev[cls] }));

  const groups = groupTests(tests);
  const totalResults = tests.reduce(
    (s, t) => s + (t.analyzer_results?.[0]?.count ?? 0), 0
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Corrected Copies</Text>
          {!loading && (
            <Text style={styles.subtitle}>
              {totalResults} answer sheet{totalResults !== 1 ? "s" : ""} · {tests.length} paper{tests.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
        <View style={{ width: 52 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={c.accent} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No corrected copies yet</Text>
          <Text style={styles.emptyText}>
            Scan answer sheets from the home screen and they'll appear here grouped by class and subject.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={c.accent}
            />
          }
        >
          {groups.map(({ cls, subjects }) => {
            const classTotal = subjects.reduce(
              (s, { papers }) =>
                s + papers.reduce((ps, p) => ps + (p.analyzer_results?.[0]?.count ?? 0), 0),
              0
            );
            const isOpen = !!expanded[cls];

            return (
              <View key={cls} style={styles.classBlock}>
                {/* Class header */}
                <TouchableOpacity
                  style={styles.classHeader}
                  onPress={() => toggleClass(cls)}
                  activeOpacity={0.7}
                >
                  <View style={styles.classHeaderLeft}>
                    <Text style={styles.classIcon}>🏫</Text>
                    <View>
                      <Text style={styles.className}>{cls}</Text>
                      <Text style={styles.classMeta}>
                        {subjects.length} subject{subjects.length !== 1 ? "s" : ""} · {classTotal} sheet{classTotal !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
                </TouchableOpacity>

                {/* Subjects + papers */}
                {isOpen && (
                  <View style={styles.classBody}>
                    {subjects.map(({ sub, papers }) => (
                      <View key={sub} style={styles.subjectBlock}>
                        {/* Subject label */}
                        <View style={styles.subjectHeader}>
                          <Text style={styles.subjectDot}>◆</Text>
                          <Text style={styles.subjectName}>{sub}</Text>
                          <Text style={styles.subjectCount}>
                            {papers.reduce((s, p) => s + (p.analyzer_results?.[0]?.count ?? 0), 0)} sheets
                          </Text>
                        </View>

                        {/* Papers under this subject */}
                        {papers.map((paper) => {
                          const count = paper.analyzer_results?.[0]?.count ?? 0;
                          return (
                            <TouchableOpacity
                              key={paper.id}
                              style={styles.paperRow}
                              onPress={() => navigation.navigate("TestResults", { test: paper })}
                              activeOpacity={0.75}
                            >
                              <View style={styles.paperLeft}>
                                <Text style={styles.paperName} numberOfLines={1}>{paper.name}</Text>
                                <Text style={styles.paperMeta}>
                                  {count} answer sheet{count !== 1 ? "s" : ""} · {paper.total_marks} marks
                                </Text>
                              </View>
                              <Text style={styles.paperArrow}>›</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  // Header
  header:         { flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  back:           { fontSize: 14, color: c.accent, minWidth: 52 },
  headerCenter:   { flex: 1, alignItems: "center" },
  title:          { fontSize: 17, fontWeight: "700", color: c.text },
  subtitle:       { fontSize: 11, color: c.textDim, marginTop: 2 },
  // Scroll
  scroll:         { padding: 14, gap: 12, paddingBottom: 32 },
  // Class block
  classBlock:     { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  classHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  classHeaderLeft:{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  classIcon:      { fontSize: 20 },
  className:      { fontSize: 16, fontWeight: "700", color: c.text },
  classMeta:      { fontSize: 12, color: c.textMid, marginTop: 2 },
  chevron:        { fontSize: 22, color: c.textDim, transform: [{ rotate: "0deg" }] },
  chevronOpen:    { transform: [{ rotate: "90deg" }] },
  classBody:      { borderTopWidth: 1, borderTopColor: c.border, paddingBottom: 8 },
  // Subject
  subjectBlock:   { marginTop: 4 },
  subjectHeader:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  subjectDot:     { fontSize: 8, color: c.accent },
  subjectName:    { fontSize: 13, fontWeight: "700", color: c.accent, flex: 1 },
  subjectCount:   { fontSize: 11, color: c.textDim },
  // Paper row
  paperRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
  paperLeft:      { flex: 1 },
  paperName:      { fontSize: 14, fontWeight: "500", color: c.text },
  paperMeta:      { fontSize: 11, color: c.textMid, marginTop: 3 },
  paperArrow:     { fontSize: 20, color: c.textDim, marginLeft: 8 },
  // Empty
  empty:          { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20 },
});
