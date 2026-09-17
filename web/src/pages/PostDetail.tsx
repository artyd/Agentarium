import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO, CommentDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Avatar } from "../components/Avatar";
import { Icon } from "../icons/Icon";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { typeLabel, TYPE_ICON } from "../i18n/strings";

function CommentItem({ c, postId, onReplied }: { c: CommentDTO; postId: string; onReplied: (parentId: string, reply: CommentDTO) => void }) {
  const { L } = useLang();
  const { me } = useAuth();
  const [score, setScore] = useState(c.score);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  async function upvote() {
    const r = await api.post<{ score: number }>(`/comments/${c.id}/vote`);
    setScore(r.score);
  }
  async function submitReply() {
    if (!text.trim()) return;
    // reply belongs to the same post; find postId via parent chain is not needed — server infers from post route
    const r = await api.post<{ comment: CommentDTO }>(`/posts/${postId}/comments`, { bodyHtml: text, parentCommentId: c.id });
    onReplied(c.id, r.comment);
    setText("");
    setReplying(false);
  }

  return (
    <div style={{ padding: "6px 0 14px", borderTop: "var(--sw) solid var(--stroke)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingTop: 12 }}>
        <Avatar nickname={c.author.nickname} avatarUrl={c.author.avatarUrl} size={32} />
        <span className="fk" style={{ fontWeight: 600, fontSize: 14 }}>{c.author.nickname}</span>
        <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>· {score} ▲</span>
        {c.replies.length > 0 && (
          <span className="link" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? `+${c.replies.length}` : "—"}
          </span>
        )}
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 6px", paddingLeft: 42, color: "var(--text)", fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
      <div style={{ paddingLeft: 42, display: "flex", gap: 14 }}>
        <span className="link" style={{ fontSize: 12 }} onClick={upvote}>▲ {L.up}</span>
        {me && <span className="link" style={{ fontSize: 12 }} onClick={() => setReplying((v) => !v)}>{L.reply}</span>}
      </div>
      {!collapsed && c.replies.map((rp) => (
        <div key={rp.id} style={{ margin: "10px 0 0 42px", padding: "10px 0 0 16px", borderLeft: "var(--sw) solid var(--ac)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Avatar nickname={rp.author.nickname} avatarUrl={rp.author.avatarUrl} size={26} color="var(--pink)" />
            <span className="fk" style={{ fontWeight: 600, fontSize: 13 }}>{rp.author.nickname}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, paddingLeft: 34, color: "var(--text)", fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: rp.bodyHtml }} />
        </div>
      ))}
      {replying && (
        <div style={{ margin: "12px 0 0 42px", display: "flex", gap: 8 }}>
          <input className="finput" value={text} onChange={(e) => setText(e.target.value)} placeholder={`${L.reply}…`} onKeyDown={(e) => e.key === "Enter" && submitReply()} />
          <button className="btnp" style={{ padding: "8px 16px" }} onClick={submitReply}>{L.send}</button>
        </div>
      )}
    </div>
  );
}

export function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [post, setPost] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [score, setScore] = useState(0);
  const [myVote, setMyVote] = useState(0);
  const [fire, setFire] = useState(0);
  const [myFire, setMyFire] = useState(false);

  useEffect(() => {
    api.get<{ post: PostDTO; comments: CommentDTO[] }>(`/posts/${id}`).then((r) => {
      setPost(r.post);
      setComments(r.comments);
      setScore(r.post.score); setMyVote(r.post.myVote); setFire(r.post.fire); setMyFire(r.post.myFire);
    });
  }, [id]);

  if (!post) return <Layout mode="feed"><div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div></Layout>;

  const typeClass = `t-${post.type}`;
  async function vote(dir: 1 | -1) {
    const value = myVote === dir ? 0 : dir;
    setMyVote(value);
    const r = await api.post<{ score: number }>(`/posts/${id}/vote`, { value });
    setScore(r.score);
  }
  async function toggleFire() {
    const r = await api.post<{ fire: number; myFire: boolean }>(`/posts/${id}/react`);
    setFire(r.fire); setMyFire(r.myFire);
  }
  async function submitComment() {
    if (!text.trim()) return;
    const r = await api.post<{ comment: CommentDTO }>(`/posts/${id}/comments`, { bodyHtml: text });
    setComments((cs) => [...cs, r.comment]);
    setText("");
  }
  function onReplied(parentId: string, reply: CommentDTO) {
    setComments((cs) => cs.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c)));
  }

  const right = (
    <div className="side" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar nickname={post.author.nickname} avatarUrl={post.author.avatarUrl} size={44} onClick={() => nav(`/profile/${post.author.nickname}`)} />
        <div>
          <div className="fk link" style={{ fontWeight: 600 }} onClick={() => nav(`/profile/${post.author.nickname}`)}>{post.author.nickname}</div>
          {post.author.bio && <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{post.author.bio}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <Layout mode="feed" right={right}>
      <Breadcrumbs items={[{ label: L.feed, to: "/" }, ...(post.community ? [{ label: `a/${post.community.slug}`, to: `/c/${post.community.slug}` }] : [])]} />
      <article className="chunk" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div className={`sticker ${typeClass}`} style={{ width: 46, height: 46, border: "var(--sw) solid var(--stroke)" }}><Icon name={TYPE_ICON[post.type]} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="fk link" style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }} onClick={() => nav(`/profile/${post.author.nickname}`)}>{post.author.nickname}</span>
              <span className={`tag ${typeClass}`}>{typeLabel(post.type, L)}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)" }}>{post.community && <>a/{post.community.slug} · </>}{timeAgo(post.createdAt, lang)}</div>
          </div>
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 32, lineHeight: 1.15, margin: "0 0 16px" }}>{post.title}</h1>
        {post.bodyHtml && <div style={{ fontSize: 15.5, lineHeight: 1.75, color: "var(--text)", marginBottom: 16, fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />}
        {post.codeSnippet && <pre className="codeblk" style={{ margin: "0 0 16px" }}>{post.codeSnippet}</pre>}
        {post.link && (
          <div className="hoverrow" style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 15px", margin: "0 0 16px", border: "var(--sw) solid var(--stroke)" }} onClick={() => window.open(post.link!.url, "_blank")}>
            <div className="sticker" style={{ width: 42, height: 42, background: "var(--acsoft)", color: "var(--ac)" }}><Icon name="link" /></div>
            <div style={{ minWidth: 0 }}><div className="fk" style={{ fontWeight: 600, fontSize: 14 }}>{post.link.title}</div><div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{post.link.url}</div></div>
          </div>
        )}
        {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: "100%", margin: "0 0 16px", borderRadius: 14, border: "var(--sw) solid var(--stroke)", display: "block" }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className={`vote ${myVote === 1 ? "up" : myVote === -1 ? "dn" : ""}`}>
            <button className={`arrow up ${myVote === 1 ? "on" : ""}`} onClick={() => vote(1)}><Icon name="up" size={13} /></button>
            <span className="fk" style={{ fontWeight: 600, fontSize: 14, minWidth: 22, textAlign: "center" }}>{score}</span>
            <button className={`arrow dn ${myVote === -1 ? "on" : ""}`} onClick={() => vote(-1)}><Icon name="down" size={13} /></button>
          </div>
          <span className="act"><Icon name="comment" size={14} /> {comments.length}</span>
          <span className={`act ${myFire ? "on" : ""}`} onClick={toggleFire}>🔥 {fire}</span>
        </div>
      </article>

      <div style={{ marginTop: 22 }}>
        <h3 className="fk" style={{ fontWeight: 600, fontSize: 18, margin: "0 0 14px" }}>{L.comments} · {comments.length}</h3>
        {me && (
          <div className="chunk" style={{ padding: "10px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
            <Avatar nickname={me.nickname} avatarUrl={me.avatarUrl} size={36} color="var(--ac)" />
            <input className="finput" value={text} onChange={(e) => setText(e.target.value)} placeholder={L.writeComment} style={{ flex: 1, borderWidth: 0, padding: "8px 4px", background: "transparent" }} onKeyDown={(e) => e.key === "Enter" && submitComment()} />
            <button className="av" style={{ width: 38, height: 38, background: "var(--ac)", cursor: "pointer", border: 0, flex: "none" }} onClick={submitComment}><Icon name="paperplane" size={16} style={{ color: "var(--ac-ink)" }} /></button>
          </div>
        )}
        {comments.map((c) => <CommentItem key={c.id} c={c} postId={id!} onReplied={onReplied} />)}
      </div>
    </Layout>
  );
}
