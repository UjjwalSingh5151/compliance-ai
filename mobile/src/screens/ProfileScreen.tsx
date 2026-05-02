/**
 * ProfileScreen
 *
 * Teacher mode  — shows CRM record (name, subject, classes) + school info.
 * Student mode  — shows CRM record (name, class, roll_no) + roll-no tip.
 *
 * Opened from the 👤 icon in the HomeScreen / StudentHomeScreen header.
 * Role is determined here by trying both endpoints; no param needed.
 */

import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { c } from "../lib/theme";

// ─── Small helper row ─────────────────────────────────────────────────────────
function InfoRow({ label, value, dim }: { label: string; value?: string | null; dim?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, dim && { color: c.textMid }]}>{value}</Text>
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading]       = useState(true);
  const [authEmail, setAuthEmail]   = useState<string | null>(null);
  const [school, setSchool]         = useState<any>(null);
  const [teacher, setTeacher]       = useState<any>(null);   // null = no CRM record or not a teacher
  const [student, setStudent]       = useState<any>(null);   // null = not a student

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Get auth email
      const { data: { session } } = await supabase.auth.getSession();
      setAuthEmail(session?.user?.email ?? null);

      // Try teacher path
      const [schoolRes, teacherRes] = await Promise.allSettled([
        api.getMySchool(),
        api.getMyTeacherProfile(),
      ]);
      if (schoolRes.status === "fulfilled") {
        setSchool(schoolRes.value.school ?? null);
        if (teacherRes.status === "fulfilled") {
          setTeacher(teacherRes.value.teacher ?? null);
        }
      } else {
        // Not a teacher — try student path
        const studentRes = await api.getStudentMe().catch(() => null);
        if (studentRes?.student) setStudent(studentRes.student);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () =>
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const isTeacher = !!school;
  const isStudent = !!student;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar / identity */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(isTeacher ? (teacher?.name || authEmail) : (student?.name || authEmail) || "?")
                .charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.avatarName}>
            {isTeacher ? (teacher?.name || "Teacher") : (student?.name || "Student")}
          </Text>
          <Text style={styles.avatarEmail}>{authEmail}</Text>
          <View style={[styles.rolePill, { backgroundColor: isTeacher ? `${c.accent}20` : `${c.success}20` }]}>
            <Text style={[styles.roleText, { color: isTeacher ? c.accent : c.success }]}>
              {isTeacher ? (school ? `🏫 ${school.name}` : "Teacher") : "📚 Student"}
            </Text>
          </View>
        </View>

        {/* ── Teacher info ── */}
        {isTeacher && (
          <>
            {teacher ? (
              <Section title="YOUR DETAILS">
                <InfoRow label="Name"       value={teacher.name} />
                <InfoRow label="Subject"    value={teacher.subject} />
                <InfoRow label="Class"      value={teacher.class_assigned || teacher.class} />
                <InfoRow label="Phone"      value={teacher.phone} dim />
                <InfoRow label="Email"      value={teacher.email || authEmail} dim />
              </Section>
            ) : (
              <Section title="YOUR DETAILS">
                <Text style={styles.noticeText}>
                  Your email isn't linked to a teacher record in the CRM yet.{"\n"}
                  Ask your school admin to add your email to the Teacher list.
                </Text>
                <InfoRow label="Email" value={authEmail} dim />
              </Section>
            )}

            <Section title="SCHOOL">
              <InfoRow label="School name"  value={school?.name} />
              <InfoRow label="Status"       value={school?.status} />
              <InfoRow label="Your role"    value={school ? "Teacher" : "—"} dim />
            </Section>

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                ✏️  To update your name, subject or class assignment, ask your school admin to edit your record in the web portal.
              </Text>
            </View>
          </>
        )}

        {/* ── Student info ── */}
        {isStudent && (
          <>
            <Section title="YOUR DETAILS">
              <InfoRow label="Name"         value={student.name} />
              <InfoRow label="Class"        value={student.class} />
              <InfoRow label="Section"      value={student.section} />
              <InfoRow label="Roll Number"  value={student.roll_no} />
              <InfoRow label="Academic Year" value={student.academic_year} dim />
              <InfoRow label="Email"        value={student.email || authEmail} dim />
            </Section>

            {student.roll_no && (
              <View style={[styles.notice, { borderColor: `${c.accent}30`, backgroundColor: `${c.accent}0C` }]}>
                <Text style={[styles.noticeText, { color: c.accent }]}>
                  📝  Your roll number is <Text style={{ fontWeight: "700" }}>{student.roll_no}</Text>.
                  Make sure this matches exactly what you write on your answer sheets so your results are linked automatically.
                </Text>
              </View>
            )}

            {!student.roll_no && (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  ⚠️  No roll number on file. Ask your school admin to add your roll number so answer sheets can be auto-linked to your account.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Fallback ── */}
        {!isTeacher && !isStudent && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Your account isn't linked to any school yet.{"\n"}
              Ask your school admin to add your email.
            </Text>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: c.bg },
  center:       { alignItems: "center", justifyContent: "center" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  backText:     { fontSize: 14, color: c.accent, minWidth: 52 },
  headerTitle:  { fontSize: 16, fontWeight: "700", color: c.text },
  scroll:       { padding: 20, paddingBottom: 48 },
  // Avatar
  avatarCard:   { alignItems: "center", marginBottom: 24 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarLetter: { fontSize: 30, fontWeight: "700", color: "#fff" },
  avatarName:   { fontSize: 20, fontWeight: "700", color: c.text, marginBottom: 4 },
  avatarEmail:  { fontSize: 13, color: c.textMid, marginBottom: 10 },
  rolePill:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText:     { fontSize: 13, fontWeight: "600" },
  // Section
  section:      { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: c.textDim, letterSpacing: 0.8, marginBottom: 12 },
  // Info row
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border },
  infoLabel:    { fontSize: 13, color: c.textMid, flex: 1 },
  infoValue:    { fontSize: 13, color: c.text, fontWeight: "600", flex: 2, textAlign: "right" },
  // Notice
  notice:       { backgroundColor: `${c.warning}12`, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: `${c.warning}30`, marginBottom: 12 },
  noticeText:   { fontSize: 12, color: c.textMid, lineHeight: 18 },
  // Sign out
  signOutBtn:   { marginTop: 16, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, alignItems: "center" },
  signOutText:  { fontSize: 14, color: c.danger, fontWeight: "600" },
});
