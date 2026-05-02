/**
 * AppNavigator — handles:
 *  1. Auth state (logged in / out)
 *  2. Role detection (teacher vs student) after login
 *  3. Deep link config for share links (https://app.kelzo.ai/share/:token)
 */
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import * as ExpoLinking from "expo-linking";

import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
import { c } from "../lib/theme";

// Screens
import LoginScreen            from "../screens/LoginScreen";
import HomeScreen             from "../screens/HomeScreen";
import NewPaperScreen         from "../screens/NewPaperScreen";
import SelectTestScreen       from "../screens/SelectTestScreen";
import ScanScreen             from "../screens/ScanScreen";
import TestResultsScreen      from "../screens/TestResultsScreen";
import ResultDetailScreen     from "../screens/ResultDetailScreen";
import CorrectedCopiesScreen  from "../screens/CorrectedCopiesScreen";
import ShareResultScreen      from "../screens/ShareResultScreen";
import StudentHomeScreen      from "../screens/StudentHomeScreen";
import StudentResultDetailScreen from "../screens/StudentResultDetailScreen";

// ─── Deep link config ─────────────────────────────────────────────────────────
// Maps https://app.kelzo.ai/share/{token}  →  ShareResult screen with { token }
// Also handles custom scheme: kelzo://share/{token}
const linking = {
  prefixes: [
    "https://app.kelzo.ai",
    "kelzo://",
    ExpoLinking.createURL("/"),   // Expo Go dev URL  (exp://...)
  ],
  config: {
    screens: {
      ShareResult: "share/:token",
    },
  },
};

// ─── Role detection ───────────────────────────────────────────────────────────
type Role = "teacher" | "student" | "unknown";

async function detectRole(): Promise<Role> {
  try {
    const school = await api.getMySchool();
    if (school?.status === "approved") return "teacher";
  } catch { /* fall through */ }
  try {
    const { student } = await api.getStudentMe();
    if (student) return "student";
  } catch { /* fall through */ }
  return "unknown";
}

// ─── Navigator ────────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [session, setSession]       = useState<any>(undefined); // undefined = still loading
  const [role, setRole]             = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // 1. Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. Detect role after session is established
  useEffect(() => {
    if (!session) { setRole(null); return; }
    setRoleLoading(true);
    detectRole()
      .then(setRole)
      .finally(() => setRoleLoading(false));
  }, [session?.user?.id]);   // only re-detect when the actual user changes

  // Show spinner while session loads or role is being detected
  if (session === undefined || (session && roleLoading)) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>📝</Text>
        <ActivityIndicator color={c.accent} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "slide_from_right",
        }}
      >
        {!session ? (
          /* ── Not logged in ── */
          <>
            <Stack.Screen name="Login"       component={LoginScreen} />
            {/* ShareResult available without auth — recipient may not have an account */}
            <Stack.Screen name="ShareResult" component={ShareResultScreen} />
          </>
        ) : role === "student" ? (
          /* ── Student flow ── */
          <>
            <Stack.Screen name="StudentHome"         component={StudentHomeScreen} />
            <Stack.Screen name="StudentResultDetail" component={StudentResultDetailScreen} />
            <Stack.Screen name="ShareResult"         component={ShareResultScreen} />
          </>
        ) : role === "teacher" ? (
          /* ── Teacher / Admin flow ── */
          <>
            <Stack.Screen name="Home"            component={HomeScreen} />
            <Stack.Screen name="NewPaper"        component={NewPaperScreen} />
            <Stack.Screen name="SelectTest"      component={SelectTestScreen} />
            <Stack.Screen name="Scan"            component={ScanScreen} />
            <Stack.Screen name="TestResults"     component={TestResultsScreen} />
            <Stack.Screen name="ResultDetail"    component={ResultDetailScreen} />
            <Stack.Screen name="CorrectedCopies" component={CorrectedCopiesScreen} />
            <Stack.Screen name="ShareResult"     component={ShareResultScreen} />
          </>
        ) : (
          /* ── Unknown role (not a teacher or student in the system) ── */
          <>
            <Stack.Screen name="UnknownRole" component={UnknownRoleScreen} />
            <Stack.Screen name="ShareResult" component={ShareResultScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Fallback for users who are logged in but not in the system ───────────────
function UnknownRoleScreen() {
  return (
    <View style={styles.unknownContainer}>
      <Text style={styles.unknownEmoji}>🏫</Text>
      <Text style={styles.unknownTitle}>Account not linked</Text>
      <Text style={styles.unknownText}>
        Your email isn't linked to any school on EduGrade yet.{"\n\n"}
        Ask your school admin to add your email as a teacher or student,
        then sign in again.
      </Text>
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => Alert.alert("Sign out", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: signOut },
        ])}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  splash:              { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" },
  splashLogo:          { fontSize: 56 },
  unknownContainer:    { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 },
  unknownEmoji:        { fontSize: 56, marginBottom: 24 },
  unknownTitle:        { fontSize: 20, fontWeight: "700", color: c.text, marginBottom: 12 },
  unknownText:         { fontSize: 14, color: c.textMid, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  signOutBtn:          { backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: c.border },
  signOutText:         { fontSize: 14, color: c.textDim, fontWeight: "600" },
});
