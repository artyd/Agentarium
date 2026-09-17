import { useState } from "react";
import { api } from "../api/client";
import type { CommentDTO } from "../api/types";
import { useAuth, useLang } from "../store/providers";
import { Avatar } from "./Avatar";
import { RichEditor } from "./RichEditor";

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export function CommentRow({
  c,
  onChanged,
  onReply,
  indent,
}: {
  c: CommentDTO;
  onChanged: () => void;
  onReply?: () => void;
  indent?: boolean;
}) {
  const { L } = useLang();
  const { me } = useAuth();
  const [score, setScore] = useState(c.score);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.bodyHtml);
  const isAuthor = me?.id === c.author.id;
  const pad = indent ? 34 : 42;

  async function upvote() {
    const r = await api.post<{ score: number }>(`/comments/${c.id}/vote`);
    setScore(r.score);
  }
  async function saveEdit() {
    if (!stripTags(editText)) return;
    await api.put(`/comments/${c.id}`, { bodyHtml: editText });
    setEditing(false);
    onChanged();
  }
  async function del() {
    if (!window.confirm(L.confirmDelete)) return;
    await api.del(`/comments/${c.id}`);
    onChanged();
  }

  return (
    <div style={{ paddingTop: indent ? 0 : 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Avatar nickname={c.author.nickname} avatarUrl={c.author.avatarUrl} size={indent ? 26 : 32} color={indent ? "var(--pink)" : undefined} />
        <span className="fk" style={{ fontWeight: 600, fontSize: indent ? 13 : 14 }}>{c.author.nickname}</span>
        <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>· {score} ▲</span>
      </div>

      {editing ? (
        <div style={{ paddingLeft: pad }}>
          <RichEditor value={editText} onChange={setEditText} dense minHeight={56} onSubmit={saveEdit} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btnp" style={{ padding: "7px 16px" }} onClick={saveEdit}>{L.save}</button>
            <button className="btng" style={{ padding: "7px 14px" }} onClick={() => { setEditText(c.bodyHtml); setEditing(false); }}>{L.cancel}</button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: indent ? 13 : 14, lineHeight: 1.6, margin: 0, paddingLeft: pad, color: "var(--text)", fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />
          <div style={{ paddingLeft: pad, display: "flex", gap: 14, marginTop: 6 }}>
            <span className="link" style={{ fontSize: 12 }} onClick={upvote}>▲ {L.up}</span>
            {onReply && me && <span className="link" style={{ fontSize: 12 }} onClick={onReply}>{L.reply}</span>}
            {isAuthor && <span className="link" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>{L.edit}</span>}
            {isAuthor && <span className="link" style={{ fontSize: 12, color: "#e0554b" }} onClick={del}>{L.remove}</span>}
          </div>
        </>
      )}
    </div>
  );
}
