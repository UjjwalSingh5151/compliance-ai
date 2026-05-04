/**
 * ResultDetailScreen — mirrors the web app's ResultDetail.
 *
 * Two tabs:
 *   - "Answer Sheet" — opens original_sheet_url in device browser
 *   - "Analysis"    — overall feedback + expandable question-by-question cards
 *
 * Question card fields (matching backend):
 *   q.no, q.marks_awarded, q.marks_available,
 *   q.question, q.student_answer, q.expected_answer, q.reasoning, q.feedback
 */

import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, TextInput, Share, Modal, FlatList,
} from "react-native";
import { WebView } from "react-native-webview";
import { api, Student } from "../lib/api";
import { c } from "../lib/theme";
import { shareUrl } from "../lib/branding";

// ─── Student assign modal ─────────────────────────────────────────────────────
function AssignModal({ resultId, onAssign, onClose }: {
  resultId: string;
  onAssign: (student: Student) => void;
  onClose: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    api.getSchoolStudents()
      .then(({ students }) => setStudents(students || []))
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q
      || (s.name || "").toLowerCase().includes(q)
      || (s.roll_no || "").toLowerCase().includes(q)
      || (s.class || "").toLowerCase().includes(q);
  });

  const assign = async (student: Student) => {
    setAssigning(true);
    try {
      await api.assignResult(resultId, student.id);
      onAssign(student);
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setAssigning(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          {/* Handle + header */}
          <View style={mStyles.handle} />
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>Assign to Student</Text>
            <TouchableOpacity onPress={onClose} style={mStyles.closeBtn}>
              <Text style={mStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={mStyles.searchWrap}>
            <TextInput
              style={mStyles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, roll no or class…"
              placeholderTextColor={c.textDim}
              autoFocus
              autoCorrect={false}
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={mStyles.loadingWrap}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ padding: 12, paddingTop: 4, paddingBottom: 32 }}
              ListEmptyComponent={
                <Text style={mStyles.emptyText}>{search ? "No students match your search" : "No students in CRM"}</Text>
              }
              renderItem={({ item: s }) => (
                <TouchableOpacity
                  style={mStyles.studentRow}
                  onPress={() => assign(s)}
                  disabled={assigning}
                >
                  <View style={mStyles.studentAvatar}>
                    <Text style={mStyles.studentAvatarText}>
                      {(s.name || "?").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.studentName}>{s.name || "Unknown"}</Text>
                    <Text style={mStyles.studentMeta}>
                      {[s.roll_no && `Roll: ${s.roll_no}`, s.class && `Class ${s.class}`].filter(Boolean).join("  ·  ")}
                    </Text>
                  </View>
                  {assigning && <ActivityIndicator size="small" color={c.accent} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ pct }: { pct: number }) {
  const color = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  return (
    <View style={[styles.ring, { borderColor: color, backgroundColor: `${color}15` }]}>
      <Text style={[styles.ringPct, { color }]}>{pct}%</Text>
    </View>
  );
}

// ─── Expandable question card ─────────────────────────────────────────────────
function QuestionCard({ q, comment, onCommentChange, onOverride }: {
  q: any;
  comment: string;
  onCommentChange: (no: string, val: string) => void;
  onOverride: (no: number, marks: number, reason: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideVal, setOverrideVal]   = useState(String(q.marks_awarded));
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const pct = q.marks_available > 0
    ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0;
  const color = pct === 100 ? c.success : pct >= 60 ? c.warning : c.danger;

  const handleSaveOverride = async () => {
    const marks = parseFloat(overrideVal);
    if (isNaN(marks) || marks < 0 || marks > q.marks_available) {
      Alert.alert("Invalid", `Marks must be between 0 and ${q.marks_available}.`);
      return;
    }
    setOverrideSaving(true);
    try {
      await onOverride(q.no, marks, overrideReason.trim());
      setShowOverride(false);
      setOverrideReason("");
    } catch (e: any) {
      Alert.alert("Override failed", e.message);
    } finally {
      setOverrideSaving(false);
    }
  };

  return (
    <View style={styles.qCard}>
      {/* Collapsed header — always visible */}
      <TouchableOpacity style={styles.qHeader} onPress={() => setExpanded((v) => !v)} activeOpacity={0.75}>
        <View style={[styles.qNum, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
          <Text style={[styles.qNumText, { color }]}>Q{q.no}</Text>
        </View>
        <View style={styles.qHeaderMid}>
          {q.feedback ? (
            <Text style={styles.qFeedbackPreview} numberOfLines={1}>{q.feedback}</Text>
          ) : (
            <Text style={styles.qNoFeedback}>No feedback</Text>
          )}
        </View>
        <View style={styles.qHeaderRight}>
          <Text style={[styles.qMarks, { color }]}>{q.marks_awarded}/{q.marks_available}</Text>
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.qBody}>
          {q.question ? (
            <View style={styles.qSection}>
              <Text style={styles.qSectionLabel}>QUESTION</Text>
              <Text style={styles.qSectionText}>{q.question}</Text>
            </View>
          ) : null}

          {q.student_answer ? (
            <View style={styles.qSection}>
              <Text style={styles.qSectionLabel}>STUDENT'S ANSWER</Text>
              <View style={styles.qBox}>
                <Text style={styles.qBoxText}>{q.student_answer}</Text>
              </View>
            </View>
          ) : null}

          {(q.expected_answer || q.reasoning) ? (
            <View style={styles.qSection}>
              <Text style={styles.qSectionLabel}>EXPECTED ANSWER</Text>
              <View style={styles.qBox}>
                {q.expected_answer ? (
                  <Text style={styles.qBoxText}>{q.expected_answer}</Text>
                ) : null}
                {q.reasoning ? (
                  <Text style={[styles.qBoxText, { marginTop: 6, color: c.textDim, fontSize: 12 }]}>
                    {q.reasoning}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.qSection}>
            <Text style={styles.qSectionLabel}>MARKS AWARDED</Text>
            <Text style={[styles.qMarks, { color, fontSize: 16 }]}>
              {q.marks_awarded} / {q.marks_available}
            </Text>
          </View>

          {q.feedback ? (
            <View style={styles.qSection}>
              <Text style={[styles.qSectionLabel, { color: c.success }]}>FEEDBACK TO STUDENT</Text>
              <Text style={[styles.qSectionText, { color: c.textMid }]}>{q.feedback}</Text>
            </View>
          ) : null}

          {/* Teacher comment */}
          <View style={styles.qSection}>
            <Text style={[styles.qSectionLabel, { color: c.purple }]}>TEACHER'S NOTE</Text>
            <TextInput
              style={styles.commentInput}
              value={comment || ""}
              onChangeText={(v) => onCommentChange(String(q.no), v)}
              placeholder="Add a personal note…"
              placeholderTextColor={c.textDim}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Mark override */}
          <View style={styles.qSection}>
            <TouchableOpacity
              style={styles.overrideToggle}
              onPress={() => { setShowOverride((v) => !v); setOverrideVal(String(q.marks_awarded)); }}
            >
              <Text style={styles.overrideToggleText}>
                {showOverride ? "✕ Cancel override" : "✏️ Override marks"}
              </Text>
            </TouchableOpacity>
            {showOverride && (
              <View style={styles.overrideBox}>
                <Text style={styles.qSectionLabel}>OVERRIDE MARKS (max {q.marks_available})</Text>
                <TextInput
                  style={styles.overrideInput}
                  value={overrideVal}
                  onChangeText={setOverrideVal}
                  keyboardType="decimal-pad"
                  placeholder={`0 – ${q.marks_available}`}
                  placeholderTextColor={c.textDim}
                />
                <Text style={[styles.qSectionLabel, { marginTop: 10 }]}>REASON (optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  value={overrideReason}
                  onChangeText={setOverrideReason}
                  placeholder="e.g. Diagram was correct"
                  placeholderTextColor={c.textDim}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  style={[styles.overrideSaveBtn, overrideSaving && { opacity: 0.5 }]}
                  onPress={handleSaveOverride}
                  disabled={overrideSaving}
                >
                  <Text style={styles.overrideSaveBtnText}>
                    {overrideSaving ? "Saving…" : "Save Override"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ResultDetailScreen({ route, navigation }: any) {
  const { resultId, testName } = route.params;
  const [result, setResult]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState<"analysis" | "sheet">("analysis");
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => {
    api.getResult(resultId)
      .then((r) => {
        setResult(r.result);
        setComments(r.result.teacher_comments || {});
        if (r.result.original_sheet_url) setTab("sheet");
      })
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  const saveComments = async () => {
    setSaving(true);
    try { await api.saveComments(resultId, comments); }
    catch (e: any) { Alert.alert("Error saving", e.message); }
    finally { setSaving(false); }
  };

  const handleMarkOverride = async (questionNo: number, marks: number, reason: string) => {
    await api.saveMarkOverride(resultId, questionNo, marks, reason);
    // Patch local state so UI reflects new marks immediately
    setResult((prev: any) => {
      if (!prev?.analysis?.questions) return prev;
      const questions = prev.analysis.questions.map((q: any) =>
        q.no === questionNo ? { ...q, marks_awarded: marks } : q
      );
      const marks_obtained = questions.reduce((sum: number, q: any) => sum + (q.marks_awarded || 0), 0);
      return { ...prev, marks_obtained, analysis: { ...prev.analysis, questions } };
    });
  };

  const shareResult = () => {
    if (!result?.share_token) return;
    const url = shareUrl(result.share_token);
    Share.share({ message: url, url });
  };

  // Build inline viewer URL — PDFs use Google Docs Viewer for inline rendering
  const sheetViewerUrl = (url: string) => {
    const isPDF = /\.pdf($|\?)/i.test(url) || url.includes("application%2Fpdf");
    return isPDF
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      : url;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: c.danger }}>Could not load result.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: c.accent }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const a          = result.analysis || {};
  const student    = result.analyzer_students || {};
  const test       = result.analyzer_tests || {};
  const obtained   = result.marks_obtained ?? 0;
  const total      = result.total_marks ?? test.total_marks ?? 0;
  const pct        = total ? Math.round((obtained / total) * 100) : 0;
  const scoreColor = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;
  const questions: any[] = a.questions || [];
  const hasSheet   = !!result.original_sheet_url;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {test.name || testName || "Result"}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {result?.share_token && (
            <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
              <Text style={styles.shareBtnText}>🔗</Text>
            </TouchableOpacity>
          )}
          {questions.length > 0 && (
            <TouchableOpacity
              style={[styles.saveBtn, { opacity: saving ? 0.5 : 1 }]}
              onPress={saveComments}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          )}
        </View>
        {!result?.share_token && questions.length === 0 && <View style={{ width: 52 }} />}
      </View>

      {/* Tab bar — only if there's a sheet */}
      {hasSheet && (
        <View style={styles.tabBar}>
          {(["sheet", "analysis"] as const).map((t) => (
            <TouchableOpacity key={t} style={styles.tabBtn} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "sheet" ? "Answer Sheet" : "Analysis"}
              </Text>
              {tab === t && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Answer Sheet tab — inline WebView */}
      {tab === "sheet" && hasSheet && (
        <WebView
          source={{ uri: sheetViewerUrl(result.original_sheet_url) }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, { flex: 1 }]}>
              <ActivityIndicator color={c.accent} />
              <Text style={{ color: c.textDim, marginTop: 10, fontSize: 12 }}>Loading sheet…</Text>
            </View>
          )}
        />
      )}

      {/* Assign modal */}
      {showAssign && (
        <AssignModal
          resultId={resultId}
          onAssign={(s) => {
            setResult((r: any) => ({ ...r, student_id: s.id, analyzer_students: s }));
            setShowAssign(false);
          }}
          onClose={() => setShowAssign(false)}
        />
      )}

      {/* Analysis tab */}
      {tab === "analysis" && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Score card */}
          <View style={styles.scoreCard}>
            <ScoreRing pct={pct} />
            <View style={styles.scoreInfo}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={[styles.studentName, { marginBottom: 0 }]}>
                  {student.name || a.student?.name || "Unknown student"}
                </Text>
                {!result.student_id && (
                  <View style={styles.unassignedBadge}>
                    <Text style={styles.unassignedText}>Unassigned</Text>
                  </View>
                )}
              </View>
              <View style={styles.metaRow}>
                {(student.roll_no || a.student?.roll_no) && (
                  <Text style={styles.metaChip}>Roll: {student.roll_no || a.student?.roll_no}</Text>
                )}
                {(student.class || a.student?.class) && (
                  <Text style={styles.metaChip}>Class {student.class || a.student?.class}</Text>
                )}
              </View>
              <Text style={[styles.bigMarks, { color: scoreColor }]}>
                {obtained} <Text style={styles.bigMarksTotal}>/ {total} marks</Text>
              </Text>
              {/* Assign button */}
              <TouchableOpacity style={styles.assignBtn} onPress={() => setShowAssign(true)}>
                <Text style={styles.assignBtnText}>
                  {result.student_id ? "👤 Reassign" : "👤 Assign to student"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Switch to sheet tab */}
          {hasSheet && (
            <TouchableOpacity style={styles.sheetLink} onPress={() => setTab("sheet")}>
              <Text style={styles.sheetLinkText}>📄 View Answer Sheet</Text>
            </TouchableOpacity>
          )}

          {/* Overall feedback + strengths + improvements */}
          {(a.overall_feedback || a.strengths?.length > 0 || a.improvement_areas?.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>OVERALL FEEDBACK</Text>
              {a.overall_feedback && (
                <Text style={styles.bodyText}>{a.overall_feedback}</Text>
              )}
              {a.strengths?.map((s: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: c.success }]}>✓</Text>
                  <Text style={[styles.bulletText, { color: c.success }]}>{s}</Text>
                </View>
              ))}
              {a.improvement_areas?.map((s: string, i: number) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: c.warning }]}>→</Text>
                  <Text style={[styles.bulletText, { color: c.warning }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Question-by-question breakdown */}
          {questions.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>
                QUESTION-WISE BREAKDOWN — tap to expand
              </Text>
              {questions.map((q: any) => (
                <QuestionCard
                  key={q.no}
                  q={q}
                  comment={comments[String(q.no)] || ""}
                  onCommentChange={(no, val) =>
                    setComments((prev) => ({ ...prev, [no]: val }))
                  }
                  onOverride={handleMarkOverride}
                />
              ))}
            </View>
          )}

          {/* Parse error */}
          {a.parse_error && (
            <View style={[styles.section, { borderColor: `${c.warning}40` }]}>
              <Text style={[styles.sectionLabel, { color: c.warning }]}>⚠ PARSE WARNING</Text>
              <Text style={styles.bodyText}>
                AI could not fully read this sheet. Try retaking photos with better lighting
                and flat pages.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: c.bg },
  center:           { alignItems: "center", justifyContent: "center" },
  scroll:           { padding: 14, paddingBottom: 40 },
  // Header
  header:           { flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  back:             { fontSize: 14, color: c.accent, minWidth: 52 },
  headerTitle:      { flex: 1, fontSize: 15, fontWeight: "700", color: c.text, textAlign: "center" },
  saveBtn:          { backgroundColor: `${c.purple}25`, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: `${c.purple}50` },
  saveBtnText:      { fontSize: 12, color: c.purple, fontWeight: "700" },
  shareBtn:         { width: 34, height: 34, borderRadius: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  shareBtnText:     { fontSize: 16 },
  // Tabs
  tabBar:           { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border },
  tabBtn:           { flex: 1, alignItems: "center", paddingVertical: 11 },
  tabText:          { fontSize: 13, color: c.textDim },
  tabTextActive:    { color: c.accent, fontWeight: "600" },
  tabUnderline:     { height: 2, width: 60, backgroundColor: c.accent, borderRadius: 1, marginTop: 8 },
  // Score card
  scoreCard:        { flexDirection: "row", backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 12, gap: 14, alignItems: "center" },
  ring:             { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ringPct:          { fontSize: 18, fontWeight: "800" },
  scoreInfo:        { flex: 1 },
  studentName:      { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 4 },
  metaRow:          { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  metaChip:         { fontSize: 11, color: c.textMid, backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  bigMarks:         { fontSize: 22, fontWeight: "800" },
  bigMarksTotal:    { fontSize: 13, fontWeight: "400", color: c.textMid },
  // Sheet link
  sheetLink:        { backgroundColor: `${c.accent}12`, borderRadius: 10, padding: 12, marginBottom: 12, alignItems: "center", borderWidth: 1, borderColor: `${c.accent}30` },
  sheetLinkText:    { fontSize: 14, color: c.accent, fontWeight: "600" },
  openSheetBtn:     { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 14 },
  openSheetBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Sections
  section:          { backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  sectionLabel:     { fontSize: 11, fontWeight: "700", color: c.textMid, letterSpacing: 0.8 },
  bodyText:         { fontSize: 13, color: c.text, lineHeight: 20, marginTop: 6 },
  bulletRow:        { flexDirection: "row", gap: 8, marginTop: 6 },
  bullet:           { fontSize: 14, width: 16, lineHeight: 20 },
  bulletText:       { fontSize: 13, lineHeight: 20, flex: 1 },
  // Question card
  qCard:            { borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  qHeader:          { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: c.card, gap: 10 },
  qNum:             { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  qNumText:         { fontSize: 12, fontWeight: "700" },
  qHeaderMid:       { flex: 1 },
  qFeedbackPreview: { fontSize: 12, color: c.textMid },
  qNoFeedback:      { fontSize: 12, color: c.textDim, fontStyle: "italic" },
  qHeaderRight:     { flexDirection: "row", alignItems: "center", gap: 8 },
  qMarks:           { fontSize: 13, fontWeight: "700" },
  chevron:          { fontSize: 11, color: c.textDim },
  qBody:            { padding: 14, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border, gap: 12 },
  qSection:         { gap: 4 },
  qSectionLabel:    { fontSize: 11, fontWeight: "700", color: c.textDim, letterSpacing: 0.5 },
  qSectionText:     { fontSize: 13, color: c.text, lineHeight: 20 },
  qBox:             { backgroundColor: c.card, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  qBoxText:         { fontSize: 13, color: c.textMid, lineHeight: 20 },
  commentInput:     { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, fontSize: 13, color: c.text, minHeight: 60, textAlignVertical: "top", fontFamily: "System" },
  overrideToggle:   { alignSelf: "flex-start", backgroundColor: `${c.warning}15`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${c.warning}40` },
  overrideToggleText: { fontSize: 12, color: c.warning, fontWeight: "600" },
  overrideBox:      { marginTop: 10, gap: 6 },
  overrideInput:    { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, fontSize: 20, fontWeight: "700", color: c.text, textAlign: "center", marginTop: 4 },
  overrideSaveBtn:  { backgroundColor: c.warning, borderRadius: 8, padding: 10, alignItems: "center", marginTop: 10 },
  overrideSaveBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },
  purple:           c.purple,
  // Unassigned badge + assign button
  unassignedBadge:  { backgroundColor: `${c.warning}20`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${c.warning}40` },
  unassignedText:   { fontSize: 10, color: c.warning, fontWeight: "700" },
  assignBtn:        { marginTop: 8, alignSelf: "flex-start", backgroundColor: `${c.accent}15`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${c.accent}40` },
  assignBtnText:    { fontSize: 12, color: c.accent, fontWeight: "600" },
});

// ─── Assign modal styles ──────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet:            { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", borderWidth: 1, borderColor: c.border },
  handle:           { width: 40, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  sheetTitle:       { fontSize: 15, fontWeight: "700", color: c.text },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
  closeBtnText:     { fontSize: 14, color: c.textMid },
  searchWrap:       { padding: 12, paddingBottom: 4 },
  searchInput:      { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 11, fontSize: 14, color: c.text },
  loadingWrap:      { padding: 32, alignItems: "center" },
  emptyText:        { textAlign: "center", color: c.textDim, fontSize: 13, padding: 24 },
  studentRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, marginBottom: 8, backgroundColor: c.bg },
  studentAvatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentDim, alignItems: "center", justifyContent: "center" },
  studentAvatarText:{ fontSize: 12, fontWeight: "700", color: c.accent },
  studentName:      { fontSize: 14, fontWeight: "600", color: c.text },
  studentMeta:      { fontSize: 12, color: c.textMid, marginTop: 2 },
});
