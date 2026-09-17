import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO } from "../api/types";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { typeLabel, TYPE_ICON } from "../i18n/strings";
import { Icon } from "../icons/Icon";

export function PostCard({ post }: { post: PostDTO }) {
  const nav = useNavigate();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [score, setScore] = useState(post.score);
  const [myVote, setMyVote] = useState(post.myVote);
  const [fire, setFire] = useState(post.fire);
  const [myFire, setMyFire] = useState(post.myFire);
  const typeClass = `t-${post.type}`;

  async function vote(dir: 1 | -1) {
    if (!me) return nav("/");
    const value = myVote === dir ? 0 : dir;
    setMyVote(value);
    const r = await api.post<{ score: number; myVote: number }>(`/posts/${post.id}/vote`, { value });
    setScore(r.score);
  }
  async function toggleFire() {
    if (!me) return nav("/");
    const r = await api.post<{ fire: number; myFire: boolean }>(`/posts/${post.id}/react`);
    setFire(r.fire);
    setMyFire(r.myFire);
  }

  const voteState = myVote === 1 ? "up" : myVote === -1 ? "dn" : "";

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
            {timeAgo(post.createdAt, lang)}
          </div>
        </div>
      </div>
      <h3 className="link" style={{ fontWeight: 600, fontSize: 21, lineHeight: 1.24, margin: "0 0 8px", color: "var(--text)" }} onClick={() => nav(`/post/${post.id}`)}>
        {post.title}
      </h3>
      {post.bodyHtml && (
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "0 0 14px", fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
      )}
      {post.codeSnippet && <pre className="codeblk" style={{ margin: "0 0 14px" }}>{post.codeSnippet}</pre>}
      {post.link && (
        <div className="hoverrow" style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 13px", margin: "0 0 14px", border: "var(--sw) solid var(--stroke)" }} onClick={() => window.open(post.link!.url, "_blank")}>
          <div className="sticker" style={{ width: 38, height: 38, background: "var(--acsoft)", color: "var(--ac)" }}>
            <Icon name="link" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="fk" style={{ fontWeight: 600, fontSize: 13 }}>{post.link.title}</div>
            <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.link.url}</div>
          </div>
        </div>
      )}
      {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: "100%", margin: "0 0 14px", borderRadius: 14, border: "var(--sw) solid var(--stroke)", display: "block" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className={`vote ${voteState}`}>
          <button className={`arrow up ${myVote === 1 ? "on" : ""}`} onClick={() => vote(1)}><Icon name="up" size={13} /></button>
          <span className="fk" style={{ fontWeight: 600, fontSize: 14, minWidth: 22, textAlign: "center" }}>{score}</span>
          <button className={`arrow dn ${myVote === -1 ? "on" : ""}`} onClick={() => vote(-1)}><Icon name="down" size={13} /></button>
        </div>
        <span className="act" onClick={() => nav(`/post/${post.id}`)}><Icon name="comment" size={14} /> {post.commentCount}</span>
        <span className={`act ${myFire ? "on" : ""}`} onClick={toggleFire}>🔥 {fire}</span>
        <span className="act" style={{ marginLeft: "auto" }} onClick={() => navigator.clipboard?.writeText(`${location.origin}/post/${post.id}`)}>
          <Icon name="share" size={13} /> {L.share}
        </span>
      </div>
    </article>
  );
}
