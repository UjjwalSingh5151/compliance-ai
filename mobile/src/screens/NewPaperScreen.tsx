/**
 * NewPaperScreen
 *
 * Step 1 — DETAILS  : fill test name, subject, class, total marks
 * Step 2 — CAPTURE  : photograph the question paper (optional but recommended)
 * Step 3 — REVIEW   : reorder / remove pages
 * Step 4 — CREATING : upload FormData → create test on server
 *           → navigate to ScanScreen to start scanning student notebooks
 */

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, FlatList,
  Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { photosToPDF, PhotoPage } from "../lib/pdf";
import { api } from "../lib/api";
import { c } from "../lib/theme";
import { logError } from "../lib/errorLog";

type Step = "details" | "capture" | "review" | "creating";

const { width: SCREEN_W } = Dimensions.get("window");
const THUMB = (SCREEN_W - 48) / 3;

export default function NewPaperScreen({ navigation }: any) {
  const [step, setStep]       = useState<Step>("details");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef             = useRef<any>(null);

  // Form fields
  const [name, setName]             = useState("");
  const [subject, setSubject]       = useState("");
  const [classVal, setClassVal]     = useState("");
  const [totalMarks, setTotalMarks] = useState("");

  // Question paper photos
  const [photos, setPhotos]   = useState<PhotoPage[]>([]);
  const [progress, setProgress] = useState("");

  // ─── Step 1: Details ──────────────────────────────────────────────────────
  if (step === "details") {
    const valid = name.trim().length > 0 && parseInt(totalMarks) > 0;
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {/* Header */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>New Paper</Text>
            <View style={{ width: 48 }} />
          </View>

          <Text style={styles.stepHint}>Step 1 of 2 — Test details</Text>

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

          <TouchableOpacity
            style={[styles.primaryBtn, !valid && styles.disabledBtn]}
            onPress={() => {
              if (!valid) return;
              setStep("capture");
            }}
            disabled={!valid}
          >
            <Text style={styles.primaryBtnText}>Next: Scan Question Paper →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={async () => {
              if (!valid) return;
              // Skip question paper — create test directly
              await createTest([]);
            }}
            disabled={!valid}
          >
            <Text style={[styles.skipBtnText, !valid && { opacity: 0.3 }]}>
              Skip — create without question paper
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 2: Capture question paper ──────────────────────────────────────
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
          <TouchableOpacity onPress={() => setStep("details")}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Question Paper</Text>
          {photos.length > 0 ? (
            <TouchableOpacity onPress={() => setStep("review")}>
              <Text style={styles.nextText}>Review ({photos.length}) →</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <Text style={styles.captureHint}>Photograph each page of the question paper</Text>

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
      </View>
    );
  }

  // ─── Step 3: Review question paper pages ─────────────────────────────────
  if (step === "review") {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setStep("capture")}>
            <Text style={styles.backText}>← Add more</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{photos.length} page{photos.length !== 1 ? "s" : ""}</Text>
          <TouchableOpacity
            style={styles.uploadBtnSmall}
            onPress={() => createTest(photos)}
          >
            <Text style={styles.uploadBtnSmallText}>Create →</Text>
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
            Tap ✕ to remove a page. These are the question paper pages.
          </Text>
        </View>
      </View>
    );
  }

  // ─── Step 4: Creating ─────────────────────────────────────────────────────
  return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={styles.progressText}>{progress}</Text>
    </View>
  );

  // ─── Create test logic ────────────────────────────────────────────────────
  async function createTest(qPhotos: PhotoPage[]) {
    setStep("creating");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("subject", subject.trim());
      formData.append("class", classVal.trim());
      formData.append("totalMarks", totalMarks.trim());
      formData.append("leniency", "3");

      if (qPhotos.length > 0) {
        setProgress("Preparing question paper PDF…");
        const pdfUri = await photosToPDF(qPhotos, (cur, total) => {
          setProgress(`Processing question paper page ${cur}/${total}…`);
        });
        formData.append("questionPaper", {
          uri: pdfUri,
          name: `question-paper-${Date.now()}.pdf`,
          type: "application/pdf",
        } as any);
      }

      setProgress("Creating test on server…");
      const { test } = await api.createTest(formData);

      // Navigate directly to scan screen to start scanning notebooks
      navigation.replace("Scan", { test, freshlyCreated: true });
    } catch (e: any) {
      logError(e.message, "NewPaperScreen");
      Alert.alert("Failed to create test", e.message, [
        { text: "Try again", onPress: () => setStep("review") },
        { text: "Back to home", onPress: () => navigation.goBack() },
      ]);
    }
  }
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: c.bg },
  center:             { alignItems: "center", justifyContent: "center" },
  topBar:             { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 52 },
  screenTitle:        { fontSize: 16, fontWeight: "700", color: c.text },
  backText:           { fontSize: 14, color: c.accent, minWidth: 60 },
  nextText:           { fontSize: 14, color: c.accent, fontWeight: "600" },
  stepHint:           { fontSize: 12, color: c.textDim, marginBottom: 24, marginTop: 4 },
  label:              { fontSize: 12, fontWeight: "600", color: c.textMid, marginBottom: 6, marginTop: 16, letterSpacing: 0.3 },
  input:              { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, fontSize: 14, color: c.text, fontFamily: "System" },
  primaryBtn:         { backgroundColor: c.accent, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  primaryBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabledBtn:        { opacity: 0.35 },
  skipBtn:            { alignItems: "center", paddingVertical: 16 },
  skipBtnText:        { fontSize: 13, color: c.textDim, textDecorationLine: "underline" },
  // Camera
  captureHint:        { fontSize: 12, color: c.textDim, textAlign: "center", paddingBottom: 8 },
  cameraWrapper:      { flex: 1, position: "relative" },
  camera:             { flex: 1 },
  strip:              { position: "absolute", bottom: 8, left: 8, flexDirection: "row", gap: 4, zIndex: 10 },
  stripThumb:         { width: 44, height: 56, borderRadius: 4, borderWidth: 1, borderColor: "#fff" },
  stripMore:          { width: 44, height: 56, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  stripMoreText:      { color: "#fff", fontSize: 12, fontWeight: "700" },
  controls:           { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 24, paddingHorizontal: 32, backgroundColor: c.bg },
  galleryBtn:         { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  galleryIcon:        { fontSize: 28 },
  shutter:            { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  shutterInner:       { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
  doneCapture:        { width: 60, height: 50, backgroundColor: c.accent, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  doneCaptureText:    { color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  // Review
  uploadBtnSmall:     { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnSmallText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  thumbContainer:     { width: THUMB, height: THUMB * 1.3, margin: 4, position: "relative" },
  thumb:              { width: "100%", height: "100%", borderRadius: 6 },
  pageNum:            { position: "absolute", bottom: 4, left: 6, fontSize: 11, color: "#fff", fontWeight: "700", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  deleteBtn:          { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  deleteBtnText:      { color: "#fff", fontSize: 11, fontWeight: "700" },
  // Creating
  progressText:       { fontSize: 14, fontWeight: "600", color: c.text, marginTop: 20, paddingHorizontal: 32, textAlign: "center" },
  // Permissions
  permText:           { fontSize: 14, color: c.text, textAlign: "center", paddingHorizontal: 32, marginBottom: 20 },
});
