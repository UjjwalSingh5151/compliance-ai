import { useState, useEffect } from "react";
import { colors } from "./lib/compliance-data";
import { supabase, authEnabled } from "./lib/supabase";
import Auth from "./components/Auth";
import AgentChat from "./components/AgentChat";
import Reconciliation from "./components/Reconciliation";
import Calendar from "./components/Calendar";
import NoticeDecoder from "./components/NoticeDecoder";

const tabs = [
  { id: "chat", label: "AI Agent", icon: "🤖" },
  { id: "recon", label: "Recon", icon: "⚖️" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "notices", label: "Notices", icon: "📋" },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("chat");
  const [reconResults, setReconResults] = useState(null);
  const [agentMessages, setAgentMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(authEnabled);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!authEnabled) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onAgentMessage = (text, switchToChat = true) => {
    setAgentMessages((prev) => [...prev, text]);
    if (switchToChat) setActiveTab("chat");
  };

  const handleLogout = () => supabase.auth.signOut();

  if (authLoading) {
    return (
      <div style={{ height: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textDim, fontFamily: "'Inter', sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (authEnabled && !user) return <Auth />;

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Inter', sans-serif" }}>

      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{ width: 200, background: colors.card, borderRight: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0 }}>
          <div style={{ padding: "0 16px 20px", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.accent }}>ComplianceAI</div>
            <div style={{ fontSize: 10, color: colors.textDim, marginTop: 2 }}>GST · TDS · ITR</div>
          </div>
          <nav style={{ flex: 1, padding: "12px 0" }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 16px", background: activeTab === tab.id ? colors.accentDim : "transparent",
                  border: "none", borderLeft: `3px solid ${activeTab === tab.id ? colors.accent : "transparent"}`,
                  color: activeTab === tab.id ? colors.accent : colors.textMid,
                  fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400, cursor: "pointer", textAlign: "left",
                }}
              >
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>
          {/* User + logout */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.border}` }}>
            {userName && <div style={{ fontSize: 11, color: colors.textMid, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>}
            {authEnabled && (
              <button onClick={handleLogout}
                style={{ fontSize: 11, color: colors.textDim, background: "transparent", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", width: "100%" }}
              >
                Log out
              </button>
            )}
            <div style={{ fontSize: 10, color: colors.textDim, marginTop: 8 }}>FY 2026-27 · AY 2027-28</div>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div style={{ background: colors.card, borderBottom: `1px solid ${colors.border}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.accent }}>ComplianceAI</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {userName && <span style={{ fontSize: 11, color: colors.textDim }}>{userName}</span>}
            {authEnabled && <button onClick={handleLogout} style={{ fontSize: 11, color: colors.textDim, background: "transparent", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Log out</button>}
          </div>
        </div>
      )}

      {/* Main content — unchanged */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {activeTab === "chat" && <AgentChat reconResults={reconResults} externalMessages={agentMessages} user={user} />}
        {activeTab === "recon" && <Reconciliation reconResults={reconResults} setReconResults={setReconResults} onAgentMessage={onAgentMessage} user={user} />}
        {activeTab === "calendar" && <Calendar />}
        {activeTab === "notices" && <NoticeDecoder onAgentMessage={onAgentMessage} />}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ background: colors.card, borderTop: `1px solid ${colors.border}`, display: "flex", flexShrink: 0 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, padding: "10px 4px", background: "transparent", border: "none",
                borderTop: `2px solid ${activeTab === tab.id ? colors.accent : "transparent"}`,
                color: activeTab === tab.id ? colors.accent : colors.textDim,
                fontSize: 10, fontWeight: activeTab === tab.id ? 600 : 400, cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
