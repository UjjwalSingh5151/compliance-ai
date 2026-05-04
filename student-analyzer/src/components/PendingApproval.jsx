import { supabase, authEnabled } from "../lib/supabase";
import { c, btn } from "../lib/theme";

export default function PendingApproval({ school }) {
  return (
    <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: c.text, marginBottom: 8 }}>
          Pending Approval
        </div>
        <div style={{ fontSize: 14, color: c.textMid, lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: c.text }}>{school?.name}</strong> has been registered and is awaiting admin approval.
        </div>
        <div style={{ fontSize: 13, color: c.textDim, lineHeight: 1.6, marginBottom: 28 }}>
          You'll be able to use Kelzo as soon as your school is approved. This typically takes less than 24 hours.
        </div>
        {authEnabled && (
          <button onClick={() => supabase.auth.signOut()}
            style={{ ...btn.ghost, fontSize: 13, color: c.textDim }}>
            Log out
          </button>
        )}
      </div>
    </div>
  );
}
