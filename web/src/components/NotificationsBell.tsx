import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import type { NotificationDTO } from "../api/types";
import { useLang } from "../store/providers";
import { timeAgo } from "../store/utils";
import { Avatar } from "./Avatar";

function targetOf(n: NotificationDTO): string {
  if (n.postId) return `/post/${n.postId}`;
  if (n.type === "community_invite" || n.type === "join_request") return "/requests";
  if (n.type === "friend_request" || n.type === "friend_accept") return "/requests";
  return "/";
}

export function NotificationsBell() {
  const nav = useNavigate();
  const { L, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => api.get<{ notifications: NotificationDTO[]; unread: number }>("/notifications").then((r) => { setItems(r.notifications); setUnread(r.unread); }).catch(() => {});

  useEffect(() => {
    load();
    const s = getSocket();
    const onNotif = (n: NotificationDTO) => { setItems((xs) => [n, ...xs].slice(0, 50)); setUnread((u) => u + 1); };
    s.on("notification", onNotif);
    return () => { s.off("notification", onNotif); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function openMenu() {
    setOpen((v) => !v);
    if (!open && unread > 0) { await api.post("/notifications/read-all").catch(() => {}); setUnread(0); }
  }
  function go(n: NotificationDTO) {
    setOpen(false);
    nav(targetOf(n));
  }
  const label = (n: NotificationDTO) => {
    const who = n.actor?.nickname ?? n.text ?? "";
    const action = L[`notif_${n.type}`] ?? "";
    return n.type === "join_request" ? `${action}${n.text ? `: ${n.text}` : ""}` : `${who} ${action}`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="av" style={{ width: 42, height: 42, background: "var(--card)", border: "var(--sw) solid var(--stroke)", cursor: "pointer", fontSize: 18, color: "var(--text)" }} onClick={openMenu} title={L.notifications}>
        🔔
        {unread > 0 && (
          <span className="tag" style={{ position: "absolute", top: -6, right: -6, background: "var(--pink)", color: "#fff", minWidth: 18, padding: "0 5px", fontSize: 11, lineHeight: "18px", textAlign: "center" }}>{unread}</span>
        )}
      </button>
      {open && (
        <div className="chunk agmodal" style={{ position: "absolute", right: 0, top: 50, width: 340, maxHeight: 460, overflowY: "auto", padding: 8, zIndex: 60 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 10px 10px", borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 4 }}>
            <div className="fk" style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{L.notifications}</div>
          </div>
          {items.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--faint)", fontWeight: 700, fontSize: 13 }}>{L.noNotifications}</div>}
          {items.map((n) => (
            <div key={n.id} className="hoverrow" style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 10px", background: n.read ? undefined : "var(--acsoft)" }} onClick={() => go(n)}>
              {n.actor ? <Avatar nickname={n.actor.nickname} avatarUrl={n.actor.avatarUrl} size={34} /> : <div className="sticker" style={{ width: 34, height: 34, background: "var(--acsoft)" }}>📨</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>{label(n)}</div>
                <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 700 }}>{timeAgo(n.createdAt, lang)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
