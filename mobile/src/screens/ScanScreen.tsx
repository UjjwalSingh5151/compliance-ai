/**
 * ScanScreen — scan student answer-sheet notebooks for a specific test.
 *
 * Steps:
 *  CAPTURE   — photograph pages of ONE student's copy
 *              "Copy Done (N pages)" → adds copy to queue → go to COPIES
 *  COPIES    — review queued copies, add more, or "Analyze All"
 *  UPLOADING — convert each copy to PDF + stream SSE analysis (one by one)
 *  RESULTS   — show all analysis results as a scored list
 */

import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, FlatList,
  Alert, ActivityIndicator, ScrollView, Dimensions, Share,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { photosToPDF, PhotoPage } from "../lib/pdf";
import { api } from "../lib/api";
import { shareUrl } from "../lib/branding";
import { c } from "../lib/theme";
import { logError } from "../lib/errorLog";

const { width: SCREEN_W } = Dimensions.get("window");
const THUMB = (SCREEN_W - 48) / 3;

type Step = "capture" | "copies" | "uploading" | "results";

interface Copy {
  id: string;
  pages: PhotoPage[];
}

interface ScanResult {
  copyId:      string;
  copyNum:     number;
  analysis:    any;
  resultId?:   string;
  shareToken?: string;
  error?:      string;
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({ result, totalMarks }: { result: ScanResult; totalMarks: number }) {
  const shareResult = () => {
    const url = shareUrl(result.shareToken!);
    Share.share({ message: url, url });
  };

  if (result.error) {
    return (
      <View style={[styles.resultCard, { borderColor: c.danger }]}>
        <Text style={styles.resultCopyLabel}>Copy {result.copyNum}</Text>
        <Text style={[styles.resultError, { color: c.danger }]}>⚠ {result.error}</Text>
      </View>
    );
  }

  const a   = result.analysis;
  const tot = a?.total_marks ?? totalMarks;
  const obt = a?.marks_obtained ?? 0;
  const pct = tot ? Math.round((obt / tot) * 100) : 0;
  const col = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;

  return (
    <View style={styles.resultCard}>
      {/* Header row */}
      <View style={styles.resultRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resultCopyLabel}>Copy {result.copyNum}</Text>
          {a?.student?.name && (
            <Text style={styles.resultStudentName}>{a.student.name}</Text>
          )}
          {a?.student?.roll_no && (
            <Text style={styles.resultMeta}>Roll: {a.student.roll_no}</Text>
          )}
        </View>
        <View style={[styles.scoreBadge, { borderColor: col }]}>
          <Text style={[styles.scoreNum, { color: col }]}>{obt}/{tot}</Text>
          <Text style={[styles.scorePct, { color: col }]}>{pct}%</Text>
        </View>
      </View>

      {a?.parse_error && (
        <Text style={styles.parseWarn}>
          ⚠ Partial read — try better lighting / flatter pages
        </Text>
      )}

      {a?.overall_feedback && (
        <Text style={styles.feedbackText} numberOfLines={3}>
          {a.overall_feedback}
        </Text>
      )}

      {/* Share button — only shown when server returned a shareToken */}
      {result.shareToken && (
        <TouchableOpacity style={styles.shareBtn} onPress={shareResult}>
          <Text style={styles.shareBtnText}>🔗 Share result with student</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main ScanScreen ──────────────────────────────────────────────────────────
export default function ScanScreen({ route, navigation }: any) {
  const { test, freshlyCreated } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Current copy being photographed
  const [currentPages, setCurrentPages] = useState<PhotoPage[]>([]);

  // Queue of completed copies waiting for analysis
  const [copies, setCopies]       = useState<Copy[]>([]);
  // When non-null, "Copy Done" saves back into this copy id instead of appending
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);

  const [step, setStep]           = useState<Step>("capture");
  const [progress, setProgress]   = useState("");
  const [results, setResults]     = useState<ScanResult[]>([]);

  const goHome = () => navigation.navigate("Home");

  // ── Camera permission ─────────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.permText}>Camera access is required to scan answer sheets.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9, skipProcessing: false,
      });
      setCurrentPages((prev) => [...prev, { uri: photo.uri }]);
    } catch (e: any) {
      logError(e.message, "ScanScreen:takePhoto");
      Alert.alert("Camera error", e.message);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true, quality: 0.9,
      });
      if (!result.canceled) {
        setCurrentPages((prev) => [
          ...prev, ...result.assets.map((a) => ({ uri: a.uri })),
        ]);
      }
    } catch (e: any) {
      logError(e.message, "ScanScreen:gallery");
      Alert.alert("Gallery error", e.message);
    }
  };

  /** Finish scanning current copy → add to queue (or update if editing) */
  const finishCopy = () => {
    if (!currentPages.length) return;
    if (editingCopyId) {
      // Save back into the existing copy, preserving its position in the list
      setCopies((prev) =>
        prev.map((cp) => cp.id === editingCopyId ? { ...cp, pages: [...currentPages] } : cp)
      );
      setEditingCopyId(null);
    } else {
      const newCopy: Copy = { id: Date.now().toString(), pages: [...currentPages] };
      setCopies((prev) => [...prev, newCopy]);
    }
    setCurrentPages([]);
    setStep("copies");
  };

  /** Open an existing copy for editing — loads its pages back into the camera */
  const editCopy = (copy: Copy) => {
    setCurrentPages([...copy.pages]);
    setEditingCopyId(copy.id);
    setStep("capture");
  };

  /** Upload all queued copies sequentially and stream results */
  const analyzeAll = async () => {
    const queue = [...copies];
    if (!queue.length) return;
    setStep("uploading");
    const collected: ScanResult[] = [];

    for (let i = 0; i < queue.length; i++) {
      const copy = queue[i];
      setProgress(`Preparing copy ${i + 1} of ${queue.length}…`);
      try {
        const pdfUri = await photosToPDF(copy.pages, (cur, tot) => {
          setProgress(`Copy ${i + 1}/${queue.length} — page ${cur}/${tot}…`);
        });
        const filename = `scan-c${i + 1}-${Date.now()}.pdf`;
        setProgress(`Analyzing copy ${i + 1} of ${queue.length}…`);

        await api.analyzeSheet(test.id, pdfUri, filename, (event: any) => {
          if (event.type === "result") {
            const r: ScanResult = {
              copyId:     copy.id,
              copyNum:    i + 1,
              analysis:   event.analysis,
              resultId:   event.resultId,
              shareToken: event.shareToken,
            };
            collected.push(r);
          } else if (event.type === "error") {
            collected.push({
              copyId:  copy.id,
              copyNum: i + 1,
              analysis: null,
              error:   event.error || "Analysis failed",
            });
          }
        });
      } catch (e: any) {
        logError(e.message, `ScanScreen:copy${i + 1}`);
        collected.push({
          copyId:  copy.id,
          copyNum: i + 1,
          analysis: null,
          error:   e.message,
        });
      }
    }

    setResults(collected);
    setStep("results");
  };

  // ── CAPTURE ───────────────────────────────────────────────────────────────
  if (step === "capture") {
    const hasExisting  = copies.length > 0;
    const isEditing    = editingCopyId !== null;
    const editingIndex = isEditing ? copies.findIndex((cp) => cp.id === editingCopyId) : -1;

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => {
            if (isEditing) { setEditingCopyId(null); setCurrentPages([]); }
            hasExisting ? setStep("copies") : goHome();
          }}>
            <Text style={styles.backText}>
              {hasExisting ? `← Queue (${copies.length})` : "← Home"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.testLabel} numberOfLines={1}>
            {isEditing
              ? `Editing copy ${editingIndex + 1}`
              : freshlyCreated && copies.length === 0
                ? "📷 Scan first copy"
                : test.name}
          </Text>
          <View style={{ width: 80 }} />
        </View>

        {freshlyCreated && copies.length === 0 && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              ✅ Test created! Photograph the student's answer sheet pages.
              Tap "Copy Done" when finished with one student.
            </Text>
          </View>
        )}

        <Text style={styles.captureHint}>
          Scanning copy {copies.length + 1}
          {currentPages.length > 0 ? ` · ${currentPages.length} page${currentPages.length !== 1 ? "s" : ""}` : ""}
        </Text>

        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          {currentPages.length > 0 && (
            <View style={styles.strip}>
              {currentPages.slice(-5).map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={styles.stripThumb} />
              ))}
              {currentPages.length > 5 && (
                <View style={styles.stripMore}>
                  <Text style={styles.stripMoreText}>+{currentPages.length - 5}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
            <Text style={styles.galleryIcon}>🖼</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.copyDoneBtn, currentPages.length === 0 && { opacity: 0.3 }]}
            onPress={finishCopy}
          >
            <Text style={styles.copyDoneBtnText}>
              {isEditing ? "Save\nCopy" : "Copy\nDone"}
              {currentPages.length > 0 ? `\n(${currentPages.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── COPIES ────────────────────────────────────────────────────────────────
  if (step === "copies") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goHome}>
            <Text style={styles.backText}>← Home</Text>
          </TouchableOpacity>
          <Text style={styles.testLabel} numberOfLines={1}>{test.name}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.copiesHeader}>
          <Text style={styles.copiesTitle}>
            {copies.length} cop{copies.length !== 1 ? "ies" : "y"} queued
          </Text>
          <Text style={styles.copiesHint}>
            Add more copies or tap Analyze to upload all at once
          </Text>
        </View>

        <FlatList
          data={copies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item, index }) => (
            <View style={styles.copyCard}>
              {/* First page thumb */}
              <Image
                source={{ uri: item.pages[0].uri }}
                style={styles.copyThumb}
              />
              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={styles.copyCardTitle}>Copy {index + 1}</Text>
                <Text style={styles.copyCardMeta}>
                  {item.pages.length} page{item.pages.length !== 1 ? "s" : ""}
                </Text>
                {/* Row of small thumbs */}
                <View style={styles.copyMiniStrip}>
                  {item.pages.slice(0, 5).map((p, pi) => (
                    <Image key={pi} source={{ uri: p.uri }} style={styles.copyMiniThumb} />
                  ))}
                  {item.pages.length > 5 && (
                    <View style={styles.copyMiniMore}>
                      <Text style={styles.copyMiniMoreText}>+{item.pages.length - 5}</Text>
                    </View>
                  )}
                </View>
              </View>
              {/* Edit / Delete */}
              <View style={{ gap: 8, alignItems: "center" }}>
                <TouchableOpacity
                  style={styles.copyEditBtn}
                  onPress={() => editCopy(item)}
                >
                  <Text style={styles.copyEditText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyDeleteBtn}
                  onPress={() => setCopies((prev) => prev.filter((cp) => cp.id !== item.id))}
                >
                  <Text style={styles.copyDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={styles.copiesFooter}>
          <TouchableOpacity
            style={styles.addCopyBtn}
            onPress={() => setStep("capture")}
          >
            <Text style={styles.addCopyBtnText}>+ Add Another Copy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.analyzeAllBtn, copies.length === 0 && { opacity: 0.35 }]}
            onPress={analyzeAll}
            disabled={copies.length === 0}
          >
            <Text style={styles.analyzeAllBtnText}>
              Analyze All ({copies.length}) →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── UPLOADING ─────────────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={styles.progressText}>{progress}</Text>
        <Text style={styles.progressSub}>{test.name}</Text>
      </View>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  const passed  = results.filter((r) => !r.error).length;
  const errored = results.filter((r) =>  r.error).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goHome}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.testLabel} numberOfLines={1}>{test.name}</Text>
        <View style={{ width: 56 }} />
      </View>

      <Text style={styles.sectionTitle}>
        ✅ {passed} analyzed{errored > 0 ? ` · ⚠ ${errored} failed` : ""}
      </Text>

      {results.map((r) => (
        <ResultCard key={r.copyId} result={r} totalMarks={test.total_marks} />
      ))}

      <View style={{ gap: 10, marginTop: 16 }}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            setCopies([]);
            setResults([]);
            setCurrentPages([]);
            setStep("capture");
          }}
        >
          <Text style={styles.primaryBtnText}>📷 Scan More Copies</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
          <Text style={styles.secondaryBtnText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: c.bg },
  center:          { alignItems: "center", justifyContent: "center" },
  topBar:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52, backgroundColor: c.bg },
  testLabel:       { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: c.text, marginHorizontal: 8 },
  backText:        { fontSize: 14, color: c.accent, minWidth: 80 },
  // Capture
  infoBanner:      { backgroundColor: `${c.success}18`, borderBottomWidth: 1, borderBottomColor: `${c.success}30`, padding: 12 },
  infoBannerText:  { fontSize: 12, color: c.success, textAlign: "center", lineHeight: 18 },
  captureHint:     { fontSize: 12, color: c.textDim, textAlign: "center", paddingVertical: 6 },
  cameraWrapper:   { flex: 1, position: "relative" },
  camera:          { flex: 1 },
  strip:           { position: "absolute", bottom: 8, left: 8, flexDirection: "row", gap: 4, zIndex: 10 },
  stripThumb:      { width: 44, height: 56, borderRadius: 4, borderWidth: 1, borderColor: "#fff" },
  stripMore:       { width: 44, height: 56, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  stripMoreText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  controls:        { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 24, paddingHorizontal: 32, backgroundColor: c.bg },
  galleryBtn:      { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  galleryIcon:     { fontSize: 28 },
  shutter:         { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  shutterInner:    { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  copyDoneBtn:     { width: 68, height: 54, backgroundColor: c.accent, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  copyDoneBtnText: { color: "#fff", fontSize: 10, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  // Copies queue
  copiesHeader:    { padding: 16, paddingBottom: 8 },
  copiesTitle:     { fontSize: 18, fontWeight: "700", color: c.text },
  copiesHint:      { fontSize: 12, color: c.textDim, marginTop: 2 },
  copyCard:        { flexDirection: "row", backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: c.border, alignItems: "center", gap: 12 },
  copyThumb:       { width: 56, height: 72, borderRadius: 6 },
  copyCardTitle:   { fontSize: 14, fontWeight: "700", color: c.text },
  copyCardMeta:    { fontSize: 12, color: c.textMid, marginTop: 2 },
  copyMiniStrip:   { flexDirection: "row", gap: 3, marginTop: 6 },
  copyMiniThumb:   { width: 24, height: 30, borderRadius: 3 },
  copyMiniMore:    { width: 24, height: 30, borderRadius: 3, backgroundColor: c.border, alignItems: "center", justifyContent: "center" },
  copyMiniMoreText:{ fontSize: 8, color: c.textMid, fontWeight: "700" },
  copyEditBtn:     { padding: 6 },
  copyEditText:    { fontSize: 16 },
  copyDeleteBtn:   { padding: 6 },
  copyDeleteText:  { fontSize: 16, color: c.textDim },
  copiesFooter:    { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: c.border },
  addCopyBtn:      { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, alignItems: "center" },
  addCopyBtnText:  { color: c.accent, fontWeight: "700", fontSize: 14 },
  analyzeAllBtn:   { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: "center" },
  analyzeAllBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
  // Uploading
  progressText:    { fontSize: 15, fontWeight: "600", color: c.text, marginTop: 20, paddingHorizontal: 32, textAlign: "center" },
  progressSub:     { fontSize: 12, color: c.textMid, marginTop: 6 },
  // Results
  sectionTitle:    { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 14 },
  resultCard:      { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  resultRow:       { flexDirection: "row", alignItems: "flex-start" },
  resultCopyLabel: { fontSize: 11, fontWeight: "700", color: c.textMid, letterSpacing: 0.4, marginBottom: 2 },
  resultStudentName:{ fontSize: 15, fontWeight: "700", color: c.text },
  resultMeta:      { fontSize: 11, color: c.textMid, marginTop: 1 },
  scoreBadge:      { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", marginLeft: 8 },
  scoreNum:        { fontSize: 18, fontWeight: "700" },
  scorePct:        { fontSize: 13, fontWeight: "600", marginTop: 1 },
  parseWarn:       { fontSize: 11, color: c.warning, marginTop: 8 },
  feedbackText:    { fontSize: 12, color: c.textMid, marginTop: 8, lineHeight: 18 },
  resultError:     { fontSize: 13, marginTop: 4 },
  shareBtn:        { marginTop: 12, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, alignItems: "center" },
  shareBtnText:    { fontSize: 13, color: c.accent, fontWeight: "600" },
  // Buttons
  primaryBtn:      { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: "center" },
  primaryBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn:    { backgroundColor: c.card, borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: c.border },
  secondaryBtnText:{ color: c.accent, fontWeight: "700", fontSize: 14 },
  permText:        { fontSize: 14, color: c.text, textAlign: "center", paddingHorizontal: 32, marginBottom: 20 },
});
