/**
 * ScanScreen — the core camera flow.
 *
 * Steps:
 *  1. CAPTURE  — teacher taps shutter, photos build up in a strip
 *  2. REVIEW   — reorder / delete pages before uploading
 *  3. UPLOAD   — compress → stitch into PDF → POST to /analyze → SSE result
 *  4. RESULT   — show marks + feedback
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, FlatList,
  Alert, ActivityIndicator, ScrollView, Dimensions,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { photosToPDF, PhotoPage } from "../lib/pdf";
import { api } from "../lib/api";
import { c } from "../lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Step types ───────────────────────────────────────────────────────────────
type Step = "capture" | "review" | "uploading" | "result";

interface ScanEvent {
  type: string; analysis?: any; resultId?: string; shareToken?: string;
  error?: string; filename?: string;
}

// ─── Result view ──────────────────────────────────────────────────────────────
function ResultView({ event, test, onDone }: { event: ScanEvent; test: any; onDone: () => void }) {
  const a = event.analysis;
  const pct = a?.total_marks ? Math.round((a.marks_obtained / a.total_marks) * 100) : 0;
  const scoreColor = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.sectionTitle}>✅ Analysis Complete</Text>

      {/* Score card */}
      <View style={styles.scoreCard}>
        <Text style={[styles.scoreNum, { color: scoreColor }]}>
          {a?.marks_obtained ?? 0}/{a?.total_marks ?? test.total_marks}
        </Text>
        <Text style={[styles.scorePct, { color: scoreColor }]}>{pct}%</Text>
        {a?.student?.name && <Text style={styles.studentName}>{a.student.name}</Text>}
        {a?.student?.roll_no && <Text style={styles.studentMeta}>Roll: {a.student.roll_no}</Text>}
      </View>

      {/* Feedback */}
      {a?.overall_feedback && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackLabel}>OVERALL FEEDBACK</Text>
          <Text style={styles.feedbackText}>{a.overall_feedback}</Text>
        </View>
      )}

      {/* Strengths */}
      {a?.strengths?.length > 0 && (
        <View style={styles.feedbackCard}>
          <Text style={[styles.feedbackLabel, { color: c.success }]}>STRENGTHS</Text>
          {a.strengths.map((s: string, i: number) => (
            <Text key={i} style={[styles.bulletText, { color: c.success }]}>✓ {s}</Text>
          ))}
        </View>
      )}

      {/* Improvements */}
      {a?.improvement_areas?.length > 0 && (
        <View style={styles.feedbackCard}>
          <Text style={[styles.feedbackLabel, { color: c.warning }]}>NEEDS IMPROVEMENT</Text>
          {a.improvement_areas.map((s: string, i: number) => (
            <Text key={i} style={[styles.bulletText, { color: c.warning }]}>→ {s}</Text>
          ))}
        </View>
      )}

      {a?.parse_error && (
        <View style={[styles.feedbackCard, { borderColor: c.warning }]}>
          <Text style={[styles.feedbackLabel, { color: c.warning }]}>⚠ PARSE WARNING</Text>
          <Text style={styles.feedbackText}>Claude could not fully parse the sheet. Try retaking photos with better lighting.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneBtnText}>← Scan Another Sheet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main ScanScreen ──────────────────────────────────────────────────────────
export default function ScanScreen({ route, navigation }: any) {
  const { test } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos]   = useState<PhotoPage[]>([]);
  const [step, setStep]       = useState<Step>("capture");
  const [progress, setProgress] = useState("");
  const [result, setResult]   = useState<ScanEvent | null>(null);
  const cameraRef = useRef<any>(null);

  // ─── Camera permissions ──────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.permText}>Camera access is required to scan answer sheets.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Capture ─────────────────────────────────────────────────────────────
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
    setPhotos((prev) => [...prev, { uri: photo.uri }]);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true, quality: 0.9,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))]);
    }
  };

  // ─── Upload flow ─────────────────────────────────────────────────────────
  const upload = async () => {
    if (!photos.length) return;
    setStep("uploading");
    try {
      // 1. Compress + build PDF on device
      setProgress("Preparing PDF…");
      const pdfUri = await photosToPDF(photos, (cur, total) => {
        setProgress(`Processing page ${cur}/${total}…`);
      });

      // 2. Upload to backend → SSE stream
      setProgress("Uploading to EduGrade…");
      const filename = `scan-${Date.now()}.pdf`;

      await api.analyzeSheet(test.id, pdfUri, filename, (event: ScanEvent) => {
        if (event.type === "result") {
          setResult(event);
          setStep("result");
        } else if (event.type === "error") {
          Alert.alert("Analysis error", event.error || "Something went wrong");
          setStep("review");
        } else if (event.type === "progress") {
          setProgress("Analyzing with Claude…");
        }
      });
    } catch (e: any) {
      Alert.alert("Upload failed", e.message);
      setStep("review");
    }
  };

  // ─── Render: result ───────────────────────────────────────────────────────
  if (step === "result" && result) {
    return (
      <ResultView
        event={result}
        test={test}
        onDone={() => { setPhotos([]); setResult(null); setStep("capture"); }}
      />
    );
  }

  // ─── Render: uploading ────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={styles.progressText}>{progress}</Text>
        <Text style={styles.progressSub}>{photos.length} page{photos.length !== 1 ? "s" : ""} · {test.name}</Text>
      </View>
    );
  }

  // ─── Render: review ───────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <View style={styles.container}>
        <View style={styles.reviewHeader}>
          <TouchableOpacity onPress={() => setStep("capture")}>
            <Text style={styles.backText}>← Add more</Text>
          </TouchableOpacity>
          <Text style={styles.reviewTitle}>{photos.length} page{photos.length !== 1 ? "s" : ""}</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={upload}>
            <Text style={styles.uploadBtnText}>Analyze →</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={photos}
          keyExtractor={(_, i) => i.toString()}
          numColumns={3}
          contentContainerStyle={{ padding: 8 }}
          renderItem={({ item, index }) => (
            <View style={styles.thumbContainer}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              <Text style={styles.pageNum}>{index + 1}</Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.reviewFooter}>
          <Text style={styles.reviewHint}>Tap ✕ to remove a page. Order = analysis order.</Text>
        </View>
      </View>
    );
  }

  // ─── Render: capture ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Test info bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.testLabel} numberOfLines={1}>{test.name}</Text>
        {photos.length > 0 && (
          <TouchableOpacity onPress={() => setStep("review")}>
            <Text style={styles.reviewLink}>Review ({photos.length}) →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Camera */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Photo strip */}
        {photos.length > 0 && (
          <View style={styles.strip}>
            {photos.slice(-5).map((p, i) => (
              <Image key={i} source={{ uri: p.uri }} style={styles.stripThumb} />
            ))}
            {photos.length > 5 && (
              <View style={styles.stripMore}>
                <Text style={styles.stripMoreText}>+{photos.length - 5}</Text>
              </View>
            )}
          </View>
        )}
      </CameraView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Text style={styles.galleryIcon}>🖼</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneCapture, photos.length === 0 && styles.disabledBtn]}
          onPress={() => photos.length > 0 && setStep("review")}
        >
          <Text style={styles.doneCaptureText}>Done{"\n"}({photos.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const THUMB = (SCREEN_W - 48) / 3;

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  center:         { alignItems: "center", justifyContent: "center" },
  // Camera
  topBar:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52, backgroundColor: c.bg },
  testLabel:      { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: c.text, marginHorizontal: 8 },
  backText:       { fontSize: 14, color: c.accent },
  reviewLink:     { fontSize: 13, color: c.accent, fontWeight: "600" },
  camera:         { flex: 1 },
  strip:          { position: "absolute", bottom: 8, left: 8, flexDirection: "row", gap: 4 },
  stripThumb:     { width: 44, height: 56, borderRadius: 4, borderWidth: 1, borderColor: "#fff" },
  stripMore:      { width: 44, height: 56, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  stripMoreText:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  controls:       { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 24, paddingHorizontal: 32, backgroundColor: c.bg },
  galleryBtn:     { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  galleryIcon:    { fontSize: 28 },
  shutter:        { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  shutterInner:   { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  doneCapture:    { width: 60, height: 50, backgroundColor: c.accent, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  disabledBtn:    { opacity: 0.3 },
  doneCaptureText:{ color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  // Review
  reviewHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  reviewTitle:    { fontSize: 15, fontWeight: "700", color: c.text },
  uploadBtn:      { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  thumbContainer: { width: THUMB, height: THUMB * 1.3, margin: 4, position: "relative" },
  thumb:          { width: "100%", height: "100%", borderRadius: 6 },
  pageNum:        { position: "absolute", bottom: 4, left: 6, fontSize: 11, color: "#fff", fontWeight: "700", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  deleteBtn:      { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  deleteBtnText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  reviewFooter:   { padding: 12, borderTopWidth: 1, borderTopColor: c.border },
  reviewHint:     { fontSize: 11, color: c.textDim, textAlign: "center" },
  // Uploading
  progressText:   { fontSize: 15, fontWeight: "600", color: c.text, marginTop: 20 },
  progressSub:    { fontSize: 12, color: c.textMid, marginTop: 6 },
  // Permissions
  permText:       { fontSize: 14, color: c.text, textAlign: "center", paddingHorizontal: 32, marginBottom: 20 },
  permBtn:        { backgroundColor: c.accent, borderRadius: 8, padding: 14, paddingHorizontal: 24 },
  permBtnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Result
  sectionTitle:   { fontSize: 17, fontWeight: "700", color: c.text, marginBottom: 16 },
  scoreCard:      { backgroundColor: c.card, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  scoreNum:       { fontSize: 40, fontWeight: "700" },
  scorePct:       { fontSize: 20, fontWeight: "600", marginTop: 2 },
  studentName:    { fontSize: 16, fontWeight: "600", color: c.text, marginTop: 12 },
  studentMeta:    { fontSize: 12, color: c.textMid, marginTop: 2 },
  feedbackCard:   { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  feedbackLabel:  { fontSize: 11, fontWeight: "700", color: c.textMid, letterSpacing: 0.5, marginBottom: 8 },
  feedbackText:   { fontSize: 13, color: c.text, lineHeight: 20 },
  bulletText:     { fontSize: 13, lineHeight: 22, marginLeft: 4 },
  doneBtn:        { backgroundColor: c.card, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16, borderWidth: 1, borderColor: c.border },
  doneBtnText:    { color: c.accent, fontWeight: "700", fontSize: 14 },
});
