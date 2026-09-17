import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import type { ChatListItem, PublicUser } from "../api/types";
import { useLang } from "../store/providers";
import { Icon } from "../icons/Icon";
import { Avatar } from "./Avatar";

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

type FriendEntry = { friendshipId: string; user: PublicUser };

export function ShareModal({ post, onClose }: { post: { id: string; title: string }; onClose: () => void }) {
  const { L } = useLang();
  const url = `${location.origin}/post/${post.id}`;
  const title = stripTags(post.title);
  const body = `${title} — <a href="${url}">${url}</a>`;
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [sentKey, setSentKey] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ friends: FriendEntry[] }>("/friends").then((r) => setFriends(r.friends)).catch(() => {});
    api.get<{ chats: ChatListItem[] }>("/chats").then((r) => setChats(r.chats.filter((c) => c.type === "group"))).catch(() => {});
  }, []);

  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function nativeShare() {
    (navigator as Navigator & { share?: (d: unknown) => Promise<void> }).share?.({ title, text: title, url }).catch(() => {});
  }
  async function sendToFriend(f: FriendEntry) {
    const { chatId } = await api.post<{ chatId: string }>("/chats/direct", { userId: f.user.id });
    getSocket().emit("chat:message", { chatId, body });
    setSentKey("f" + f.user.id);
  }
  function sendToChat(c: ChatListItem) {
    getSocket().emit("chat:message", { chatId: c.id, body });
    setSentKey("c" + c.id);
  }

  const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 100, padding: 20 };
  const canNative = typeof (navigator as Navigator & { share?: unknown }).share === "function";

  return (
    <div className="agback" style={overlay} onClick={onClose}>
      <div className="chunk agmodal" style={{ width: "100%", maxWidth: 440, padding: "20px 22px", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h3 className="fk" style={{ fontWeight: 600, fontSize: 20, flex: 1 }}>{L.share}</h3>
          <button className="btng" style={{ padding: "6px 10px", boxShadow: "none" }} onClick={onClose}><Icon name="x" size={13} /></button>
        </div>

        {/* Link + copy */}
        <div style={{ display: "flex", gap: 8, marginBottom: canNative ? 10 : 18 }}>
          <input className="finput" readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
          <button className="btnp" style={{ padding: "10px 16px", flex: "none" }} onClick={copy}>{copied ? L.copied : L.copyLink}</button>
        </div>
        {canNative && (
          <button className="btng block" style={{ marginBottom: 18 }} onClick={nativeShare}><Icon name="share" size={13} /> {L.shareOther}</button>
        )}

        <div style={{ height: "var(--sw)", background: "var(--stroke)", opacity: 0.35, margin: "4px 0 14px" }} />
        <div className="kick" style={{ marginBottom: 10 }}>{L.shareToFriend}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {chats.map((c) => {
            const key = "c" + c.id;
            return (
              <div key={key} className="hoverrow" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                <Avatar nickname={c.title} size={34} />
                <span className="fk" style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{c.title}</span>
                <button className={sentKey === key ? "chip on" : "btng"} style={{ padding: "6px 12px", boxShadow: "none", flex: "none" }} disabled={sentKey === key} onClick={() => sendToChat(c)}>
                  {sentKey === key ? `✓ ${L.sent}` : L.send2}
                </button>
              </div>
            );
          })}
          {friends.map((f) => {
            const key = "f" + f.user.id;
            return (
              <div key={key} className="hoverrow" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                <Avatar nickname={f.user.nickname} avatarUrl={f.user.avatarUrl} size={34} />
                <span className="fk" style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0 }}>{f.user.nickname}</span>
                <button className={sentKey === key ? "chip on" : "btng"} style={{ padding: "6px 12px", boxShadow: "none", flex: "none" }} disabled={sentKey === key} onClick={() => sendToFriend(f)}>
                  {sentKey === key ? `✓ ${L.sent}` : L.send2}
                </button>
              </div>
            );
          })}
          {friends.length === 0 && chats.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--faint)", fontWeight: 700, padding: "6px 10px" }}>{L.noFriendsToShare}</div>
          )}
        </div>
      </div>
    </div>
  );
}
