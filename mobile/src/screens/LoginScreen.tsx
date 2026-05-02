import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { signIn, signUp } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { c } from "../lib/theme";

type Tab = "login" | "signup" | "forgot";

export default function LoginScreen() {
  const [tab, setTab]           = useState<Tab>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);

  const reset = (t: Tab) => {
    setTab(t);
    setEmail(""); setPassword(""); setConfirm("");
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await signIn({ method: "email", email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
    // On success auth listener in AppNavigator handles navigation
  };

  // ── Sign up ────────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirm.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", "Please make sure both passwords are the same.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error } = await signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert(
        "Account created",
        "You're signed in. If your school admin has added your email, you'll see your dashboard now.",
      );
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (!email.trim()) {
      Alert.alert("Enter your email", "Type your email address above first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://app.kelzo.ai",
    });
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert(
        "Reset link sent",
        `Check ${email.trim()} for a password reset link. Open it in your browser, set a new password, then log in here.`,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoEmoji}>📝</Text>
          <Text style={styles.logoText}>EduGrade</Text>
        </View>
        <Text style={styles.subtitle}>AI Answer Sheet Grading</Text>

        {/* Tab bar */}
        <View style={styles.tabRow}>
          {(["login", "signup", "forgot"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => reset(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === "login" ? "Log In" : t === "signup" ? "Sign Up" : "Forgot"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Email — shared across all tabs */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="teacher@school.edu"
            placeholderTextColor={c.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password — login + signup */}
          {tab !== "forgot" && (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={c.textDim}
                secureTextEntry
              />
            </>
          )}

          {/* Confirm password — signup only */}
          {tab === "signup" && (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                placeholderTextColor={c.textDim}
                secureTextEntry
              />
            </>
          )}

          {/* Action button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={tab === "login" ? handleLogin : tab === "signup" ? handleSignUp : handleForgot}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {tab === "login" ? "Log In" : tab === "signup" ? "Create Account" : "Send Reset Link"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Hints */}
        {tab === "login" && (
          <Text style={styles.hint}>
            First time? Use Sign Up to create your account.{"\n"}
            Forgot your password? Tap Forgot above.
          </Text>
        )}
        {tab === "signup" && (
          <Text style={styles.hint}>
            Use the email your school admin added for you.{"\n"}
            You'll be linked to your school automatically.
          </Text>
        )}
        {tab === "forgot" && (
          <Text style={styles.hint}>
            Enter your email and we'll send a reset link.{"\n"}
            Open the link in your browser to set a new password.
          </Text>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: c.bg },
  container:      { flexGrow: 1, justifyContent: "center", padding: 24 },
  // Logo
  logoRow:        { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoEmoji:      { fontSize: 28, marginRight: 8 },
  logoText:       { fontSize: 28, fontWeight: "700", color: c.text },
  subtitle:       { textAlign: "center", fontSize: 13, color: c.textMid, marginBottom: 28 },
  // Tabs
  tabRow:         { flexDirection: "row", backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 3, marginBottom: 16 },
  tabBtn:         { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive:   { backgroundColor: c.accent },
  tabLabel:       { fontSize: 13, fontWeight: "600", color: c.textMid },
  tabLabelActive: { color: "#fff" },
  // Card
  card:           { backgroundColor: c.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: c.border },
  label:          { fontSize: 12, color: c.textMid, marginBottom: 6, fontWeight: "600" },
  input:          { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, color: c.text, fontSize: 15 },
  btn:            { backgroundColor: c.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 20 },
  btnDisabled:    { opacity: 0.6 },
  btnText:        { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint:           { marginTop: 20, textAlign: "center", fontSize: 12, color: c.textDim, lineHeight: 18 },
});
