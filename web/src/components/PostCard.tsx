import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO } from "../api/types";
import { ShareModal } from "./ShareModal";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { typeLabel, TYPE_ICON } from "../i18n/strings";
import { Icon } from "../icons/Icon";

export function PostCard({ post, canModerate }: { post: PostDTO; canModerate?: boolean }) {
  const nav = useNavigate();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [score, setScore] = useState(post.score);
  const [myVote, setMyVote] = useState(post.myVote);
  const [reactions, setReactions] = useState(post.reactions);
  const [picker, setPicker] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.bookmarked);
  const [pinned, setPinned] = useState(post.pinned);
  const [menu, setMenu] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [share, setShare] = useState(false);
  const typeClass = `t-${post.type}`;
  const isAuthor = me?.id === post.author.id;
  const EMOJIS = ["🔥", "👍", "❤️", "😂", "🎉", "🚀", "👀"];

  async function del() {
    setMenu(false);
    if (!window.confirm(L.confirmDelete)) return;
    await api.del(`/posts/${post.id}`);
    setDeleted(true);
  }
  async function react(emoji: string) {
    if (!me) return nav("/");
    setPicker(false);
    const r = await api.post<{ reactions: { emoji: string; count: number; mine: boolean }[] }>(`/posts/${post.id}/react`, { emoji });
    setReactions(r.reactions);
  }
  async function report() {
    setMenu(false);
    const reason = window.prompt(L.reportReason);
    if (reason) { await api.post("/reports", { postId: post.id, reason }); window.alert(L.reportSent); }
  }
  async function block() {
    setMenu(false);
    if (!window.confirm(`${L.block} @${post.author.nickname}?`)) return;
    await api.post(`/users/${post.author.nickname}/block`);
    setDeleted(true);
  }
  async function toggleBookmark() {
    if (!me) return nav("/");
    const r = await api.post<{ bookmarked: boolean }>(`/posts/${post.id}/bookmark`);
    setBookmarked(r.bookmarked);
  }
  async function togglePin() {
    setMenu(false);
    const r = await api.post<{ pinned: boolean }>(`/posts/${post.id}/pin`);
    setPinned(r.pinned);
  }

  async function vote(dir: 1 | -1) {
    if (!me) return nav("/");
    const value = myVote === dir ? 0 : dir;
    setMyVote(value);
    const r = await api.post<{ score: number; myVote: number }>(`/posts/${post.id}/vote`, { value });
    setScore(r.score);
  }
  const voteState = myVote === 1 ? "up" : myVote === -1 ? "dn" : "";
  if (deleted) return null;

  // Feed shows a ~100-char plain-text excerpt; full formatted body is on the post page.
  const plain = post.bodyHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const LIMIT = 100;
  let excerpt = plain;
  let truncated = false;
  if (plain.length > LIMIT) {
    let cut = plain.slice(0, LIMIT);
    const sp = cut.lastIndexOf(" ");
    if (sp > LIMIT * 0.6) cut = cut.slice(0, sp);
    excerpt = cut + "…";
    truncated = true;
  }

  // Feed shows only the first few lines / ~400 chars of code; full code is on the post page.
  const CODE_LINES = 6;
  const CODE_CHARS = 400;
  let codePreview = post.codeSnippet ?? "";
  let codeTruncated = false;
  if (codePreview) {
    const lines = codePreview.split("\n");
    if (lines.length > CODE_LINES) {
      codePreview = lines.slice(0, CODE_LINES).join("\n") + "\n…";
      codeTruncated = true;
    } else if (codePreview.length > CODE_CHARS) {
      codePreview = codePreview.slice(0, CODE_CHARS) + "\n…";
      codeTruncated = true;
    }
  }

  return (
    <article className="chunk" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div className={`sticker ${typeClass}`} style={{ width: 44, height: 44, border: "var(--sw) solid var(--stroke)" }}>
          <Icon name={TYPE_ICON[post.type]} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="fk link" style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }} onClick={() => nav(`/profile/${post.author.nickname}`)}>
              {post.author.nickname}
            </span>
            <span className={`tag ${typeClass}`}>{typeLabel(post.type, L)}</span>
            {pinned && <span className="tag" style={{ background: "var(--acsoft)", color: "var(--ac)" }}>📌 {L.pinnedLabel}</span>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)" }}>
            {post.community && (
              <>
                <span className="link" style={{ color: "var(--faint)" }} onClick={() => nav(`/c/${post.community!.slug}`)}>
                  a/{post.community.slug}
                </span>{" "}
                ·{" "}
              </>
            )}
            {timeAgo(post.createdAt, lang)}{post.edited ? ` · ${L.editedMark}` : ""}
          </div>
        </div>
        {me && (
          <div style={{ position: "relative", flex: "none" }}>
            <button className="btng" style={{ padding: "2px 10px", boxShadow: "none", fontSize: 18, lineHeight: 1 }} title="•••" onClick={() => setMenu((v) => !v)}>⋯</button>
            {menu && (
              <div className="chunk" style={{ position: "absolute", right: 0, top: 38, width: 190, padding: 6, zIndex: 30 }}>
                {isAuthor && <div className="com" onClick={() => { setMenu(false); nav(`/post/${post.id}?edit=1`); }}><Icon name="pen" size={13} /> {L.edit}</div>}
                {canModerate && <div className="com" onClick={togglePin}>📌 {pinned ? L.unpinLabel : L.pinLabel}</div>}
                {(isAuthor || canModerate) && <div className="com" style={{ color: "#e0554b" }} onClick={del}><Icon name="x" size={13} /> {L.remove}</div>}
                {!isAuthor && <div className="com" onClick={report}>⚠️ {L.report}</div>}
                {!isAuthor && <div className="com" style={{ color: "#e0554b" }} onClick={block}>🚫 {L.block}</div>}
              </div>
            )}
          </div>
        )}
      </div>
      <h3 className="link" style={{ fontWeight: 600, fontSize: 21, lineHeight: 1.24, margin: "0 0 8px", color: "var(--text)" }} onClick={() => nav(`/post/${post.id}`)} dangerouslySetInnerHTML={{ __html: post.title }} />
      {excerpt && (
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "0 0 14px", fontWeight: 600 }}>
          {excerpt}
          {truncated && <> <span className="link" onClick={() => nav(`/post/${post.id}`)}>{L.readMore}</span></>}
        </p>
      )}
      {post.codeSnippet && (
        <pre className="codeblk" style={{ margin: "0 0 14px" }}>
          {codePreview}
          {codeTruncated && (
            <>{"\n"}<span className="link" style={{ color: "#b3a6ff" }} onClick={() => nav(`/post/${post.id}`)}>{L.readMore}</span></>
          )}
        </pre>
      )}
      {post.link && (
        <div className="hoverrow" style={{ margin: "0 0 14px", border: "var(--sw) solid var(--stroke)", overflow: "hidden" }} onClick={() => window.open(post.link!.url, "_blank")}>
          {post.link.image && <img src={post.link.image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block", borderBottom: "var(--sw) solid var(--stroke)" }} />}
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 13px" }}>
            <div className="sticker" style={{ width: 38, height: 38, background: "var(--acsoft)", color: "var(--ac)", flex: "none" }}><Icon name="link" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="fk" style={{ fontWeight: 600, fontSize: 13 }}>{post.link.title}</div>
              {post.link.desc && <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{post.link.desc}</div>}
              <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.link.url}</div>
            </div>
          </div>
        </div>
      )}
      {post.imageUrls.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: post.imageUrls.length === 1 ? "1fr" : "1fr 1fr", gap: 8, margin: "0 0 14px" }}>
          {post.imageUrls.slice(0, 4).map((u, i) => (
            <img key={i} src={u} alt="" style={{ width: "100%", maxHeight: post.imageUrls.length === 1 ? 420 : 200, objectFit: "cover", borderRadius: 14, border: "var(--sw) solid var(--stroke)", display: "block" }} />
          ))}
        </div>
      )}
      {post.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 12px" }}>
          {post.tags.map((t) => (
            <span key={t} className="chip" style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => nav(`/?tag=${encodeURIComponent(t)}`)}>#{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className={`vote ${voteState}`}>
          <button className={`arrow up ${myVote === 1 ? "on" : ""}`} onClick={() => vote(1)}><Icon name="up" size={13} /></button>
          <span className="fk" style={{ fontWeight: 600, fontSize: 14, minWidth: 22, textAlign: "center" }}>{score}</span>
          <button className={`arrow dn ${myVote === -1 ? "on" : ""}`} onClick={() => vote(-1)}><Icon name="down" size={13} /></button>
        </div>
        <span className="act" onClick={() => nav(`/post/${post.id}`)}><Icon name="comment" size={14} /> {post.commentCount}</span>
        {reactions.map((r) => (
          <span key={r.emoji} className={`act ${r.mine ? "on" : ""}`} onClick={() => react(r.emoji)}>{r.emoji} {r.count}</span>
        ))}
        <div style={{ position: "relative" }}>
          <span className="act" onClick={() => setPicker((v) => !v)}>🙂+</span>
          {picker && (
            <div className="chunk" style={{ position: "absolute", bottom: 40, left: 0, padding: 6, display: "flex", gap: 2, zIndex: 30 }}>
              {EMOJIS.map((e) => <span key={e} onClick={() => react(e)} style={{ cursor: "pointer", fontSize: 20, padding: "2px 5px" }}>{e}</span>)}
            </div>
          )}
        </div>
        <span className={`act ${bookmarked ? "on" : ""}`} style={{ marginLeft: "auto" }} onClick={toggleBookmark} title={L.saved}>🔖</span>
        <span className="act" onClick={() => setShare(true)}>
          <Icon name="share" size={13} /> {L.share}
        </span>
      </div>
      {share && <ShareModal post={post} onClose={() => setShare(false)} />}
    </article>
  );
}
