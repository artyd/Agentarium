import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth, useLang } from "../store/providers";
import type { Me } from "../store/providers";

export function Welcome() {
  const nav = useNavigate();
  const { setMe } = useAuth();
  const { lang, setLang, L } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nick, setNick] = useState("");
  const [pass, setPass] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      if (mode === "login") {
        const { user } = await api.post<{ user: Me }>("/auth/login", { nickname: nick, password: pass });
        setMe(user);
        nav("/");
      } else {
        const { user } = await api.post<{ user: Me }>("/auth/register", { nickname: nick, password: pass, bio });
        setMe(user);
        nav("/");
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) setError(lang === "ua" ? "Нікнейм зайнято" : "Nickname taken");
      else if (mode === "register") setError(lang === "ua" ? "Не вдалося зареєструватися" : "Registration failed");
      else setError(lang === "ua" ? "Невірний нікнейм або пароль" : "Invalid nickname or password");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, boxSizing: "border-box", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 20px" }}>
      <div style={{ width: "100%", maxWidth: 1000, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/logo-topbar.png" alt="Agentarium" style={{ height: 88, width: "auto", display: "block" }} />
        <div className="seg">
          <span className={`o ${lang === "ua" ? "on" : ""}`} onClick={() => setLang("ua")}>UA</span>
          <span className={`o ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 50, alignItems: "center", width: "100%", maxWidth: 1000, padding: "18px 0" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Fredoka", fontWeight: 600, fontSize: 13, color: "var(--ac)", background: "var(--acsoft)", padding: "7px 14px", borderRadius: 999, marginBottom: 22 }}>🧪 {L.heroKicker}</div>
          <h1 style={{ fontWeight: 700, fontSize: 50, lineHeight: 1.05, letterSpacing: "-0.01em", margin: "0 0 16px" }}>{L.heroTitle1} <span style={{ color: "var(--ac)" }}>{L.heroTitleEm}</span> {L.heroTitle2}</h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, maxWidth: 430, color: "var(--muted)", margin: "0 0 22px", fontWeight: 600 }}>{L.heroSub}</p>
        </div>
        <div className="chunk" style={{ padding: "24px 28px" }}>
          <div className="seg" style={{ width: "100%", marginBottom: 18 }}>
            <span className={`o ${mode === "login" ? "on" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => { setMode("login"); setError(""); }}>{L.login}</span>
            <span className={`o ${mode === "register" ? "on" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => { setMode("register"); setError(""); }}>{L.register}</span>
          </div>
          <h2 style={{ fontWeight: 700, fontSize: 24, margin: "0 0 5px" }}>{mode === "login" ? L.login : L.register}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", fontWeight: 600 }}>{L.heroSub}</p>
          <div className="field2"><label>{L.nick}</label><input className="finput" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="ada.lovelace" /></div>
          <div className="field2" style={{ marginBottom: 6 }}><label>{L.password}</label><input className="finput" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
          {mode === "register" && (
            <div className="field2" style={{ marginTop: 15 }}><label>{L.shortBio}</label><input className="finput" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={L.bioPlaceholder} /></div>
          )}
          {error && <p style={{ fontSize: 12, color: "#e0554b", margin: "12px 0 0", fontWeight: 700 }}>{error}</p>}
          <button className="btnp block" style={{ marginTop: 16, padding: 12 }} onClick={submit}>{mode === "login" ? L.login : L.register}</button>
        </div>
      </div>
    </div>
  );
}
