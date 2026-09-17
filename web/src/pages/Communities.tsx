import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CommunityListItem } from "../api/types";
import { Layout } from "../components/Layout";
import { useLang } from "../store/providers";
import { avatarColor } from "../store/utils";

export function Communities() {
  const nav = useNavigate();
  const { L } = useLang();
  const [list, setList] = useState<CommunityListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const load = () => api.get<{ communities: CommunityListItem[] }>("/communities").then((r) => setList(r.communities));
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) return;
    const { community } = await api.post<{ community: { slug: string } }>("/communities", { title, description: desc, isPrivate });
    nav(`/c/${community.slug}`);
  }

  const right = (
    <div className="side" style={{ padding: 16 }}>
      <div className="kick" style={{ marginBottom: 8, color: "var(--ac)" }}>{L.groupsTitle}</div>
      <p style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, margin: 0 }}>{L.groupsSub}</p>
    </div>
  );

  return (
    <Layout mode="feed" right={right}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 34 }}>{L.groupsTitle}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0", fontWeight: 600 }}>{L.groupsSub}</p>
        </div>
        <button className="btnp" onClick={() => setOpen((v) => !v)}>＋ {L.newGroup}</button>
      </div>

      {open && (
        <div className="chunk" style={{ marginBottom: 20, padding: 22 }}>
          <div className="field2"><label>{L.newGroup}</label><input className="finput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.newGroup} /></div>
          <div className="field2"><label>{L.postBody}</label><input className="finput" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="…" /></div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <span className={`chip ${!isPrivate ? "on" : ""}`} onClick={() => setIsPrivate(false)}>🌐 {L.public}</span>
            <span className={`chip ${isPrivate ? "on" : ""}`} onClick={() => setIsPrivate(true)}>🔒 {L.private}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btnp" onClick={create}>{L.newGroup}</button>
            <button className="btng" onClick={() => setOpen(false)}>{L.cancel}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {list.map((g) => (
          <div key={g.id} className="chunk hoverrow" style={{ padding: "18px 20px", borderRadius: 20 }} onClick={() => nav(`/c/${g.slug}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div className="sticker" style={{ width: 40, height: 40, fontFamily: "Fredoka", fontWeight: 600, fontSize: 16, border: "var(--sw) solid var(--stroke)", background: avatarColor(g.slug), color: "#fff" }}>{g.title[0]?.toUpperCase()}</div>
              <span className="tag" style={{ marginLeft: "auto", background: "var(--acsoft)", color: "var(--ac)" }}>{g.isPrivate ? `🔒 ${L.private}` : `🌐 ${L.public}`}</span>
            </div>
            <div className="fk" style={{ fontWeight: 600, fontSize: 19, marginBottom: 4 }}>{g.title}</div>
            <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, marginBottom: 8 }}>a/{g.slug}</div>
            {g.description && <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", margin: "0 0 10px", fontWeight: 600 }}>{g.description}</p>}
            <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{g.memberCount} {L.membersN} · {g.threadCount} {L.threads}</div>
          </div>
        ))}
        {list.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
      </div>
    </Layout>
  );
}
