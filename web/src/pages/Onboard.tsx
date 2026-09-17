import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLang } from "../store/providers";

export function Onboard() {
  const nav = useNavigate();
  const { L } = useLang();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [motivation, setMotivation] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      await api.post("/join-requests", { name, bio, motivation, githubUrl });
      setSent(true);
    } catch {
      setError(L.empty);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src="/logo-topbar.png" alt="Agentarium" style={{ height: 88, width: "auto", display: "inline-block" }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", marginTop: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>{L.joinRequest}</div>
        </div>
        <div className="chunk" style={{ padding: "30px 28px" }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              <div className="sticker" style={{ width: 60, height: 60, margin: "0 auto", background: "var(--acsoft)" }}><span style={{ fontSize: 28 }}>🎉</span></div>
              <p style={{ fontSize: 15, margin: "14px 0 0", fontWeight: 700 }}>{L.onboardDone}</p>
              <button className="btng" style={{ marginTop: 20 }} onClick={() => nav("/")}>{L.backToLogin}</button>
            </div>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 27, margin: "0 0 6px" }}>{L.onboardTitle}</h2>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 22px", fontWeight: 600 }}>{L.onboardSub}</p>
              <div className="field2"><label>{L.name}</label><input className="finput" value={name} onChange={(e) => setName(e.target.value)} placeholder={L.namePlaceholder} /></div>
              <div className="field2"><label>{L.shortBio}</label><input className="finput" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={L.bioPlaceholder} /></div>
              <div className="field2"><label>{L.motivation}</label><textarea className="finput" value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder={L.motivationPlaceholder} /></div>
              <div className="field2" style={{ marginBottom: 4 }}><label>GitHub <span style={{ opacity: 0.5 }}>— {L.optional}</span></label><input className="finput" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="github.com/…" /></div>
              {error && <p style={{ fontSize: 12, color: "#e0554b", margin: "8px 0 0", fontWeight: 700 }}>{error}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btnp" style={{ flex: 1, padding: 12 }} onClick={submit}>{L.sendRequest}</button>
                <button className="btng" onClick={() => nav("/")}>{L.cancel}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
