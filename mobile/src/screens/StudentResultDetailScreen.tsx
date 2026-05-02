import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert,
} from "react-native";
import WebView from "react-native-webview";
import { api } from "../lib/api";
import { c } from "../lib/theme";

type Tab = "analysis" | "sheet" | "notes" | "practice";

export default function StudentResultDetailScreen({ route, navigation }: any) {
  const { resultId, initialTab } = route.params;

  const [result, setResult]           = useState<any>(null);
  const [practiceSetId, setPracticeSetId] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<Tab>(initialTab || "analysis");

  // Notes state
  const [notes, setNotes]             = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  // Practice state
  const [questions, setQuestions]     = useState<any[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [answers, setAnswers]         = useState<Record<number, string>>({});
  const [submitted, setSubmitted]     = useState(false);
  const [practiceResult, setPracticeResult] = useState<any>(null);

  useEffect(() => {
    api.getStudentResult(resultId)
      .then(({ result, practiceSet }) => {
        setResult(result);
        setNotes(result.revision_notes || null);
        if (practiceSet) {
          setPracticeSetId(practiceSet.id);
          setQuestions(practiceSet.questions || []);
        }
      })
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setLoading(false));
  }, [resultId]);

  // ── Notes handlers ────────────────────────────────────────────────────────
  const handleGenerateNotes = async () => {
    setNotesLoading(true);
    try {
      const { notes } = await api.generateRevisionNotes(resultId);
      setNotes(notes);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setNotesLoading(false);
    }
  };

  // ── Practice handlers ─────────────────────────────────────────────────────
  const handleGeneratePractice = async (refresh = false) => {
    setPracticeLoading(true);
    setSubmitted(false);
    setPracticeResult(null);
    setAnswers({});
    try {
      const res = await api.generatePracticeQuestions(resultId, refresh);
      setPracticeSetId(res.practiceSetId);
      setQuestions(res.questions || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleSubmitPractice = async () => {
    if (!practiceSetId) return;
    const unanswered = questions.filter((q) => !answers[q.no]);
    if (unanswered.length > 0) {
      Alert.alert("Incomplete", `Please answer all questions (${unanswered.length} remaining).`);
      return;
    }
    setPracticeLoading(true);
    try {
      const payload = questions.map((q) => ({ no: q.no, selected: answers[q.no] }));
      const res = await api.submitPracticeAttempt(practiceSetId, payload);
      setPracticeResult(res);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setPracticeLoading(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={c.accent} size="large" /></View>;
  }
  if (!result) {
    return <View style={styles.center}><Text style={styles.errorText}>Result not found</Text></View>;
  }

  const analysis   = result.analysis || {};
  const student    = result.analyzer_students || analysis.student || {};
  const test       = result.analyzer_tests || {};
  const questions2: any[] = analysis.questions || [];
  const pct = result.total_marks > 0
    ? Math.round((result.marks_obtained / result.total_marks) * 100) : 0;
  const hasSheet   = !!result.original_sheet_url;
  const sheetUrl   = hasSheet
    ? result.original_sheet_url.match(/\.(pdf)(\?|$)/i)
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(result.original_sheet_url)}&embedded=true`
      : result.original_sheet_url
    : null;

  // Build tab list
  const tabs: { id: Tab; label: string }[] = [
    { id: "analysis",  label: "📊 Analysis" },
    ...(hasSheet ? [{ id: "sheet" as Tab, label: "📄 Sheet" }] : []),
    { id: "notes",    label: "📝 Notes" },
    { id: "practice", label: "🎯 Practice" },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{test.name || "Result"}</Text>
          {test.subject && <Text style={styles.headerSub}>{test.subject}</Text>}
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
      >
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── SHEET tab ─────────────────────────────────────────────────────── */}
      {tab === "sheet" && sheetUrl ? (
        <WebView
          source={{ uri: sheetUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={c.accent} />
              <Text style={styles.loadingText}>Loading answer sheet…</Text>
            </View>
          )}
        />
      ) : tab === "notes" ? (
        /* ── NOTES tab ──────────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {notesLoading ? (
            <View style={styles.generatingBox}>
              <ActivityIndicator color={c.purple} />
              <Text style={styles.generatingText}>
                Claude is writing your revision notes…{"\n"}This takes ~20 seconds.
              </Text>
            </View>
          ) : notes ? (
            <>
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{notes}</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${c.purple}20`, borderColor: `${c.purple}50` }]}
                onPress={handleGenerateNotes}
              >
                <Text style={[styles.actionButtonText, { color: c.purple }]}>🔄 Regenerate Notes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabEmoji}>📝</Text>
              <Text style={styles.emptyTabTitle}>Revision Notes</Text>
              <Text style={styles.emptyTabText}>
                Claude will read your exam results and write personalised revision notes
                explaining every concept you missed — with memory tips and examples.
              </Text>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: `${c.purple}20`, borderColor: `${c.purple}50` }]} onPress={handleGenerateNotes}>
                <Text style={[styles.actionButtonText, { color: c.purple }]}>📝 Generate Revision Notes</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : tab === "practice" ? (
        /* ── PRACTICE tab ───────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {practiceLoading ? (
            <View style={styles.generatingBox}>
              <ActivityIndicator color={c.success} />
              <Text style={styles.generatingText}>
                {submitted ? "Submitting…" : "Claude is generating 8 practice questions…\nThis takes ~20 seconds."}
              </Text>
            </View>
          ) : submitted && practiceResult ? (
            /* Results screen */
            <PracticeResults
              result={practiceResult}
              questions={questions}
              answers={answers}
              onRetry={() => handleGeneratePractice(true)}
            />
          ) : questions.length > 0 ? (
            /* Quiz screen */
            <>
              <View style={styles.quizHeader}>
                <Text style={styles.quizTitle}>🎯 Practice Quiz</Text>
                <Text style={styles.quizSub}>
                  {Object.keys(answers).length}/{questions.length} answered
                </Text>
              </View>
              {questions.map((q: any) => (
                <MCQCard
                  key={q.no}
                  q={q}
                  selected={answers[q.no]}
                  onSelect={(opt) => setAnswers((prev) => ({ ...prev, [q.no]: opt }))}
                />
              ))}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  Object.keys(answers).length < questions.length && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmitPractice}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>
                  Submit ({Object.keys(answers).length}/{questions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${c.success}15`, borderColor: `${c.success}40`, marginTop: 8 }]}
                onPress={() => handleGeneratePractice(true)}
              >
                <Text style={[styles.actionButtonText, { color: c.success }]}>🔄 New Questions</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Generate screen */
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabEmoji}>🎯</Text>
              <Text style={styles.emptyTabTitle}>Practice Questions</Text>
              <Text style={styles.emptyTabText}>
                Claude will generate 8 multiple-choice questions targeting
                the specific concepts you got wrong in this test.
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${c.success}20`, borderColor: `${c.success}50` }]}
                onPress={() => handleGeneratePractice()}
              >
                <Text style={[styles.actionButtonText, { color: c.success }]}>🎯 Generate Practice Questions</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ── ANALYSIS tab ───────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Score card */}
          <View style={styles.scoreCard}>
            <View style={[styles.ring, { borderColor: pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger }]}>
              <Text style={[styles.ringPct, { color: pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger }]}>{pct}%</Text>
              <Text style={styles.ringMarks}>{result.marks_obtained}/{result.total_marks}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name || "Student"}</Text>
              {student.roll_no && <Text style={styles.chip}>Roll {student.roll_no}</Text>}
              {(student.class || student.section) && (
                <Text style={styles.chip}>
                  {[student.class && `Class ${student.class}`, student.section].filter(Boolean).join(" · ")}
                </Text>
              )}
              {hasSheet && (
                <TouchableOpacity style={styles.viewSheetBtn} onPress={() => setTab("sheet")}>
                  <Text style={styles.viewSheetText}>📄 View Answer Sheet</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {analysis.overall_feedback && (
            <Section title="Overall Feedback">
              <Text style={styles.feedbackText}>{analysis.overall_feedback}</Text>
            </Section>
          )}
          {(analysis.strengths || []).length > 0 && (
            <Section title="✓ Strengths">
              {analysis.strengths.map((s: string, i: number) => (
                <Bullet key={i} text={s} color={c.success} />
              ))}
            </Section>
          )}
          {(analysis.improvement_areas || []).length > 0 && (
            <Section title="→ Areas to Improve">
              {analysis.improvement_areas.map((a: string, i: number) => (
                <Bullet key={i} text={a} color={c.warning} />
              ))}
            </Section>
          )}
          {questions2.length > 0 && (
            <Section title="Question Breakdown">
              {questions2.map((q: any) => <QuestionCard key={q.no} q={q} />)}
            </Section>
          )}

          {/* Quick access to other tabs */}
          <View style={styles.quickAccess}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: `${c.purple}40`, backgroundColor: `${c.purple}12` }]}
              onPress={() => setTab("notes")}
            >
              <Text style={styles.quickBtnIcon}>📝</Text>
              <Text style={[styles.quickBtnLabel, { color: c.purple }]}>
                {notes ? "View Notes" : "Generate Notes"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: `${c.success}40`, backgroundColor: `${c.success}12` }]}
              onPress={() => setTab("practice")}
            >
              <Text style={styles.quickBtnIcon}>🎯</Text>
              <Text style={[styles.quickBtnLabel, { color: c.success }]}>
                {questions.length > 0 ? "Continue Practice" : "Practice Quiz"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletDot, { color }]}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function QuestionCard({ q }: { q: any }) {
  const [open, setOpen] = useState(false);
  const awarded = q.marks_awarded ?? 0;
  const available = q.marks_available ?? 0;
  const color = awarded >= available ? c.success : awarded === 0 ? c.danger : c.warning;

  return (
    <TouchableOpacity style={styles.qCard} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
      <View style={styles.qHeader}>
        <Text style={styles.qNum}>Q{q.no}</Text>
        <Text style={styles.qPreview} numberOfLines={open ? undefined : 1}>
          {q.feedback || q.question || ""}
        </Text>
        <Text style={[styles.qMarks, { color }]}>{awarded}/{available}</Text>
        <Text style={styles.qChevron}>{open ? "▲" : "▼"}</Text>
      </View>
      {open && (
        <View style={styles.qBody}>
          {q.question      && <QField label="QUESTION"        value={q.question} />}
          {q.student_answer && <QField label="YOUR ANSWER"    value={q.student_answer} />}
          {q.expected_answer && <QField label="EXPECTED ANSWER" value={q.expected_answer} color={c.success} />}
          {q.reasoning     && <QField label="REASONING"       value={q.reasoning} />}
          {q.feedback      && <QField label="FEEDBACK"        value={q.feedback} color={c.accent} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

function QField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function MCQCard({ q, selected, onSelect }: {
  q: any; selected: string | undefined; onSelect: (opt: string) => void;
}) {
  const options: string[] = q.options || [];
  return (
    <View style={styles.mcqCard}>
      <Text style={styles.mcqQuestion}>Q{q.no}. {q.question}</Text>
      {options.map((opt, i) => {
        const letter = ["A", "B", "C", "D"][i];
        const isSelected = selected === letter;
        return (
          <TouchableOpacity
            key={letter}
            style={[styles.mcqOption, isSelected && styles.mcqOptionSelected]}
            onPress={() => onSelect(letter)}
            activeOpacity={0.75}
          >
            <View style={[styles.mcqRadio, isSelected && styles.mcqRadioSelected]}>
              {isSelected && <View style={styles.mcqRadioDot} />}
            </View>
            <Text style={[styles.mcqOptionText, isSelected && styles.mcqOptionTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PracticeResults({ result, questions, answers, onRetry }: {
  result: any; questions: any[]; answers: Record<number, string>; onRetry: () => void;
}) {
  const pct = Math.round((result.score / result.total) * 100);
  const color = pct >= 75 ? c.success : pct >= 40 ? c.warning : c.danger;
  return (
    <>
      <View style={[styles.resultBanner, { borderColor: color, backgroundColor: `${color}15` }]}>
        <Text style={[styles.resultScore, { color }]}>{result.score}/{result.total}</Text>
        <Text style={[styles.resultPct, { color }]}>{pct}% correct</Text>
        <Text style={styles.resultLabel}>
          {pct >= 75 ? "Great work! 🎉" : pct >= 40 ? "Good effort! Keep practising 💪" : "Keep studying — you've got this! 📚"}
        </Text>
      </View>

      {(result.results || []).map((r: any) => {
        const q = questions.find((q) => q.no === r.no);
        const correct = r.correct;
        return (
          <View key={r.no} style={[styles.resultRow, { borderLeftColor: correct ? c.success : c.danger }]}>
            <Text style={styles.resultQNum}>Q{r.no}</Text>
            <View style={{ flex: 1 }}>
              {q?.question && <Text style={styles.resultQText} numberOfLines={2}>{q.question}</Text>}
              <Text style={[styles.resultAnswer, { color: correct ? c.success : c.danger }]}>
                Your answer: {r.selected || "—"}  {correct ? "✓" : "✗"}
              </Text>
              {!correct && r.correctAnswer && (
                <Text style={[styles.resultAnswer, { color: c.success }]}>
                  Correct: {r.correctAnswer}
                </Text>
              )}
              {r.explanation && <Text style={styles.resultExplanation}>{r.explanation}</Text>}
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: `${c.success}20`, borderColor: `${c.success}50`, marginTop: 16 }]}
        onPress={onRetry}
      >
        <Text style={[styles.actionButtonText, { color: c.success }]}>🔄 Try New Questions</Text>
      </TouchableOpacity>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: c.bg },
  center:             { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
  errorText:          { color: c.textMid, fontSize: 15 },
  loadingText:        { color: c.textMid, marginTop: 10, fontSize: 13 },
  // Header
  header:             { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn:            { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backArrow:          { fontSize: 22, color: c.accent },
  headerTitle:        { fontSize: 16, fontWeight: "700", color: c.text },
  headerSub:          { fontSize: 12, color: c.textMid, marginTop: 1 },
  // Tab bar
  tabScroll:          { borderBottomWidth: 1, borderBottomColor: c.border, maxHeight: 44, flexGrow: 0 },
  tabScrollContent:   { paddingHorizontal: 12 },
  tab:                { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive:          { borderBottomColor: c.accent },
  tabText:            { fontSize: 13, fontWeight: "600", color: c.textMid },
  tabTextActive:      { color: c.accent },
  // Scroll content
  scrollContent:      { padding: 16, gap: 16 },
  // Score card
  scoreCard:          { flexDirection: "row", alignItems: "center", gap: 16, padding: 20, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  ring:               { width: 88, height: 88, borderRadius: 44, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ringPct:            { fontSize: 22, fontWeight: "800" },
  ringMarks:          { fontSize: 12, color: c.textMid, marginTop: 2 },
  studentInfo:        { flex: 1, gap: 4 },
  studentName:        { fontSize: 17, fontWeight: "700", color: c.text },
  chip:               { fontSize: 12, color: c.textMid },
  viewSheetBtn:       { marginTop: 6, alignSelf: "flex-start", backgroundColor: c.accentDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  viewSheetText:      { fontSize: 12, color: c.accent, fontWeight: "600" },
  // Sections
  section:            { gap: 8 },
  sectionTitle:       { fontSize: 12, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  feedbackText:       { fontSize: 14, color: c.text, lineHeight: 22 },
  bullet:             { flexDirection: "row", gap: 8 },
  bulletDot:          { fontSize: 16, lineHeight: 22 },
  bulletText:         { flex: 1, fontSize: 14, color: c.text, lineHeight: 22 },
  // Q cards
  qCard:              { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  qHeader:            { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  qNum:               { fontSize: 13, fontWeight: "700", color: c.textMid, minWidth: 28 },
  qPreview:           { flex: 1, fontSize: 13, color: c.text },
  qMarks:             { fontSize: 13, fontWeight: "700" },
  qChevron:           { fontSize: 10, color: c.textDim, marginLeft: 4 },
  qBody:              { padding: 12, paddingTop: 0, gap: 10 },
  fieldRow:           { gap: 4 },
  fieldLabel:         { fontSize: 10, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue:         { fontSize: 14, color: c.text, lineHeight: 20 },
  // Quick access
  quickAccess:        { flexDirection: "row", gap: 10 },
  quickBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  quickBtnIcon:       { fontSize: 18 },
  quickBtnLabel:      { fontSize: 13, fontWeight: "700" },
  // Notes
  notesBox:           { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16 },
  notesText:          { fontSize: 14, color: c.text, lineHeight: 24 },
  // Generating
  generatingBox:      { alignItems: "center", paddingVertical: 48, gap: 16 },
  generatingText:     { fontSize: 14, color: c.textMid, textAlign: "center", lineHeight: 22 },
  // Empty tab
  emptyTab:           { alignItems: "center", paddingTop: 32, gap: 12 },
  emptyTabEmoji:      { fontSize: 48 },
  emptyTabTitle:      { fontSize: 18, fontWeight: "700", color: c.text },
  emptyTabText:       { fontSize: 14, color: c.textMid, textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  // Action button
  actionButton:       { borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  actionButtonText:   { fontSize: 15, fontWeight: "700" },
  // MCQ
  mcqCard:            { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 },
  mcqQuestion:        { fontSize: 14, fontWeight: "600", color: c.text, lineHeight: 22 },
  mcqOption:          { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  mcqOptionSelected:  { borderColor: c.accent, backgroundColor: `${c.accent}12` },
  mcqRadio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  mcqRadioSelected:   { borderColor: c.accent },
  mcqRadioDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  mcqOptionText:      { flex: 1, fontSize: 13, color: c.textMid, lineHeight: 20 },
  mcqOptionTextSelected: { color: c.text, fontWeight: "600" },
  // Submit
  submitBtn:          { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnDisabled:  { opacity: 0.5 },
  submitBtnText:      { fontSize: 15, fontWeight: "700", color: "#fff" },
  // Quiz header
  quizHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quizTitle:          { fontSize: 16, fontWeight: "700", color: c.text },
  quizSub:            { fontSize: 13, color: c.textMid },
  // Practice results
  resultBanner:       { borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: "center", gap: 4 },
  resultScore:        { fontSize: 32, fontWeight: "800" },
  resultPct:          { fontSize: 16, fontWeight: "700" },
  resultLabel:        { fontSize: 14, color: c.textMid, marginTop: 4 },
  resultRow:          { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, borderLeftWidth: 4, padding: 12, gap: 4 },
  resultQNum:         { fontSize: 12, fontWeight: "700", color: c.textDim, marginBottom: 2 },
  resultQText:        { fontSize: 13, color: c.text, lineHeight: 19 },
  resultAnswer:       { fontSize: 13, fontWeight: "600" },
  resultExplanation:  { fontSize: 12, color: c.textMid, lineHeight: 18, marginTop: 4 },
});
