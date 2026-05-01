/**
 * SelectTestScreen — shown when teacher taps "Add Notebook to Existing Paper".
 * Lists all tests; tapping one opens ScanScreen for that test.
 */

import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, Test } from "../lib/api";
import { c } from "../lib/theme";

export default function SelectTestScreen({ navigation }: any) {
  const [tests, setTests]         = useState<Test[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.getTests();
      setTests(res.tests || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, []));

  const renderTest = ({ item }: { item: Test }) => {
    const count = item.analyzer_results?.[0]?.count ?? 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("Scan", { test: item })}
        activeOpacity={0.75}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.testName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.testMeta}>
            {[item.subject, item.class && `Class ${item.class}`].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.testMeta}>
            {count} notebook{count !== 1 ? "s" : ""} scanned · {item.total_marks} marks
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Paper</Text>
        <View style={{ width: 56 }} />
      </View>

      <Text style={styles.hint}>Tap a paper to scan notebooks for it</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={c.accent} />
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
                Use "New Paper" on the home screen to create your first test.
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
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  backText:       { fontSize: 14, color: c.accent },
  title:          { fontSize: 17, fontWeight: "700", color: c.text },
  hint:           { fontSize: 12, color: c.textDim, padding: 14, paddingBottom: 6 },
  list:           { padding: 14, gap: 10 },
  emptyContainer: { flex: 1 },
  card:           { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border },
  testName:       { fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 4 },
  testMeta:       { fontSize: 12, color: c.textMid, marginTop: 2 },
  arrow:          { fontSize: 22, color: c.textDim, marginLeft: 8 },
  empty:          { alignItems: "center", paddingTop: 80 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 8 },
  emptyText:      { fontSize: 13, color: c.textMid, textAlign: "center", lineHeight: 20, paddingHorizontal: 32 },
});
