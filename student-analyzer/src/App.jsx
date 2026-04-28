import { useState, useEffect } from "react";
import { supabase, authEnabled } from "./lib/supabase";
import { useIsMobile } from "./lib/mobile";
import { api } from "./lib/api";
import { c } from "./lib/theme";
import AuthScreen from "./components/AuthScreen";
import SchoolSetup from "./components/SchoolSetup";
import PendingApproval from "./components/PendingApproval";
import Dashboard from "./components/Dashboard";
import NewTest from "./components/NewTest";
import BulkUpload from "./components/BulkUpload";
import StudentList from "./components/StudentList";
import StudentDetail from "./components/StudentDetail";
import ResultDetail from "./components/ResultDetail";
import ShareView from "./components/ShareView";
import AdminPanel from "./components/AdminPanel";
import SchoolSettings from "./components/SchoolSettings";
import StudentCRM from "./components/StudentCRM";
import StudentPortal from "./components/StudentPortal";
import StudentResultView from "./components/StudentResultView";
import TestResults from "./components/TestResults";

const ADMIN_USER_ID = "7f3cd39a-ec15-4053-9c6a-0afad38d2f46";

function getShareToken() {
  const hash = window.location.hash;
  if (hash.startsWith("#/share/")) return hash.replace("#/share/", "");
  return null;
}

// Build hash string from view + params
function viewToHash(v, p = {}) {
  if (v === "dashboard") return "#/";
  if (p.testId) return `#/${v}/${p.testId}`;
  if (p.resultId) return `#/${v}/${p.resultId}`;
  if (p.studentId) return `#/${v}/${p.studentId}`;
  return `#/${v}`;
}

// Parse hash into { view, params } on initial load
function hashToView() {
  const hash = window.location.hash;
  if (!hash || hash === "#" || hash === "#/") return { view: "dashboard", params: {} };
  if (hash.startsWith("#/share/")) return { view: "dashboard", params: {} }; // handled separately
  const parts = hash.replace(/^#\//, "").split("/");
  const v = parts[0];
  const id = parts[1];
  if (v === "result" && id) return { view: "result", params: { resultId: id } };
  if (v === "test-results" && id) return { view: "test-results", params: { testId: id } };
  if (v === "student-detail" && id) return { view: "student-detail", params: { studentId: id } };
  if (v === "upload" && id) return { view: "upload", params: { testId: id } };
  return { view: v || "dashboard", params: {} };
}

export default function App() {
  const shareToken = getShareToken();
  if (shareToken) return <ShareView token={shareToken} />;

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(authEnabled);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const initial = hashToView();
  const [view, setView] = useState(initial.view);
  const [params, setParams] = useState(initial.params);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!authEnabled) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      // Only update if user actually changed — avoids re-fetching school on every token refresh
      setUser(prev => {
        const next = session?.user ?? null;
        return prev?.id === next?.id ? prev : next;
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  // Browser back/forward support
  useEffect(() => {
    window.history.replaceState({ view: initial.view, params: initial.params }, "", viewToHash(initial.view, initial.params));
    const handlePop = (e) => {
      if (e.state?.view) {
        setView(e.state.view);
        setParams(e.state.params || {});
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Load school/student info whenever user changes
  useEffect(() => {
    if (!user) { setSchoolInfo(null); setStudentInfo(null); return; }
    setSchoolLoading(true);
    api.getMySchool()
      .then((info) => {
        setSchoolInfo(info);
        if (!info || info.status === "none") {
          // Check if this user is a student
          api.getStudentMe()
            .then((s) => setStudentInfo(s?.student || null))
            .catch(() => setStudentInfo(null));
        }
      })
      .catch(() => setSchoolInfo({ status: "none" }))
      .finally(() => setSchoolLoading(false));
  }, [user]);

  const navigate = (v, p = {}) => {
    const hash = viewToHash(v, p);
    window.history.pushState({ view: v, params: p }, "", hash);
    setView(v);
    setParams(p);
  };
  const isAdmin = user?.id === ADMIN_USER_ID;

  const isOwner = isAdmin || schoolInfo?.role === "owner";
  const NAV = [
    { id: "dashboard",       label: "Tests",    icon: "📝" },
    ...(isOwner ? [{ id: "students",     label: "Students", icon: "👥" }] : []),
    ...(isOwner ? [{ id: "student-crm",  label: "CRM",      icon: "🗂️" }] : []),
    ...(isOwner ? [{ id: "school-settings", label: "Invite Teacher", icon: "✉️" }] : []),
    ...(isAdmin  ? [{ id: "admin",       label: "Admin",    icon: "🔑" }] : []),
  ];

  if (authLoading || schoolLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, color: c.textDim, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (authEnabled && !user) return <AuthScreen />;

  // Student portal (detected by email match in CRM)
  if (authEnabled && user && !isAdmin && studentInfo && (!schoolInfo || schoolInfo.status === "none")) {
    const studentNAV = [{ id: "student-portal", label: "My Results", icon: "📋" }];
    return (
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: c.bg, color: c.text, fontFamily: "'Inter', sans-serif" }}>
        {!isMobile && (
          <div style={{ width: 200, background: "#0d1117", borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "20px 16px", borderBottom: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
              <div style={{ fontSize: 10, color: c.textDim, marginTop: 2 }}>Student Portal</div>
            </div>
            <nav style={{ flex: 1, padding: "10px 0" }}>
              {studentNAV.map((tab) => (
                <button key={tab.id} onClick={() => navigate(tab.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px", background: view === tab.id ? c.accentDim : "transparent", border: "none", borderLeft: `3px solid ${view === tab.id ? c.accent : "transparent"}`, color: view === tab.id ? c.accent : c.textMid, fontSize: 13, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <span>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </nav>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${c.border}` }}>
              <button onClick={() => supabase.auth.signOut()}
                style={{ fontSize: 11, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                Log out
              </button>
            </div>
          </div>
        )}
        {isMobile && (
          <div style={{ background: "#0d1117", borderBottom: `1px solid ${c.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 11, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
              Log out
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {view === "student-result"
            ? <StudentResultView params={params} navigate={navigate} isMobile={isMobile} />
            : <StudentPortal navigate={navigate} isMobile={isMobile} />}
        </div>
      </div>
    );
  }

  // School gating (admin always bypasses)
  if (authEnabled && user && !isAdmin) {
    if (!schoolInfo || schoolInfo.status === "none") {
      return <SchoolSetup isMobile={isMobile} onDone={() => {
        api.getMySchool().then(setSchoolInfo);
      }} />;
    }
    if (schoolInfo.status === "pending") {
      return <PendingApproval school={schoolInfo.school} />;
    }
    // rejected
    if (schoolInfo.status === "rejected") {
      return (
        <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, flexDirection: "column", gap: 12, padding: 24 }}>
          <div style={{ fontSize: 36 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Application Rejected</div>
          <div style={{ fontSize: 13, color: c.textMid, textAlign: "center", maxWidth: 360 }}>Your school registration was not approved. Contact the platform admin for more information.</div>
          <button style={{ fontSize: 12, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
            onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      );
    }
  }

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;

  const renderView = () => {
    switch (view) {
      case "dashboard":      return <Dashboard navigate={navigate} isMobile={isMobile} />;
      case "new-test":       return <NewTest navigate={navigate} isMobile={isMobile} />;
      case "upload":         return <BulkUpload params={params} navigate={navigate} isMobile={isMobile} />;
      case "test-results":   return <TestResults params={params} navigate={navigate} isMobile={isMobile} />;
      case "students":       return <StudentList navigate={navigate} isMobile={isMobile} />;
      case "student-detail": return <StudentDetail params={params} navigate={navigate} isMobile={isMobile} />;
      case "result":         return <ResultDetail params={params} navigate={navigate} isMobile={isMobile} />;
      case "student-crm":    return <StudentCRM navigate={navigate} isMobile={isMobile} />;
      case "school-settings": return <SchoolSettings school={schoolInfo?.school} isMobile={isMobile} />;
      case "student-portal": return <StudentPortal navigate={navigate} isMobile={isMobile} />;
      case "student-result": return <StudentResultView params={params} navigate={navigate} isMobile={isMobile} />;
      case "admin":          return isAdmin ? <AdminPanel navigate={navigate} isMobile={isMobile} /> : <Dashboard navigate={navigate} isMobile={isMobile} />;
      default:               return <Dashboard navigate={navigate} isMobile={isMobile} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: c.bg, color: c.text, fontFamily: "'Inter', sans-serif" }}>

      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{ width: 200, background: "#0d1117", borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 16px", borderBottom: `1px solid ${c.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
            <div style={{ fontSize: 10, color: c.textDim, marginTop: 2 }}>
              {schoolInfo?.school?.name || "AI Answer Sheet Analyzer"}
            </div>
          </div>
          <nav style={{ flex: 1, padding: "10px 0" }}>
            {NAV.map((tab) => (
              <button key={tab.id} onClick={() => navigate(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px",
                  background: view === tab.id ? c.accentDim : "transparent", border: "none",
                  borderLeft: `3px solid ${view === tab.id ? c.accent : "transparent"}`,
                  color: view === tab.id ? c.accent : c.textMid,
                  fontSize: 13, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${c.border}` }}>
            {userName && <div style={{ fontSize: 11, color: c.textMid, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>}
            <div style={{ fontSize: 10, color: c.textDim, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {schoolInfo?.role === "owner" ? "School Owner" : "Teacher"}
            </div>
            {authEnabled && user && (
              <button onClick={() => supabase.auth.signOut()}
                style={{ fontSize: 11, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                Log out
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div style={{ background: "#0d1117", borderBottom: `1px solid ${c.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
            {schoolInfo?.school?.name && <div style={{ fontSize: 10, color: c.textDim, marginTop: 1 }}>{schoolInfo.school.name}</div>}
          </div>
          {authEnabled && user && (
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 11, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
              Log out
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: isMobile ? 64 : 0 }}>
        {renderView()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d1117", borderTop: `1px solid ${c.border}`, display: "flex", zIndex: 100 }}>
          {NAV.map((tab) => (
            <button key={tab.id} onClick={() => navigate(tab.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, padding: "10px 4px", background: "transparent", border: "none",
                borderTop: `2px solid ${view === tab.id ? c.accent : "transparent"}`,
                color: view === tab.id ? c.accent : c.textDim,
                fontSize: 9, fontWeight: view === tab.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
              }}>
              <span style={{ fontSize: 18 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
