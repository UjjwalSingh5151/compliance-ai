/**
 * TestResultsScreen — all scanned notebooks for one test.
 * Header has a "Scan Answer Sheet" button.
 * Tapping a result opens ResultDetailScreen.
 */

import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Share,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";
import { c } from "../lib/theme";
import { shareUrl } from "../lib/branding";

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
  const [results, setResults]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit student modal
  const [editingResult, setEditingResult] = useState<any | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editRoll,  setEditRoll]  = useState("");
  const [editClass, setEditClass] = useState("");
  const [saving,    setSaving]    = useState(false);

  const deleteResult = (item: any) => {
    const name = item.analyzer_students?.name || item.analysis?.student?.name || "this result";
    Alert.alert(
      "Delete answer sheet?",
      `"${name}" will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteResult(item.id);
              setResults((prev) => prev.filter((r) => r.id !== item.id));
            } catch (e: any) {
              Alert.alert("Delete failed", e.message);
            }
          },
        },
      ]
    );
  };

  const openEdit = (item: any) => {
    const s = item.analyzer_students;
    const a = item.analysis?.student;
    setEditName( s?.name  || a?.name  || "");
    setEditRoll( s?.roll_no || a?.roll_no || "");
    setEditClass(s?.class || a?.class || "");
    setEditingResult(item);
  };

  const saveEdit = async () => {
    if (!editingResult) return;
    setSaving(true);
    try {
      const name  = editName.trim();
      const roll  = editRoll.trim();
      const cls   = editClass.trim();

      if (editingResult.student_id) {
        // Update existing linked student
        await api.updateStudent(editingResult.student_id, {
          name: name || undefined,
          roll_no: roll || undefined,
          class: cls || undefined,
        });
      } else {
        // No student yet — create one and link it to this result
        const { student } = await api.createStudent({ name, roll_no: roll || undefined, class: cls || undefined });
        await api.assignResult(editingResult.id, student.id);
      }

      // Update local state so list refreshes immediately
      setResults((prev) => prev.map((r) =>
        r.id !== editingResult.id ? r : {
          ...r,
          student_id: r.student_id || "assigned",
          analyzer_students: { ...(r.analyzer_students || {}), name, roll_no: roll, class: cls },
          analysis: { ...(r.analysis || {}), student: { ...(r.analysis?.student || {}), name, roll_no: roll, class: cls } },
        }
      ));
      setEditingResult(null);
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

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

    const shareResult = () => {
      const url = shareUrl(item.share_token);
      Share.share({ message: url, url });
    };

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate("ResultDetail", { resultId: item.id, testName: test.name })}
          activeOpacity={0.75}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.studentName}>{name}</Text>
            {roll && <Text style={styles.meta}>Roll: {roll}</Text>}
            {date && <Text style={styles.meta}>{date}</Text>}
          </View>
          <View style={styles.cardRight}>
            <ScoreBadge obtained={item.marks_obtained} total={item.total_marks || test.total_marks} />
            {item.share_token && (
              <TouchableOpacity style={styles.shareIconBtn} onPress={shareResult} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.shareIconText}>🔗</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.actionBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => deleteResult(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.actionBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
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
        {/* Insights button */}
        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: `${c.purple}18`, borderColor: `${c.purple}40`, marginRight: 6 }]}
          onPress={() => navigation.navigate("Insights", { testId: test.id, testName: test.name })}
        >
          <Text style={[styles.scanBtnText, { color: c.purple }]}>📊</Text>
        </TouchableOpacity>
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

      {/* ── Edit student modal ── */}
      <Modal visible={!!editingResult} transparent animationType="slide" onRequestClose={() => setEditingResult(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Student Details</Text>
            <Text style={styles.modalHint}>AI couldn't read these automatically — fill them in manually.</Text>

            <Text style={styles.fieldLabel}>Student Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={c.textDim}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Roll No</Text>
            <TextInput
              style={styles.fieldInput}
              value={editRoll}
              onChangeText={setEditRoll}
              placeholder="e.g. 42"
              placeholderTextColor={c.textDim}
              keyboardType="default"
            />

            <Text style={styles.fieldLabel}>Class</Text>
            <TextInput
              style={styles.fieldInput}
              value={editClass}
              onChangeText={setEditClass}
              placeholder="e.g. 8A"
              placeholderTextColor={c.textDim}
              autoCapitalize="characters"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingResult(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, saving && { opacity: 0.5 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  card:           { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  cardMain:       { flex: 1, flexDirection: "row", alignItems: "center", padding: 16 },
  cardLeft:       { flex: 1 },
  cardRight:      { alignItems: "flex-end", gap: 8 },
  cardActions:    { borderLeftWidth: 1, borderLeftColor: c.border, justifyContent: "center" },
  actionBtn:      { paddingHorizontal: 13, paddingVertical: 14 },
  actionBtnText:  { fontSize: 17 },
  // Edit modal
  modalOverlay:   { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  modalSheet:     { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 4 },
  modalHint:      { fontSize: 12, color: c.textDim, marginBottom: 20, lineHeight: 18 },
  fieldLabel:     { fontSize: 12, fontWeight: "600", color: c.textMid, marginBottom: 6, marginTop: 14 },
  fieldInput:     { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, fontSize: 14, color: c.text },
  modalBtns:      { flexDirection: "row", gap: 10, marginTop: 24 },
  modalCancel:    { flex: 1, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, alignItems: "center" },
  modalCancelText:{ fontSize: 14, fontWeight: "600", color: c.textMid },
  modalSave:      { flex: 2, backgroundColor: c.accent, borderRadius: 10, padding: 14, alignItems: "center" },
  modalSaveText:  { fontSize: 14, fontWeight: "700", color: "#fff" },
  shareIconBtn:   { padding: 4 },
  shareIconText:  { fontSize: 18 },
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
