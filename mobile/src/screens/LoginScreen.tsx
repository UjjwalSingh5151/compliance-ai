import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { signIn } from "../lib/auth";
import { c } from "../lib/theme";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await signIn({ method: "email", email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
    // On success, the auth listener in App.tsx handles navigation automatically
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
        <Text style={styles.subtitle}>Teacher Portal</Text>

        {/* Form */}
        <View style={styles.card}>
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
          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={c.textDim}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Log In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Use the same credentials as the EduGrade web portal.{"\n"}
          Contact your school admin if you need access.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: c.bg },
  container:  { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  logoEmoji:  { fontSize: 28, marginRight: 8 },
  logoText:   { fontSize: 28, fontWeight: "700", color: c.text },
  subtitle:   { textAlign: "center", fontSize: 13, color: c.textMid, marginBottom: 32 },
  card:       { backgroundColor: c.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: c.border },
  label:      { fontSize: 12, color: c.textMid, marginBottom: 6, fontWeight: "600" },
  input:      { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, color: c.text, fontSize: 15 },
  btn:        { backgroundColor: c.accent, borderRadius: 8, padding: 14, alignItems: "center", marginTop: 20 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  hint:       { marginTop: 24, textAlign: "center", fontSize: 12, color: c.textDim, lineHeight: 18 },
});
