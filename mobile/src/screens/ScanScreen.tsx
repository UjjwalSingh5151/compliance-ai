/**
 * ScanScreen — scan student answer sheet notebooks for a specific test.
 *
 * Steps:
 *  1. CAPTURE  — take photos of the notebook pages
 *  2. REVIEW   — reorder / delete pages
 *  3. UPLOADING — compress → stitch PDF on device → POST to /analyze → SSE
 *  4. RESULT   — show marks + feedback → "Scan another" or go home
 */

import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image, FlatList,
  Alert, ActivityIndicator, ScrollView, Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { photosToPDF, PhotoPage } from "../lib/pdf";
import { api } from "../lib/api";
import { c } from "../lib/theme";
import { logError } from "../lib/errorLog";

const { width: SCREEN_W } = Dimensions.get("window");

type Step = "capture" | "review" | "uploading" | "result";

interface ScanEvent {
  type: string;
  analysis?: any;
  resultId?: string;
  shareToken?: string;
  error?: string;
}

// ─── Result view ──────────────────────────────────────────────────────────────
function ResultView({
  event, test, onScanAnother, onGoHome,
}: {
  event: ScanEvent; test: any; onScanAnother: () => void; onGoHome: () => void;
}) {
  const a = event.analysis;
  const pct = a?.total_marks ? Math.round((a.marks_obtained / a.total_marks) * 100) : 0;
  const scoreColor = pct >= 75 ? c.success : pct >= 50 ? c.warning : c.danger;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onGoHome}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.testLabel} numberOfLines={1}>{test.name}</Text>
        <View style={{ width: 56 }} />
      </View>

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

      {/* Overall feedback */}
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

      {/* Areas for improvement */}
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
          <Text style={[styles.feedbackLabel, { color: c.warning }]}>⚠ SCAN WARNING</Text>
          <Text style={styles.feedbackText}>
            Could not fully read this sheet. Try retaking photos with better lighting and ensure
            pages are flat.
          </Text>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 8 }}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onScanAnother}>
          <Text style={styles.primaryBtnText}>📷 Scan Next Notebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onGoHome}>
          <Text style={styles.secondaryBtnText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main ScanScreen ──────────────────────────────────────────────────────────
export default function ScanScreen({ route, navigation }: any) {
  const { test, freshlyCreated } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos]   = useState<PhotoPage[]>([]);
  const [step, setStep]       = useState<Step>("capture");
  const [progress, setProgress] = useState("");
  const [result, setResult]   = useState<ScanEvent | null>(null);
  const cameraRef             = useRef<any>(null);

  const goHome = () => navigation.navigate("Home");

  // ─── Camera permissions ───────────────────────────────────────────────────
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

  // ─── Photo capture ────────────────────────────────────────────────────────
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      setPhotos((prev) => [...prev, { uri: photo.uri }]);
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
        setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))]);
      }
    } catch (e: any) {
      logError(e.message, "ScanScreen:gallery");
      Alert.alert("Gallery error", e.message);
    }
  };

  // ─── Upload + analyze ─────────────────────────────────────────────────────
  const upload = async () => {
    if (!photos.length) return;
    setStep("uploading");
    try {
      setProgress("Preparing PDF…");
      const pdfUri = await photosToPDF(photos, (cur, total) => {
        setProgress(`Processing page ${cur}/${total}…`);
      });

      setProgress("Uploading to EduGrade…");
      const filename = `scan-${Date.now()}.pdf`;

      await api.analyzeSheet(test.id, pdfUri, filename, (event: ScanEvent) => {
        if (event.type === "result") {
          setResult(event);
          setStep("result");
        } else if (event.type === "error") {
          const msg = event.error || "Something went wrong";
          logError(msg, "ScanScreen:SSE");
          Alert.alert("Analysis error", msg);
          setStep("review");
        } else if (event.type === "progress") {
          setProgress("Analyzing with Claude…");
        }
      });
    } catch (e: any) {
      logError(e.message, "ScanScreen:upload");
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
        onScanAnother={() => { setPhotos([]); setResult(null); setStep("capture"); }}
        onGoHome={goHome}
      />
    );
  }

  // ─── Render: uploading ────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={styles.progressText}>{progress}</Text>
        <Text style={styles.progressSub}>
          {photos.length} page{photos.length !== 1 ? "s" : ""} · {test.name}
        </Text>
      </View>
    );
  }

  // ─── Render: review ───────────────────────────────────────────────────────
  const THUMB = (SCREEN_W - 48) / 3;

  if (step === "review") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setStep("capture")}>
            <Text style={styles.backText}>← Add more</Text>
          </TouchableOpacity>
          <Text style={styles.testLabel}>{photos.length} page{photos.length !== 1 ? "s" : ""}</Text>
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
            <View style={{ width: THUMB, height: THUMB * 1.3, margin: 4, position: "relative" }}>
              <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%", borderRadius: 6 }} />
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

        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border }}>
          <Text style={{ fontSize: 11, color: c.textDim, textAlign: "center" }}>
            Tap ✕ to remove a page. Order = analysis order.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Render: capture ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goHome}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.testLabel} numberOfLines={1}>
          {freshlyCreated ? "📷 Scan first notebook" : test.name}
        </Text>
        {photos.length > 0 && (
          <TouchableOpacity onPress={() => setStep("review")}>
            <Text style={styles.reviewLink}>Review ({photos.length}) →</Text>
          </TouchableOpacity>
        )}
        {photos.length === 0 && <View style={{ width: 80 }} />}
      </View>

      {freshlyCreated && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ✅ Test created! Now photograph the student's answer sheets one by one.
          </Text>
        </View>
      )}

      <CameraView ref={cameraRef} style={styles.camera} facing="back">
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

      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Text style={styles.galleryIcon}>🖼</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneCapture, photos.length === 0 && { opacity: 0.3 }]}
          onPress={() => photos.length > 0 && setStep("review")}
        >
          <Text style={styles.doneCaptureText}>Done{"\n"}({photos.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.bg },
  center:         { alignItems: "center", justifyContent: "center" },
  topBar:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52, backgroundColor: c.bg },
  testLabel:      { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: c.text, marginHorizontal: 8 },
  backText:       { fontSize: 14, color: c.accent, minWidth: 56 },
  reviewLink:     { fontSize: 13, color: c.accent, fontWeight: "600" },
  infoBanner:     { backgroundColor: `${c.success}18`, borderBottomWidth: 1, borderBottomColor: `${c.success}30`, padding: 12 },
  infoBannerText: { fontSize: 12, color: c.success, textAlign: "center", lineHeight: 18 },
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
  doneCaptureText:{ color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  uploadBtn:      { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  pageNum:        { position: "absolute", bottom: 4, left: 6, fontSize: 11, color: "#fff", fontWeight: "700", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  deleteBtn:      { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  deleteBtnText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  progressText:   { fontSize: 15, fontWeight: "600", color: c.text, marginTop: 20, paddingHorizontal: 32, textAlign: "center" },
  progressSub:    { fontSize: 12, color: c.textMid, marginTop: 6 },
  permText:       { fontSize: 14, color: c.text, textAlign: "center", paddingHorizontal: 32, marginBottom: 20 },
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
  primaryBtn:     { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn:   { backgroundColor: c.card, borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: c.border },
  secondaryBtnText: { color: c.accent, fontWeight: "700", fontSize: 14 },
});
