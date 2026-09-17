import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import type { ChatListItem, MessageDTO, PersonDTO } from "../api/types";
import { Layout } from "../components/Layout";
import { Avatar } from "../components/Avatar";
import { Icon } from "../icons/Icon";
import { useAuth, useLang } from "../store/providers";
import { timeAgo } from "../store/utils";

export function Friends() {
  const nav = useNavigate();
  const { L, lang } = useLang();
  const { me } = useAuth();
  const [tab, setTab] = useState<"chats" | "people">("chats");
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const loadChats = () => api.get<{ chats: ChatListItem[] }>("/chats").then((r) => setChats(r.chats));
  const loadPeople = () => api.get<{ people: PersonDTO[] }>("/people").then((r) => setPeople(r.people));

  useEffect(() => { loadChats(); loadPeople(); }, []);

  // Socket wiring for the active chat.
  useEffect(() => {
    const s = getSocket();
    const onMsg = (m: MessageDTO & { chatId: string }) => {
      if (m.chatId === activeChat) {
        setMessages((ms) => [...ms, { ...m, mine: m.author.id === me?.id }]);
      }
      loadChats();
    };
    const onTyping = (p: { chatId: string; user: { nickname: string } }) => {
      if (p.chatId === activeChat && p.user.nickname !== me?.nickname) {
        setTypingUser(p.user.nickname);
        setTimeout(() => setTypingUser(null), 1800);
      }
    };
    s.on("chat:message", onMsg);
    s.on("chat:typing", onTyping);
    s.on("chat:unread", loadChats);
    return () => { s.off("chat:message", onMsg); s.off("chat:typing", onTyping); s.off("chat:unread", loadChats); };
  }, [activeChat, me?.id, me?.nickname]);

  useEffect(() => { scroller.current?.scrollTo(0, scroller.current.scrollHeight); }, [messages]);

  async function openChat(chatId: string) {
    setActiveChat(chatId);
    getSocket().emit("chat:join", chatId);
    const r = await api.get<{ messages: MessageDTO[] }>(`/chats/${chatId}/messages`);
    setMessages(r.messages);
    loadChats();
  }

  async function messagePerson(userId: string) {
    const { chatId } = await api.post<{ chatId: string }>("/chats/direct", { userId });
    setTab("chats");
    await loadChats();
    openChat(chatId);
  }

  async function addFriend(userId: string) {
    await api.post("/friends/request", { userId }).catch(() => {});
    loadPeople();
  }

  function send() {
    if (!draft.trim() || !activeChat) return;
    getSocket().emit("chat:message", { chatId: activeChat, body: draft });
    setDraft("");
  }

  const active = useMemo(() => chats.find((c) => c.id === activeChat) ?? null, [chats, activeChat]);

  const right = (
    <div className="side" style={{ padding: 16 }}>
      <div className="kick" style={{ marginBottom: 10, color: "var(--ac)" }}>{L.requests}</div>
      <button className="btng block" onClick={() => nav("/requests")}><Icon name="inbox" size={14} /> {L.requests}</button>
    </div>
  );

  return (
    <Layout mode="feed" right={right}>
      <div style={{ display: "flex", gap: 22, borderBottom: "var(--sw) solid var(--stroke)", marginBottom: 18 }}>
        <span className={`tab ${tab === "chats" ? "on" : ""}`} onClick={() => setTab("chats")}>{L.friendsChats}</span>
        <span className={`tab ${tab === "people" ? "on" : ""}`} onClick={() => setTab("people")}>{L.people}</span>
      </div>

      {tab === "people" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {people.map((p) => (
            <div key={p.id} className="chunk" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar nickname={p.nickname} avatarUrl={p.avatarUrl} size={44} onClick={() => nav(`/profile/${p.nickname}`)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fk link" style={{ fontWeight: 600, fontSize: 15 }} onClick={() => nav(`/profile/${p.nickname}`)}>{p.nickname}</div>
                {p.bio && <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{p.bio}</div>}
              </div>
              {p.status === "accepted" ? (
                <button className="btng" onClick={() => messagePerson(p.id)}><Icon name="comment" size={13} /> {L.message}</button>
              ) : p.status === "pending" ? (
                <span className="chip" style={{ cursor: "default" }}>{L.pending}</span>
              ) : (
                <button className="btng" onClick={() => addFriend(p.id)}><Icon name="userPlus" size={13} /> {L.addFriend}</button>
              )}
            </div>
          ))}
          {people.length === 0 && <div className="chunk" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontWeight: 600 }}>{L.empty}</div>}
        </div>
      ) : (
        <div className="chunk" style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 480, overflow: "hidden" }}>
          <div style={{ borderRight: "var(--sw) solid var(--stroke)", overflowY: "auto" }}>
            {chats.map((c) => (
              <div key={c.id} className="hoverrow" style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", background: c.id === activeChat ? "var(--hover)" : undefined }} onClick={() => openChat(c.id)}>
                <Avatar nickname={c.title} avatarUrl={c.others[0]?.avatarUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fk" style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage?.body ?? "—"}</div>
                </div>
                {c.unread > 0 && <span className="tag" style={{ background: "var(--pink)", color: "#fff", padding: "2px 7px" }}>{c.unread}</span>}
              </div>
            ))}
            {chats.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "var(--faint)", fontWeight: 700 }}>{L.noChats}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {active ? (
              <>
                <div style={{ padding: "12px 16px", borderBottom: "var(--sw) solid var(--stroke)", display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar nickname={active.title} avatarUrl={active.others[0]?.avatarUrl} size={34} />
                  <div className="fk" style={{ fontWeight: 600 }}>{active.title}</div>
                  {typingUser && <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, marginLeft: 8 }}>{typingUser} {L.typing}</span>}
                </div>
                <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {messages.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start" }}>
                      <div className={`bub2 ${m.mine ? "me" : "you"}`}>{m.body}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, borderTop: "var(--sw) solid var(--stroke)", display: "flex", gap: 8 }}>
                  <input className="finput" value={draft} placeholder={L.messagePlaceholder}
                    onChange={(e) => { setDraft(e.target.value); getSocket().emit("chat:typing", { chatId: active.id }); }}
                    onKeyDown={(e) => e.key === "Enter" && send()} />
                  <button className="btnp" style={{ padding: "10px 18px" }} onClick={send}><Icon name="paperplane" size={15} /></button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--faint)", fontWeight: 700 }}>{L.noChats}</div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
