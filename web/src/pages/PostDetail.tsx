import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { PostDTO, CommentDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Avatar } from "../components/Avatar";
import { RichEditor } from "../components/RichEditor";
import { CommentRow } from "../components/CommentRow";
import { Icon } from "../icons/Icon";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { typeLabel, TYPE_ICON } from "../i18n/strings";

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [post, setPost] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [commentKey, setCommentKey] = useState(0);
  const [score, setScore] = useState(0);
  const [myVote, setMyVote] = useState(0);
  const [fire, setFire] = useState(0);
  const [myFire, setMyFire] = useState(false);
  // reply
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  // post edit
  const [pEdit, setPEdit] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eBody, setEBody] = useState("");
  const [eCode, setECode] = useState("");
  const [eLink, setELink] = useState("");

  useEffect(() => {
    api.get<{ post: PostDTO; comments: CommentDTO[] }>(`/posts/${id}`).then((r) => {
      setPost(r.post);
      setComments(r.comments);
      setScore(r.post.score); setMyVote(r.post.myVote); setFire(r.post.fire); setMyFire(r.post.myFire);
      if (sp.get("edit") && r.post.author.id === me?.id) initEdit(r.post);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function reloadComments() {
    api.get<{ post: PostDTO; comments: CommentDTO[] }>(`/posts/${id}`).then((r) => setComments(r.comments));
  }
  function initEdit(p: PostDTO) {
    setETitle(p.title); setEBody(p.bodyHtml); setECode(p.codeSnippet ?? ""); setELink(p.link?.url ?? "");
    setPEdit(true);
  }

  if (!post) return <Layout mode="feed"><div style={{ padding: 40, textAlign: "center" }}><span className="spin" /></div></Layout>;

  const typeClass = `t-${post.type}`;
  const isAuthor = me?.id === post.author.id;

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
    if (!stripTags(text)) return;
    await api.post(`/posts/${id}/comments`, { bodyHtml: text });
    setText(""); setCommentKey((k) => k + 1); reloadComments();
  }
  async function submitReply(parentId: string) {
    if (!stripTags(replyText)) return;
    await api.post(`/posts/${id}/comments`, { bodyHtml: replyText, parentCommentId: parentId });
    setReplyText(""); setReplyingId(null); reloadComments();
  }
  async function savePost() {
    if (!stripTags(eTitle)) return;
    const { post: up } = await api.put<{ post: PostDTO }>(`/posts/${id}`, {
      title: eTitle, bodyHtml: eBody, codeSnippet: eCode.trim() || null, linkUrl: eLink.trim() || null,
    });
    setPost(up); setPEdit(false);
  }
  async function delPost() {
    if (!window.confirm(L.confirmDelete)) return;
    await api.del(`/posts/${id}`);
    nav("/");
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
          {isAuthor && !pEdit && (
            <div style={{ display: "flex", gap: 6, flex: "none" }}>
              <button className="btng" style={{ padding: "7px 10px" }} title={L.edit} onClick={() => initEdit(post)}><Icon name="pen" size={13} /></button>
              <button className="btng" style={{ padding: "7px 10px", color: "#e0554b" }} title={L.remove} onClick={delPost}><Icon name="x" size={13} /></button>
            </div>
          )}
        </div>

        {pEdit ? (
          <div>
            <div className="field2"><label>{L.title}</label><RichEditor value={eTitle} onChange={setETitle} singleLine placeholder={L.title} /></div>
            <div className="field2"><label>{L.body}</label><RichEditor value={eBody} onChange={setEBody} minHeight={120} placeholder={L.body} /></div>
            <div className="field2"><label>{L.codeOptional}</label><textarea className="finput" value={eCode} onChange={(e) => setECode(e.target.value)} style={{ fontFamily: "ui-monospace, monospace" }} /></div>
            <div className="field2"><label>{L.linkOptional}</label><input className="finput" value={eLink} onChange={(e) => setELink(e.target.value)} placeholder="https://…" /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btnp" style={{ padding: "9px 18px" }} onClick={savePost}>{L.save}</button>
              <button className="btng" onClick={() => setPEdit(false)}>{L.cancel}</button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontWeight: 700, fontSize: 32, lineHeight: 1.15, margin: "0 0 16px" }} dangerouslySetInnerHTML={{ __html: post.title }} />
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
          </>
        )}
      </article>

      <div style={{ marginTop: 22 }}>
        <h3 className="fk" style={{ fontWeight: 600, fontSize: 18, margin: "0 0 14px" }}>{L.comments} · {comments.length}</h3>
        {me && (
          <div className="chunk" style={{ padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Avatar nickname={me.nickname} avatarUrl={me.avatarUrl} size={36} color="var(--ac)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <RichEditor key={commentKey} value={text} onChange={setText} placeholder={L.writeComment} dense minHeight={60} onSubmit={submitComment} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btnp" style={{ padding: "8px 18px" }} onClick={submitComment}><Icon name="paperplane" size={14} /> {L.send}</button>
              </div>
            </div>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} style={{ padding: "6px 0 14px", borderTop: "var(--sw) solid var(--stroke)" }}>
            <CommentRow c={c} onChanged={reloadComments} onReply={() => { setReplyingId(replyingId === c.id ? null : c.id); setReplyText(""); }} />
            {c.replies.map((rp) => (
              <div key={rp.id} style={{ margin: "10px 0 0 42px", padding: "10px 0 0 16px", borderLeft: "var(--sw) solid var(--ac)" }}>
                <CommentRow c={rp} onChanged={reloadComments} indent />
              </div>
            ))}
            {replyingId === c.id && (
              <div style={{ margin: "12px 0 0 42px" }}>
                <RichEditor value={replyText} onChange={setReplyText} placeholder={`${L.reply}…`} dense minHeight={56} onSubmit={() => submitReply(c.id)} />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btnp" style={{ padding: "8px 16px" }} onClick={() => submitReply(c.id)}>{L.send}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
