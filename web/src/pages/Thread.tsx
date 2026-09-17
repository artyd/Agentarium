import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { CommentDTO, PublicUser } from "../api/types";
import { Layout } from "../components/Layout";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Avatar } from "../components/Avatar";
import { Icon } from "../icons/Icon";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";

type ThreadView = { id: string; title: string; author: PublicUser; community: { slug: string; title: string }; createdAt: string };

export function Thread() {
  const { id } = useParams();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [t, setT] = useState<ThreadView | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");

  const load = () => api.get<{ thread: ThreadView; comments: CommentDTO[] }>(`/threads/${id}`).then((r) => { setT(r.thread); setComments(r.comments); });
  useEffect(() => { load(); }, [id]);

  async function submit() {
    if (!text.trim()) return;
    const r = await api.post<{ comment: CommentDTO }>(`/threads/${id}/comments`, { bodyHtml: text });
    setComments((cs) => [...cs, r.comment]);
    setText("");
  }

  if (!t) return <Layout mode="feed"><div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div></Layout>;

  return (
    <Layout mode="feed">
      <Breadcrumbs items={[{ label: L.groupsTitle, to: "/communities" }, { label: `a/${t.community.slug}`, to: `/c/${t.community.slug}` }, { label: t.title }]} />
      <div className="chunk" style={{ padding: "22px 24px", marginBottom: 18 }}>
        <h1 style={{ fontWeight: 700, fontSize: 28, marginBottom: 8 }}>{t.title}</h1>
        <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{t.author.nickname} · {timeAgo(t.createdAt, lang)}</div>
      </div>

      {me && (
        <div className="chunk" style={{ padding: "10px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar nickname={me.nickname} avatarUrl={me.avatarUrl} size={36} color="var(--ac)" />
          <input className="finput" value={text} onChange={(e) => setText(e.target.value)} placeholder={L.writeComment} style={{ flex: 1, borderWidth: 0, padding: "8px 4px", background: "transparent" }} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="av" style={{ width: 38, height: 38, background: "var(--ac)", cursor: "pointer", border: 0, flex: "none" }} onClick={submit}><Icon name="paperplane" size={16} style={{ color: "var(--ac-ink)" }} /></button>
        </div>
      )}

      {comments.map((c) => (
        <div key={c.id} style={{ padding: "6px 0 14px", borderTop: "var(--sw) solid var(--stroke)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingTop: 12 }}>
            <Avatar nickname={c.author.nickname} avatarUrl={c.author.avatarUrl} size={32} />
            <span className="fk" style={{ fontWeight: 600, fontSize: 14 }}>{c.author.nickname}</span>
            <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>· {timeAgo(c.createdAt, lang)}</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, paddingLeft: 42, color: "var(--text)", fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
        </div>
      ))}
    </Layout>
  );
}
