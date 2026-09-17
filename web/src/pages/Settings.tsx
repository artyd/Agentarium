import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Layout } from "../components/Layout";
import { useAuth, useLang } from "../store/providers";

export function Settings() {
  const nav = useNavigate();
  const { L, lang, setLang } = useLang();
  const { setMe } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [delPassword, setDelPassword] = useState("");

  async function changePassword() {
    setPwMsg(null);
    try {
      await api.put("/auth/me/password", { oldPassword, newPassword });
      setPwMsg({ ok: true, text: L.passwordChanged });
      setOldPassword(""); setNewPassword("");
    } catch (e) {
      const err = e as Error & { status?: number };
      setPwMsg({ ok: false, text: err.status === 403 ? L.wrongPassword : L.empty });
    }
  }
  async function deleteAccount() {
    if (!window.confirm(L.confirmDeleteAccount)) return;
    // DELETE with a body via fetch (the api helper's del() sends no body).
    const res = await fetch("/api/auth/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: delPassword }),
    });
    if (res.ok) {
      setMe(null);
      nav("/");
    } else {
      setPwMsg({ ok: false, text: L.wrongPassword });
    }
  }

  return (
    <Layout mode="page">
      <h1 style={{ fontWeight: 700, fontSize: 30, marginBottom: 18 }}>{L.settings}</h1>

      <div className="chunk" style={{ padding: "22px 24px", marginBottom: 18, maxWidth: 480 }}>
        <div className="kick" style={{ marginBottom: 14 }}>{L.language}</div>
        <div className="seg">
          <span className={`o ${lang === "ua" ? "on" : ""}`} onClick={() => setLang("ua")}>UA</span>
          <span className={`o ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</span>
        </div>
      </div>

      <div className="chunk" style={{ padding: "22px 24px", marginBottom: 18, maxWidth: 480 }}>
        <div className="kick" style={{ marginBottom: 14 }}>{L.changePassword}</div>
        <div className="field2"><label>{L.oldPassword}</label><input className="finput" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} /></div>
        <div className="field2"><label>{L.newPassword}</label><input className="finput" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        {pwMsg && <p style={{ fontSize: 12, color: pwMsg.ok ? "#1a9c5b" : "#e0554b", fontWeight: 700 }}>{pwMsg.text}</p>}
        <button className="btnp" style={{ padding: "9px 18px" }} onClick={changePassword} disabled={!oldPassword || newPassword.length < 6}>{L.save}</button>
      </div>

      <div className="chunk" style={{ padding: "22px 24px", maxWidth: 480, borderColor: "#e0554b" }}>
        <div className="kick" style={{ marginBottom: 14, color: "#e0554b" }}>{L.deleteAccount}</div>
        <div className="field2"><label>{L.password}</label><input className="finput" type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} /></div>
        <button className="btng" style={{ padding: "9px 18px", color: "#e0554b" }} onClick={deleteAccount} disabled={!delPassword}>{L.deleteAccount}</button>
      </div>
    </Layout>
  );
}
