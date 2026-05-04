/**
 * NewPaperScreen — NEW FLOW
 *
 * Step 1 — CAPTURE    : photograph the question paper pages
 * Step 2 — REVIEW     : remove / reorder pages
 * Step 3 — EXTRACTING : auto-fill details via /api/analyzer/extract-paper
 * Step 4 — DETAILS    : confirm / edit name, subject, class, marks,
 *                       grading strictness, instructions, teacher name
 * Step 5 — CREATING   : build PDF → POST /api/analyzer/tests
 *                     → navigate to ScanScreen
 */

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, FlatList,
  Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { photosToPDF, PhotoPage } from "../lib/pdf";
import { api } from "../lib/api";
import { c } from "../lib/theme";
import { logError } from "../lib/errorLog";

type Step = "capture" | "review" | "extracting" | "details" | "creating";

const { width: SCREEN_W } = Dimensions.get("window");
const THUMB = (SCREEN_W - 48) / 3;

const LENIENCY_LABELS: Record<number, string> = {
  1: "Strict",
  2: "Firm",
  3: "Balanced",
  4: "Lenient",
  5: "Very\nLenient",
};

export default function NewPaperScreen({ navigation }: any) {
  const [step, setStep]             = useState<Step>("capture");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef                   = useRef<any>(null);

  // Question-paper photos
  const [photos, setPhotos]         = useState<PhotoPage[]>([]);

  // Direct PDF upload (skips camera entirely)
  const [directPdfUri, setDirectPdfUri]   = useState<string | null>(null);
  const [directPdfName, setDirectPdfName] = useState<string>("");

  // Form fields (auto-filled from extraction, editable)
  const [name, setName]             = useState("");
  const [subject, setSubject]       = useState("");
  const [classVal, setClassVal]     = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [leniency, setLeniency]     = useState(3);
  const [instructions, setInstructions] = useState("");
  const [teacherName, setTeacherName]   = useState("");

  const [progress, setProgress]     = useState("");

  // ── CAPTURE ─────────────────────────────────────────────────────────────────
  if (step === "capture") {
    if (!permission) return <View style={styles.container} />;
    if (!permission.granted) {
      return (
        <View style={[styles.container, styles.center]}>
          <Text style={styles.permText}>Camera access is required to scan the question paper.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const takePhoto = async () => {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
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

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Scan Question Paper</Text>
          {photos.length > 0 ? (
            <TouchableOpacity onPress={() => setStep("review")}>
              <Text style={styles.nextText}>Review ({photos.length}) →</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <Text style={styles.captureHint}>
          Photograph each page of the question paper — details will be auto-filled
        </Text>

        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          {photos.length > 0 && (
            <View style={styles.strip}>
              {photos.slice(-4).map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={styles.stripThumb} />
              ))}
              {photos.length > 4 && (
                <View style={styles.stripMore}>
                  <Text style={styles.stripMoreText}>+{photos.length - 4}</Text>
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
            style={[styles.doneCapture, photos.length === 0 && { opacity: 0.3 }]}
            onPress={() => photos.length > 0 && setStep("review")}
          >
            <Text style={styles.doneCaptureText}>Done{"\n"}({photos.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureFooter}>
          <TouchableOpacity style={styles.uploadPdfBtn} onPress={() => pickPDF()}>
            <Text style={styles.uploadPdfBtnText}>📄 Upload PDF instead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => setStep("details")}>
            <Text style={styles.skipBtnText}>Skip — fill details manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── REVIEW ───────────────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setStep("capture")}>
            <Text style={styles.backText}>← Add more</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>
            {photos.length} page{photos.length !== 1 ? "s" : ""}
          </Text>
          <TouchableOpacity
            style={styles.uploadBtnSmall}
            onPress={() => extractDetails()}
          >
            <Text style={styles.uploadBtnSmallText}>Extract →</Text>
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

        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.border }}>
          <Text style={{ fontSize: 11, color: c.textDim, textAlign: "center" }}>
            Tap ✕ to remove a page · Tap Extract to auto-fill test details
          </Text>
        </View>
      </View>
    );
  }

  // ── EXTRACTING ───────────────────────────────────────────────────────────────
  if (step === "extracting") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={styles.progressText}>
          Reading question paper…{"\n"}Auto-filling details
        </Text>
      </View>
    );
  }

  // ── DETAILS ──────────────────────────────────────────────────────────────────
  if (step === "details") {
    const valid = name.trim().length > 0 && parseInt(totalMarks) > 0;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => photos.length > 0 ? setStep("review") : setStep("capture")}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Test Details</Text>
            <View style={{ width: 48 }} />
          </View>

          {(photos.length > 0 || directPdfUri) && (
            <View style={styles.extractedBanner}>
              <Text style={styles.extractedBannerText}>
                {directPdfUri
                  ? `📄 ${directPdfName || "PDF"} — details auto-filled`
                  : "✨ Details auto-filled — edit anything below"}
              </Text>
            </View>
          )}

          {/* ── Core info ── */}
          <Text style={styles.label}>Test Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Chapter 5 Chemistry Test"
            placeholderTextColor={c.textDim}
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Chemistry, Maths"
            placeholderTextColor={c.textDim}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
          />

          <Text style={styles.label}>Class / Section</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10A, 12B"
            placeholderTextColor={c.textDim}
            value={classVal}
            onChangeText={setClassVal}
            returnKeyType="next"
          />

          <Text style={styles.label}>Total Marks *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 50"
            placeholderTextColor={c.textDim}
            value={totalMarks}
            onChangeText={setTotalMarks}
            keyboardType="number-pad"
            returnKeyType="done"
          />

          <Text style={styles.label}>Teacher Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mr. Sharma"
            placeholderTextColor={c.textDim}
            value={teacherName}
            onChangeText={setTeacherName}
            returnKeyType="next"
          />

          {/* ── Grading strictness ── */}
          <Text style={styles.label}>Grading Strictness</Text>
          <View style={styles.leniencyRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.leniencyBtn, leniency === n && styles.leniencyBtnActive]}
                onPress={() => setLeniency(n)}
              >
                <Text style={[styles.leniencyNum, leniency === n && styles.leniencyNumActive]}>
                  {n}
                </Text>
                <Text style={[styles.leniencyLabel, leniency === n && styles.leniencyLabelActive]}>
                  {LENIENCY_LABELS[n]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.leniencyHint}>
            1 = Exact answers required · 5 = Partial credit freely given
          </Text>

          {/* ── Grading instructions ── */}
          <Text style={styles.label}>Grading Instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Award marks for correct method even if the final answer is wrong"
            placeholderTextColor={c.textDim}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !valid && styles.disabledBtn]}
            onPress={() => valid && createTest(photos)}
            disabled={!valid}
          >
            <Text style={styles.primaryBtnText}>Create Test →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── CREATING ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={styles.progressText}>{progress}</Text>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Extract details from scanned paper
  // ─────────────────────────────────────────────────────────────────────────────
  async function pickPDF() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setDirectPdfUri(asset.uri);
      setDirectPdfName(asset.name);
      extractDetails(asset.uri, asset.name);
    } catch (e: any) {
      logError(e.message, "NewPaperScreen:pickPDF");
      Alert.alert("PDF picker error", e.message);
    }
  }

  async function extractDetails(uri?: string, filename?: string) {
    setStep("extracting");
    try {
      const pdfUri = uri ?? await photosToPDF(photos);
      const fd = new FormData();
      fd.append("questionPaper", {
        uri:  pdfUri,
        name: filename || `qpaper-${Date.now()}.pdf`,
        type: "application/pdf",
      } as any);
      const result = await api.extractPaper(fd);
      if (result.name)         setName(result.name);
      if (result.subject)      setSubject(result.subject);
      if (result.totalMarks)   setTotalMarks(String(result.totalMarks));
      if (result.instructions) setInstructions(result.instructions);
    } catch (e: any) {
      logError(e.message, "NewPaperScreen:extract");
      Alert.alert(
        "Auto-fill failed",
        "Couldn't read the paper — please fill in the details manually.",
        [{ text: "OK" }],
      );
    }
    setStep("details");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create test on server
  // ─────────────────────────────────────────────────────────────────────────────
  async function createTest(qPhotos: PhotoPage[]) {
    setStep("creating");
    try {
      const formData = new FormData();
      formData.append("name",       name.trim());
      formData.append("subject",    subject.trim());
      formData.append("class",      classVal.trim());
      formData.append("totalMarks", totalMarks.trim());
      formData.append("leniency",   String(leniency));
      if (instructions.trim()) formData.append("instructions", instructions.trim());
      if (teacherName.trim())  formData.append("teacherName",  teacherName.trim());

      if (directPdfUri) {
        // PDF was picked directly — upload as-is
        formData.append("questionPaper", {
          uri:  directPdfUri,
          name: directPdfName || `question-paper-${Date.now()}.pdf`,
          type: "application/pdf",
        } as any);
      } else if (qPhotos.length > 0) {
        setProgress("Preparing question paper PDF…");
        const pdfUri = await photosToPDF(qPhotos, (cur, total) => {
          setProgress(`Processing page ${cur}/${total}…`);
        });
        formData.append("questionPaper", {
          uri:  pdfUri,
          name: `question-paper-${Date.now()}.pdf`,
          type: "application/pdf",
        } as any);
      }

      setProgress("Creating test…");
      const { test } = await api.createTest(formData);
      navigation.replace("Scan", { test, freshlyCreated: true });
    } catch (e: any) {
      logError(e.message, "NewPaperScreen:create");
      Alert.alert("Failed to create test", e.message, [
        { text: "Try again",    onPress: () => setStep("details") },
        { text: "Back to home", onPress: () => navigation.goBack() },
      ]);
    }
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: c.bg },
  center:              { alignItems: "center", justifyContent: "center" },
  topBar:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52 },
  screenTitle:         { fontSize: 16, fontWeight: "700", color: c.text },
  backText:            { fontSize: 14, color: c.accent, minWidth: 60 },
  nextText:            { fontSize: 14, color: c.accent, fontWeight: "600" },
  label:               { fontSize: 12, fontWeight: "600", color: c.textMid, marginBottom: 6, marginTop: 16, letterSpacing: 0.3 },
  input:               { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, fontSize: 14, color: c.text },
  textArea:            { minHeight: 88, paddingTop: 12 },
  primaryBtn:          { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  primaryBtnText:      { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabledBtn:         { opacity: 0.35 },
  captureFooter:       { alignItems: "center", paddingBottom: 8 },
  uploadPdfBtn:        { paddingVertical: 10, paddingHorizontal: 24 },
  uploadPdfBtnText:    { fontSize: 14, color: c.accent, fontWeight: "600" },
  skipBtn:             { alignItems: "center", paddingVertical: 8, paddingHorizontal: 24 },
  skipBtnText:         { fontSize: 13, color: c.textDim, textDecorationLine: "underline" },
  // Extracted banner
  extractedBanner:     { backgroundColor: `${c.accent}1A`, borderRadius: 8, padding: 10, marginBottom: 4 },
  extractedBannerText: { fontSize: 12, color: c.accent, fontWeight: "600", textAlign: "center" },
  // Camera
  captureHint:         { fontSize: 12, color: c.textDim, textAlign: "center", paddingHorizontal: 24, paddingBottom: 8 },
  cameraWrapper:       { flex: 1, position: "relative" },
  camera:              { flex: 1 },
  strip:               { position: "absolute", bottom: 8, left: 8, flexDirection: "row", gap: 4, zIndex: 10 },
  stripThumb:          { width: 44, height: 56, borderRadius: 4, borderWidth: 1, borderColor: "#fff" },
  stripMore:           { width: 44, height: 56, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  stripMoreText:       { color: "#fff", fontSize: 12, fontWeight: "700" },
  controls:            { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 24, paddingHorizontal: 32, backgroundColor: c.bg },
  galleryBtn:          { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  galleryIcon:         { fontSize: 28 },
  shutter:             { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  shutterInner:        { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  doneCapture:         { width: 60, height: 50, backgroundColor: c.accent, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  doneCaptureText:     { color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  // Review
  uploadBtnSmall:      { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnSmallText:  { color: "#fff", fontWeight: "700", fontSize: 13 },
  thumbContainer:      { width: THUMB, height: THUMB * 1.3, margin: 4, position: "relative" },
  thumb:               { width: "100%", height: "100%", borderRadius: 6 },
  pageNum:             { position: "absolute", bottom: 4, left: 6, fontSize: 11, color: "#fff", fontWeight: "700", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  deleteBtn:           { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  deleteBtnText:       { color: "#fff", fontSize: 11, fontWeight: "700" },
  // Leniency picker
  leniencyRow:         { flexDirection: "row", gap: 6, marginTop: 4 },
  leniencyBtn:         { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  leniencyBtnActive:   { backgroundColor: c.accent, borderColor: c.accent },
  leniencyNum:         { fontSize: 16, fontWeight: "700", color: c.textMid },
  leniencyNumActive:   { color: "#fff" },
  leniencyLabel:       { fontSize: 9, color: c.textDim, marginTop: 2, textAlign: "center" },
  leniencyLabelActive: { color: "rgba(255,255,255,0.85)" },
  leniencyHint:        { fontSize: 10, color: c.textDim, marginTop: 6, lineHeight: 14 },
  // Creating
  progressText:        { fontSize: 14, fontWeight: "600", color: c.text, marginTop: 20, paddingHorizontal: 32, textAlign: "center", lineHeight: 22 },
  permText:            { fontSize: 14, color: c.text, textAlign: "center", paddingHorizontal: 32, marginBottom: 20 },
});
