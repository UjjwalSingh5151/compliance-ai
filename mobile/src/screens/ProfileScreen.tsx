/**
 * ProfileScreen
 *
 * Teacher mode  — shows CRM record (name, subjects, classes) + school.
 *                 Teachers can edit their own name, subjects, classes.
 * Student mode  — shows CRM record (name, class, roll_no). Read-only.
 *
 * Opened from the 👤 icon in HomeScreen / StudentHomeScreen header.
 */

import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from "react-native";
import { api, TeacherProfile } from "../lib/api";
import { signOut } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { c } from "../lib/theme";

// ─── Small display row ────────────────────────────────────────────────────────
function InfoRow({ label, value, dim }: { label: string; value?: string | null; dim?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, dim && { color: c.textMid }]}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────
function EditRow({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || ""}
        placeholderTextColor={c.textDim}
        autoCorrect={false}
      />
      {hint && <Text style={styles.editHint}>{hint}</Text>}
    </View>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [school, setSchool]       = useState<any>(null);
  const [teacher, setTeacher]     = useState<TeacherProfile | null>(null);
  const [student, setStudent]     = useState<any>(null);

  // Edit mode state (teachers only)
  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState("");
  const [editSubjects, setEditSubjects] = useState(""); // comma-separated string
  const [editClasses, setEditClasses]   = useState(""); // comma-separated string

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthEmail(session?.user?.email ?? null);

      const [schoolRes, teacherRes] = await Promise.allSettled([
        api.getMySchool(),
        api.getMyTeacherProfile(),
      ]);
      if (schoolRes.status === "fulfilled" && schoolRes.value.school) {
        setSchool(schoolRes.value.school);
        const t = teacherRes.status === "fulfilled" ? teacherRes.value.teacher : null;
        setTeacher(t);
        // If teacher has no CRM record yet, auto-enter edit mode so they can create one
        if (!t) {
          setEditName("");
          setEditSubjects("");
          setEditClasses("");
          setEditing(true);
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

  const startEditing = () => {
    setEditName(teacher?.name || "");
    setEditSubjects((teacher?.subjects || []).join(", "));
    setEditClasses((teacher?.classes || []).join(", "));
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveProfile = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) { Alert.alert("Name required", "Please enter your name."); return; }
    setSaving(true);
    try {
      const subjects = editSubjects.split(",").map((s) => s.trim()).filter(Boolean);
      const classes  = editClasses.split(",").map((s) => s.trim()).filter(Boolean);
      const { teacher: updated } = await api.updateMyTeacherProfile({ name: trimmedName, subjects, classes });
      setTeacher(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
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
  const displayName = isTeacher
    ? (teacher?.name || authEmail || "Teacher")
    : (student?.name || authEmail || "Student");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {editing ? (
          <TouchableOpacity onPress={cancelEditing}>
            <Text style={styles.headerAction}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerAction}>← Back</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle}>{editing ? "Edit Profile" : "My Profile"}</Text>

        {/* Edit button — only teachers with a CRM record */}
        {!editing && isTeacher && teacher && (
          <TouchableOpacity onPress={startEditing} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✏️ Edit</Text>
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        )}
        {!editing && isTeacher && !teacher && <View style={{ width: 64 }} />}
        {!editing && !isTeacher && <View style={{ width: 64 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Avatar / identity */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.avatarName}>{displayName}</Text>
          <Text style={styles.avatarEmail}>{authEmail}</Text>
          <View style={[styles.rolePill, { backgroundColor: isTeacher ? `${c.accent}20` : `${c.success}20` }]}>
            <Text style={[styles.roleText, { color: isTeacher ? c.accent : c.success }]}>
              {isTeacher ? (school ? `🏫 ${school.name}` : "Teacher") : "📚 Student"}
            </Text>
          </View>
        </View>

        {/* ── Teacher info ─────────────────────────────────────────────────────── */}
        {isTeacher && (
          <>
            {teacher ? (
              editing ? (
                /* ── Edit mode ── */
                <Section title={teacher ? "EDIT YOUR DETAILS" : "SET UP YOUR PROFILE"}>
                  <EditRow label="Name *" value={editName} onChange={setEditName} placeholder="Your full name" />
                  <EditRow
                    label="Subjects"
                    value={editSubjects}
                    onChange={setEditSubjects}
                    placeholder="e.g. Maths, Science"
                    hint="Separate multiple subjects with commas"
                  />
                  <EditRow
                    label="Classes"
                    value={editClasses}
                    onChange={setEditClasses}
                    placeholder="e.g. 10A, 10B, 11"
                    hint="Separate multiple classes with commas"
                  />
                  <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={[styles.infoValue, { color: c.textDim, fontSize: 12 }]}>
                      {teacher.email || authEmail}{"\n"}(not editable)
                    </Text>
                  </View>
                </Section>
              ) : (
                /* ── View mode ── */
                <Section title="YOUR DETAILS">
                  <InfoRow label="Name"     value={teacher.name} />
                  <InfoRow label="Subjects" value={teacher.subjects?.join(", ")} />
                  <InfoRow label="Classes"  value={teacher.classes?.join(", ")} />
                  <InfoRow label="Email"    value={teacher.email || authEmail} dim />
                </Section>
              )
            ) : (
              <Section title="YOUR DETAILS">
                <Text style={styles.noticeText}>
                  Your email isn't linked to a teacher record in the CRM yet.{"\n"}
                  Ask your school admin to add your email to the Teacher list.
                </Text>
                <InfoRow label="Email" value={authEmail} dim />
              </Section>
            )}

            {!editing && (
              <Section title="SCHOOL">
                <InfoRow label="School name" value={school?.name} />
                <InfoRow label="Status"      value={school?.status} />
              </Section>
            )}
          </>
        )}

        {/* ── Student info ─────────────────────────────────────────────────────── */}
        {isStudent && (
          <>
            <Section title="YOUR DETAILS">
              <InfoRow label="Name"          value={student.name} />
              <InfoRow label="Class"         value={student.class} />
              <InfoRow label="Section"       value={student.section} />
              <InfoRow label="Roll Number"   value={student.roll_no} />
              <InfoRow label="Academic Year" value={student.academic_year} dim />
              <InfoRow label="Email"         value={student.email || authEmail} dim />
            </Section>

            {student.roll_no ? (
              <View style={[styles.notice, { borderColor: `${c.accent}30`, backgroundColor: `${c.accent}0C` }]}>
                <Text style={[styles.noticeText, { color: c.accent }]}>
                  📝  Your roll number is{" "}
                  <Text style={{ fontWeight: "700" }}>{student.roll_no}</Text>.
                  {" "}Write this exactly on your answer sheets so results are linked automatically.
                </Text>
              </View>
            ) : (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  ⚠️  No roll number on file. Ask your school admin to add your roll number so answer sheets can be auto-linked.
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
  // Header
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.border },
  headerAction: { fontSize: 14, color: c.accent, minWidth: 64 },
  headerTitle:  { fontSize: 16, fontWeight: "700", color: c.text },
  editBtn:      { backgroundColor: `${c.accent}18`, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: `${c.accent}40` },
  editBtnText:  { fontSize: 13, color: c.accent, fontWeight: "600" },
  saveBtn:      { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  saveBtnText:  { fontSize: 13, color: "#fff", fontWeight: "700" },
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
  // Info row (view mode)
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border },
  infoLabel:    { fontSize: 13, color: c.textMid, flex: 1 },
  infoValue:    { fontSize: 13, color: c.text, fontWeight: "600", flex: 2, textAlign: "right" },
  // Edit row (edit mode)
  editRow:      { marginBottom: 14 },
  editLabel:    { fontSize: 12, color: c.textMid, fontWeight: "600", marginBottom: 6 },
  editInput:    { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 12, fontSize: 14, color: c.text },
  editHint:     { fontSize: 11, color: c.textDim, marginTop: 4 },
  // Notice
  notice:       { backgroundColor: `${c.warning}12`, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: `${c.warning}30`, marginBottom: 12 },
  noticeText:   { fontSize: 12, color: c.textMid, lineHeight: 18 },
  // Sign out
  signOutBtn:   { marginTop: 16, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14, alignItems: "center" },
  signOutText:  { fontSize: 14, color: c.danger, fontWeight: "600" },
});
