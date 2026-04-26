import { useState, useEffect } from "react";
import { supabase, authEnabled } from "./lib/supabase";
import { c } from "./lib/theme";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import NewTest from "./components/NewTest";
import BulkUpload from "./components/BulkUpload";
import StudentList from "./components/StudentList";
import StudentDetail from "./components/StudentDetail";
import ResultDetail from "./components/ResultDetail";
import ShareView from "./components/ShareView";

// Hash-based router: #/share/<token> is the only public route
function getShareToken() {
  const hash = window.location.hash;
  if (hash.startsWith("#/share/")) return hash.replace("#/share/", "");
  return null;
}

const NAV = [
  { id: "dashboard", label: "Tests",    icon: "📝" },
  { id: "students",  label: "Students", icon: "👥" },
];

export default function App() {
  const shareToken = getShareToken();
  if (shareToken) return <ShareView token={shareToken} />;

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(authEnabled);
  const [view, setView] = useState("dashboard");
  const [params, setParams] = useState({});

  useEffect(() => {
    if (!authEnabled) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navigate = (v, p = {}) => { setView(v); setParams(p); };

  if (authLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, color: c.textDim, fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (authEnabled && !user) return <AuthScreen />;

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;

  const renderView = () => {
    switch (view) {
      case "dashboard":     return <Dashboard navigate={navigate} />;
      case "new-test":      return <NewTest navigate={navigate} />;
      case "upload":        return <BulkUpload params={params} navigate={navigate} />;
      case "students":      return <StudentList navigate={navigate} />;
      case "student-detail":return <StudentDetail params={params} navigate={navigate} />;
      case "result":        return <ResultDetail params={params} navigate={navigate} />;
      default:              return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: c.bg, color: c.text, fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 200, background: "#0d1117", borderRight: `1px solid ${c.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>📝 EduGrade</div>
          <div style={{ fontSize: 10, color: c.textDim, marginTop: 2 }}>AI Answer Sheet Analyzer</div>
        </div>

        <nav style={{ flex: 1, padding: "10px 0" }}>
          {NAV.map((tab) => (
            <button key={tab.id} onClick={() => navigate(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 16px", background: view === tab.id ? c.accentDim : "transparent",
                border: "none", borderLeft: `3px solid ${view === tab.id ? c.accent : "transparent"}`,
                color: view === tab.id ? c.accent : c.textMid,
                fontSize: 13, fontWeight: view === tab.id ? 600 : 400,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}
            >
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: `1px solid ${c.border}` }}>
          {userName && (
            <div style={{ fontSize: 11, color: c.textMid, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName}
            </div>
          )}
          {authEnabled && user && (
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 11, color: c.textDim, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
              Log out
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {renderView()}
      </div>
    </div>
  );
}
