import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { NotificationDTO } from "../api/types";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";

// On first arrival in a browser session, if there are unread notifications, greet
// the user with a centered modal summarizing them (friend requests, etc.).
export function WelcomeBackModal() {
  const { me } = useAuth();
  const { L, lang } = useLang();
  const nav = useNavigate();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me) return;
    if (sessionStorage.getItem("ag_greeted") === "1") return;
    api.get<{ notifications: NotificationDTO[]; unread: number }>("/notifications").then((r) => {
      const unread = r.notifications.filter((n) => !n.read).slice(0, 8);
      if (unread.length > 0) { setItems(unread); setOpen(true); }
      sessionStorage.setItem("ag_greeted", "1");
    }).catch(() => {});
  }, [me]);

  if (!open) return null;

  const label = (n: NotificationDTO) => {
    const who = n.actor?.nickname ?? n.text ?? "";
    const action = L[`notif_${n.type}`] ?? "";
    return n.type === "join_request" ? `${action}${n.text ? `: ${n.text}` : ""}` : `${who} ${action}`;
  };
  const hasRequests = items.some((n) => ["friend_request", "community_invite", "join_request"].includes(n.type));

  return (
    <Modal onClose={() => setOpen(false)} width={440}>
      <div style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>👋</span>
          <h2 className="fk" style={{ fontWeight: 600, fontSize: 21, flex: 1 }}>{L.whileAway}</h2>
          <button className="btng" style={{ padding: "6px 10px", boxShadow: "none" }} onClick={() => setOpen(false)}><span style={{ fontSize: 14 }}>✕</span></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          {items.map((n) => (
            <div key={n.id} className="hoverrow" style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 10px" }}
              onClick={() => { setOpen(false); nav(n.postId ? `/post/${n.postId}` : "/requests"); }}>
              {n.actor ? <Avatar nickname={n.actor.nickname} avatarUrl={n.actor.avatarUrl} size={34} /> : <div className="sticker" style={{ width: 34, height: 34, background: "var(--acsoft)" }}>📨</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{label(n)}</div>
                <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 700 }}>{timeAgo(n.createdAt, lang)}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {hasRequests && <button className="btnp" style={{ padding: "9px 18px" }} onClick={() => { setOpen(false); nav("/requests"); }}>{L.viewRequests}</button>}
          <button className="btng" onClick={() => setOpen(false)}>{L.close}</button>
        </div>
      </div>
    </Modal>
  );
}
