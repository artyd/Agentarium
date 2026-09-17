import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useLang, useTheme } from "../store/providers";
import { Icon } from "../icons/Icon";
import { Avatar } from "./Avatar";

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const { lang, setLang, L } = useLang();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

  const submitSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 16, padding: "12px 22px", background: "var(--barbg)", backdropFilter: "blur(8px)" }}>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", alignItems: "center", minWidth: 0 }}>
          <img src="/logo-topbar.png" alt="Agentarium" onClick={() => nav("/")} style={{ height: 72, width: "auto", display: "block", cursor: "pointer" }} />
        </div>
        <div style={{ flex: "0 1 440px", maxWidth: 440, position: "relative" }}>
          <span className="ic" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }}><Icon name="search" size={16} /></span>
          <input className="tinput" style={{ paddingLeft: 38 }} placeholder={L.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={submitSearch} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
          <div className="seg">
            <span className={`o ${lang === "ua" ? "on" : ""}`} onClick={() => setLang("ua")}>UA</span>
            <span className={`o ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</span>
          </div>
          <div style={{ position: "relative" }}>
            <Avatar as="button" nickname={me?.nickname ?? "?"} avatarUrl={me?.avatarUrl} size={42} color="var(--pink)" onClick={() => setMenu((m) => !m)} />
            {menu && (
              <div className="chunk" style={{ position: "absolute", right: 0, top: 50, width: 230, padding: 8, zIndex: 50 }}>
                <div style={{ padding: "8px 12px 10px", borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 4 }}>
                  <div className="fk" style={{ fontWeight: 600, fontSize: 15 }}>{me?.nickname}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>@{me?.nickname}</div>
                </div>
                <div className="com" onClick={() => { setMenu(false); nav(`/profile/${me?.nickname}`); }}><Icon name="user" /> {L.myProfile}</div>
                <div className="com" onClick={() => { toggle(); }}><Icon name={theme === "light" ? "moon" : "sun"} /> {theme === "light" ? "Dark" : "Light"}</div>
                <div className="com" onClick={async () => { setMenu(false); await logout(); nav("/"); }}><Icon name="logout" /> {L.logout}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
