import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useCompose, useLang } from "../store/providers";
import { Icon } from "../icons/Icon";

type Mode = "feed" | "page";

export function Layout({
  mode = "feed",
  right,
  leftExtra,
  children,
}: {
  mode?: Mode;
  right?: ReactNode;
  leftExtra?: ReactNode;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const { L } = useLang();
  const { openCompose } = useCompose();
  const [unread, setUnread] = useState(0);
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.get<{ totalUnread: number }>("/chats").then((r) => alive && setUnread(r.totalUnread)).catch(() => {});
      api
        .get<{ joinRequests: unknown[]; friendRequests: unknown[]; communityInvites: unknown[] }>("/requests")
        .then((r) => alive && setRequests((r.joinRequests?.length ?? 0) + (r.friendRequests?.length ?? 0) + (r.communityInvites?.length ?? 0)))
        .catch(() => {});
    };
    load();
    const s = getSocket();
    const onUnread = () => load();
    s.on("chat:unread", onUnread);
    return () => {
      alive = false;
      s.off("chat:unread", onUnread);
    };
  }, [loc.pathname]);

  const friendsBadge = unread + requests;

  const on = (prefix: string) =>
    (prefix === "/" ? loc.pathname === "/" : loc.pathname.startsWith(prefix)) ? "on" : "";

  return (
    <div className="applayout" data-mode={mode}>
      <aside className="side" style={{ padding: 14, position: "sticky", top: 88, alignSelf: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className={`nav ${on("/")}`} onClick={() => nav("/")}><Icon name="house" /> {L.feed}</div>
          <div className={`nav ${on("/explore")}`} onClick={() => nav("/explore")}><Icon name="rocket" /> {L.explore}</div>
          <div className={`nav ${on("/communities")}`} onClick={() => nav("/communities")}><Icon name="users" /> {L.communities}</div>
          <div className={`nav ${on("/friends")}`} onClick={() => nav("/friends")}>
            <Icon name="user" /> {L.friendsChats}
            {friendsBadge > 0 && (
              <span className="tag" style={{ marginLeft: "auto", background: "var(--pink)", color: "#fff", minWidth: 22, textAlign: "center", padding: "2px 7px" }}>{friendsBadge}</span>
            )}
          </div>
        </div>
        <button className="btng block" style={{ margin: "14px 0" }} onClick={() => openCompose()}>
          <Icon name="pen" /> {L.newPost}
        </button>
        {leftExtra}
      </aside>

      <main style={{ minWidth: 0 }}>{children}</main>

      {mode === "feed" && (
        <aside style={{ position: "sticky", top: 88, alignSelf: "start", display: "flex", flexDirection: "column", gap: 16 }}>
          {right}
        </aside>
      )}
    </div>
  );
}
