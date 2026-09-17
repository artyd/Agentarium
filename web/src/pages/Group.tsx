import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ThreadListItem, PublicUser, PostDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { PostCard } from "../components/PostCard";
import { useLang } from "../store/providers";
import { timeAgo, avatarColor } from "../store/utils";

type CommunityView = {
  id: string; slug: string; title: string; description: string | null;
  isPrivate: boolean; owner: PublicUser; memberCount: number; isMember: boolean;
};

export function Group() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { L, lang } = useLang();
  const [c, setC] = useState<CommunityView | null>(null);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [tab, setTab] = useState<"posts" | "threads">("posts");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const load = () =>
    api.get<{ community: CommunityView; threads: ThreadListItem[] }>(`/communities/${slug}`).then((r) => { setC(r.community); setThreads(r.threads); });
  const loadPosts = () => api.get<{ posts: PostDTO[] }>(`/posts?community=${slug}`).then((r) => setPosts(r.posts));
  useEffect(() => { load(); loadPosts(); }, [slug]);

  async function join() {
    await api.post(`/communities/${slug}/join`);
    load();
  }
  async function createThread() {
    if (!title.trim()) return;
    await api.post(`/communities/${slug}/threads`, { title });
    setTitle(""); setOpen(false); load();
  }

  if (!c) return <Layout mode="feed"><div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div></Layout>;

  const right = (
    <div className="side" style={{ padding: 16 }}>
      <div className="kick" style={{ marginBottom: 8, color: "var(--ac)" }}>{L.member}</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{c.memberCount} {L.membersN}</div>
      {!c.isMember && <button className="btnp block" style={{ marginTop: 12 }} onClick={join}>{L.joinGroup}</button>}
    </div>
  );

  return (
    <Layout mode="feed" right={right}>
      <Breadcrumbs items={[{ label: L.groupsTitle, to: "/communities" }, { label: `a/${c.slug}` }]} />
      <div className="chunk" style={{ padding: "20px 24px", margin: "14px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="sticker" style={{ width: 42, height: 42, fontFamily: "Fredoka", fontWeight: 600, fontSize: 17, border: "var(--sw) solid var(--stroke)", background: avatarColor(c.slug), color: "#fff" }}>{c.title[0]?.toUpperCase()}</div>
              <h1 style={{ fontWeight: 700, fontSize: 28 }}>{c.title}</h1>
              <span className="tag" style={{ background: "var(--acsoft)", color: "var(--ac)" }}>{c.isPrivate ? `🔒 ${L.private}` : `🌐 ${L.public}`}</span>
            </div>
            {c.description && <p style={{ fontSize: 14, color: "var(--muted)", margin: "10px 0 0", fontWeight: 600 }}>{c.description}</p>}
            <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, marginTop: 8 }}>a/{c.slug} · {c.memberCount} {L.membersN}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 22, borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 18, alignItems: "center" }}>
        <span className={`tab ${tab === "posts" ? "on" : ""}`} onClick={() => setTab("posts")}>{L.tabPosts}</span>
        <span className={`tab ${tab === "threads" ? "on" : ""}`} onClick={() => setTab("threads")}>{L.threads}</span>
        <div style={{ marginLeft: "auto" }}>
          {tab === "posts"
            ? c.isMember && <button className="btnp" style={{ padding: "8px 16px" }} onClick={() => nav(`/compose?community=${c.slug}`)}>＋ {L.newPost}</button>
            : c.isMember && <button className="btnp" style={{ padding: "8px 16px" }} onClick={() => setOpen((v) => !v)}>＋ {L.newThread}</button>}
        </div>
      </div>

      {tab === "posts" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {posts.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
        </div>
      ) : (
        <>
          {open && (
            <div className="chunk" style={{ marginBottom: 14, padding: 20 }}>
              <div className="field2"><label>{L.threadTitle}</label><input className="finput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L.threadTitle} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btnp" onClick={createThread}>{L.startThread}</button>
                <button className="btng" onClick={() => setOpen(false)}>{L.cancel}</button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {threads.map((t) => (
              <div key={t.id} className="chunk hoverrow" style={{ padding: "16px 18px", borderRadius: 20 }} onClick={() => nav(`/thread/${t.id}`)}>
                <div className="fk" style={{ fontWeight: 600, fontSize: 17, marginBottom: 5 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{t.author.nickname} · {t.commentCount} {L.comments} · {timeAgo(t.createdAt, lang)}</div>
              </div>
            ))}
            {threads.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
          </div>
        </>
      )}
    </Layout>
  );
}
