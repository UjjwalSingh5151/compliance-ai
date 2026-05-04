/**
 * LoginScreen — email OTP (no passwords)
 *
 * Step 1 (email)  : enter email → "Send Code"
 * Step 2 (verify) : enter 6-digit code → "Verify"
 *                   auto-submits once all 6 digits are typed
 *
 * Works for teachers (admin-invited, or new) and students (CRM-matched by email).
 * On success, Supabase fires the auth state listener in AppNavigator.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Keyboard,
} from "react-native";
import { sendEmailOtp, verifyEmailOtp, signInWithPassword } from "../lib/auth";

// ─── Bypass accounts (no OTP — direct password login) ─────────────────────────
// Add any internal email here. Set the matching password in Supabase Dashboard →
// Authentication → Users → [user] → Reset Password (set a custom one).
const BYPASS_EMAILS: Record<string, string> = {
  // "student@kelzo.app":  "your-student-pin",
  // "teacher@kelzo.app":  "your-teacher-pin",
};
import { c } from "../lib/theme";

type Step = "email" | "verify" | "pin";

const RESEND_SECONDS = 30;

export default function LoginScreen() {
  const [step, setStep]         = useState<Step>("email");
  const [email, setEmail]       = useState("");
  const [code, setCode]         = useState("");
  const [pin, setPin]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef                 = useRef<TextInput>(null);

  // ── Countdown timer for resend ─────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(timerRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  // ── Auto-verify when all 6 digits filled ──────────────────────────────────
  useEffect(() => {
    if (code.length === 6 && step === "verify" && !loading) {
      Keyboard.dismiss();
      handleVerify();
    }
  }, [code]);

  // ── Send OTP (or go straight to PIN for bypass accounts) ─────────────────
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    setEmail(trimmed);

    // Bypass: known internal account → skip OTP, go to PIN step
    if (trimmed in BYPASS_EMAILS) {
      setPin("");
      setStep("pin");
      return;
    }

    setLoading(true);
    const { error } = await sendEmailOtp(trimmed);
    setLoading(false);
    if (error) {
      Alert.alert("Could not send code", error.message);
      return;
    }
    setCode("");
    setStep("verify");
    setCountdown(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 300);
  };

  // ── Sign in with PIN (bypass accounts only) ────────────────────────────────
  const handlePinLogin = async () => {
    const password = BYPASS_EMAILS[email];
    if (!password) return;
    setLoading(true);
    const { error } = await signInWithPassword(email, password);
    setLoading(false);
    if (error) {
      Alert.alert("Incorrect PIN", "The PIN you entered is wrong. Try again.");
      setPin("");
    }
    // On success AppNavigator auth listener handles navigation
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Incomplete code", "Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    const { error } = await verifyEmailOtp(email, code);
    setLoading(false);
    if (error) {
      Alert.alert("Incorrect code", "The code doesn't match or has expired. Try resending.");
      setCode("");
    }
    // On success the AppNavigator auth listener handles navigation automatically
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    const { error } = await sendEmailOtp(email);
    setLoading(false);
    if (error) {
      Alert.alert("Could not resend", error.message);
      return;
    }
    setCode("");
    setCountdown(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 300);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>📝</Text>
          <Text style={styles.logoText}>Kelzo</Text>
        </View>
        <Text style={styles.subtitle}>AI Answer Sheet Grading</Text>

        {/* ── Step 1: Email ── */}
        {step === "email" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardHint}>
              We'll send a 6-digit code to your email — no password needed.
            </Text>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="teacher@school.edu"
              placeholderTextColor={c.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleSendCode}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send Code →</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 1b: PIN (bypass accounts) ── */}
        {step === "pin" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter your PIN</Text>
            <Text style={styles.cardHint}>
              Signing in as{" "}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            <TextInput
              style={styles.codeInput}
              value={pin}
              onChangeText={setPin}
              placeholder="• • • • • •"
              placeholderTextColor={c.textDim}
              secureTextEntry
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handlePinLogin}
            />

            <TouchableOpacity
              style={[styles.btn, (loading || pin.length === 0) && styles.btnDisabled]}
              onPress={handlePinLogin}
              disabled={loading || pin.length === 0}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Sign In →</Text>
              }
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <TouchableOpacity onPress={() => { setStep("email"); setPin(""); }}>
                <Text style={styles.resendLink}>← Change email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 2: Verify ── */}
        {step === "verify" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter the code</Text>
            <Text style={styles.cardHint}>
              Sent to{" "}
              <Text style={styles.emailHighlight}>{email}</Text>
              {"\n"}Check your inbox (and spam folder).
            </Text>

            {/* Single wide input — large monospace digits */}
            <TextInput
              ref={codeRef}
              style={styles.codeInput}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="• • • • • •"
              placeholderTextColor={c.textDim}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />

            <TouchableOpacity
              style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={loading || code.length !== 6}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify →</Text>
              }
            </TouchableOpacity>

            {/* Resend row */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <Text style={styles.resendCountdown}>
                  Resend in {countdown}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={loading}>
                  <Text style={styles.resendLink}>Resend code</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.resendSep}>·</Text>
              <TouchableOpacity onPress={() => { setStep("email"); setCode(""); }}>
                <Text style={styles.resendLink}>Change email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Footer hint */}
        <Text style={styles.footerHint}>
          {step === "email"
            ? "Use the email your school admin added for you."
            : step === "pin"
            ? "Use the PIN set for this account."
            : "The code expires in 10 minutes."}
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: c.bg },
  container:        { flexGrow: 1, justifyContent: "center", padding: 24 },
  // Logo
  logoRow:          { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoEmoji:        { fontSize: 28, marginRight: 8 },
  logoText:         { fontSize: 28, fontWeight: "700", color: c.text },
  subtitle:         { textAlign: "center", fontSize: 13, color: c.textMid, marginBottom: 36 },
  // Card
  card:             { backgroundColor: c.card, borderRadius: 14, padding: 22, borderWidth: 1, borderColor: c.border },
  cardTitle:        { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 6 },
  cardHint:         { fontSize: 13, color: c.textMid, lineHeight: 19, marginBottom: 20 },
  emailHighlight:   { color: c.accent, fontWeight: "600" },
  // Form
  label:            { fontSize: 12, color: c.textMid, marginBottom: 6, fontWeight: "600" },
  input:            { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 13, color: c.text, fontSize: 15 },
  btn:              { backgroundColor: c.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 18 },
  btnDisabled:      { opacity: 0.5 },
  btnText:          { color: "#fff", fontWeight: "700", fontSize: 15 },
  // OTP code input
  codeInput:        { backgroundColor: c.bg, borderWidth: 2, borderColor: c.accent, borderRadius: 10, padding: 16, fontSize: 32, fontWeight: "700", color: c.text, letterSpacing: 12, marginBottom: 4, marginTop: 6 },
  // Resend
  resendRow:        { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 18, gap: 8 },
  resendSep:        { color: c.textDim },
  resendLink:       { fontSize: 13, color: c.accent, fontWeight: "600" },
  resendCountdown:  { fontSize: 13, color: c.textDim },
  // Footer
  footerHint:       { marginTop: 20, textAlign: "center", fontSize: 12, color: c.textDim, lineHeight: 18 },
});
