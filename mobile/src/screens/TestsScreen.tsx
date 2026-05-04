import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Test } from "../lib/api";
import { signOut } from "../lib/auth";
import { c } from "../lib/theme";

export default function TestsScreen({ navigation }: any) {
  const [tests, setTests]       = useState<Test[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits]   = useState<number | null>(null);

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
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const deleteTest = (item: Test) => {
    Alert.alert(
      "Delete test?",
      `"${item.name}" and all its answer sheets will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteTest(item.id);
              setTests((prev) => prev.filter((t) => t.id !== item.id));
            } catch (e: any) {
              Alert.alert("Delete failed", e.message);
            }
          },
        },
      ]
    );
  };

  const renderTest = ({ item }: { item: Test }) => {
    const resultCount = item.analyzer_results?.[0]?.count ?? 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate("Scan", { test: item })}
          activeOpacity={0.75}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.testName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.testMeta}>
              {[item.subject, item.class && `Class ${item.class}`, item.section && `§${item.section}`]
                .filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.testMeta}>
              {resultCount} sheet{resultCount !== 1 ? "s" : ""} analyzed · {item.total_marks} marks
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTest(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📝 My Tests</Text>
          {credits !== null && (
            <Text style={[styles.creditsText, { color: credits > 20 ? c.success : credits > 0 ? c.warning : c.danger }]}>
              💳 {credits} credits
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={c.accent} />
      ) : (
        <FlatList
          data={tests}
          keyExtractor={(t) => t.id}
          renderItem={renderTest}
          contentContainerStyle={tests.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={c.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No tests yet</Text>
              <Text style={styles.emptyText}>Create tests from the web portal, then come back here to scan answer sheets.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle:    { fontSize: 20, fontWeight: "700", color: c.text },
  creditsText:    { fontSize: 12, fontWeight: "600", marginTop: 4 },
  signOut:        { fontSize: 13, color: c.textDim, paddingTop: 4 },
  list:           { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, padding: 16 },
  card:           { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center" },
  cardMain:       { flex: 1, flexDirection: "row", alignItems: "center", padding: 16 },
  cardLeft:       { flex: 1 },
  testName:       { fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 4 },
  testMeta:       { fontSize: 12, color: c.textMid, marginTop: 2 },
  arrow:          { fontSize: 22, color: c.textDim, marginLeft: 8 },
  deleteBtn:      { paddingHorizontal: 14, paddingVertical: 16, borderLeftWidth: 1, borderLeftColor: c.border },
  deleteBtnText:  { fontSize: 18 },
  empty:          { alignItems: "center", paddingTop: 80 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
