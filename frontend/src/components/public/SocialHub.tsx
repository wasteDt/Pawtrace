import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type UIEvent } from "react";
import { type SessionData, json } from "../../shared";

type Person = {
  id: number;
  nickname: string;
  avatarUrl: string | null;
  professional: {
    type: string;
    displayName: string;
    organization: string;
  } | null;
  isFollowing: boolean;
  followsMe?: boolean;
};
type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
};
type Conversation = {
  id: number;
  peer: Person;
  lastMessage: ChatMessage | null;
  lastMessageAt: string | null;
  unreadCount: number;
  muted: boolean;
};
type ConnectionType = "discover" | "following" | "followers" | "friends";

export default function SocialHub({
  session,
  openSystemNotifications,
  refreshKey,
  onUnreadChange,
}: {
  session: SessionData;
  openSystemNotifications: () => void;
  refreshKey: number;
  onUnreadChange: (count: number) => void;
}) {
  const [section, setSection] = useState<"chats" | "contacts" | "settings">(
    "chats",
  );
  const [connectionType, setConnectionType] =
    useState<ConnectionType>("discover");
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const selectedIdRef = useRef<number | null>(null);
  const lastVisibleRef = useRef(true);
  const pendingScrollRef = useRef<"bottom" | { height: number; top: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const syncingNewRef = useRef(false);
  const pendingNewSyncRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [privacy, setPrivacy] = useState<"FOLLOWERS" | "MUTUAL">("FOLLOWERS");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadConversations();
    void loadPeople("discover", "");
    void loadPrivacy();
  }, [session.user.id]);

  useEffect(() => {
    if (refreshKey) {
      void loadConversations();
      if (selectedIdRef.current) void loadNewMessages(selectedIdRef.current);
    }
  }, [refreshKey]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    pendingScrollRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setHasMore(false);
    setNewMessageCount(0);
    setShowScrollBottom(false);
    lastVisibleRef.current = true;
    if (!selectedId) return;
    void loadMessages(selectedId);
  }, [selectedId]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    const pending = pendingScrollRef.current;
    if (!list || !pending) return;
    if (pending === "bottom") list.scrollTop = list.scrollHeight;
    else list.scrollTop = pending.top + list.scrollHeight - pending.height;
    pendingScrollRef.current = null;
    updateLastVisibility();
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadPeople(type: ConnectionType, query = search) {
    try {
      const url =
        type === "discover"
          ? `/api/v1/directory/users?q=${encodeURIComponent(query)}`
          : `/api/v1/me/connections?type=${type}`;
      const result = await json<{ data: Person[] }>(
        await fetch(url, { credentials: "include" }),
      );
      setPeople(result.data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "联系人加载失败");
    }
  }

  async function loadConversations() {
    try {
      const result = await json<{ data: Conversation[] }>(
        await fetch("/api/v1/conversations", { credentials: "include" }),
      );
      setConversations(result.data);
      onUnreadChange(
        result.data.reduce((sum, item) => sum + item.unreadCount, 0),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "会话加载失败");
    }
  }

  async function loadMessages(id: number, beforeId?: number) {
    try {
      const result = await json<{
        data: { messages: ChatMessage[]; hasMore: boolean };
      }>(
        await fetch(
          `/api/v1/conversations/${id}/messages${beforeId ? `?beforeId=${beforeId}` : ""}`,
          { credentials: "include" },
        ),
      );
      if (selectedIdRef.current !== id) return;
      if (beforeId && result.data.messages.length === 0) pendingScrollRef.current = null;
      const next = beforeId
        ? [...result.data.messages, ...messagesRef.current]
        : result.data.messages;
      if (!beforeId) pendingScrollRef.current = "bottom";
      messagesRef.current = next;
      setMessages(next);
      setHasMore(result.data.hasMore);
      if (!beforeId) void markRead(id);
    } catch (error) {
      if (beforeId) pendingScrollRef.current = null;
      setNotice(error instanceof Error ? error.message : "消息加载失败");
    }
  }

  async function loadOlderMessages() {
    const id = selectedIdRef.current;
    const first = messagesRef.current[0];
    const list = messageListRef.current;
    if (!id || !first || !list || !hasMore || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    pendingScrollRef.current = { height: list.scrollHeight, top: list.scrollTop };
    try {
      await loadMessages(id, first.id);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  async function loadNewMessages(id: number) {
    if (syncingNewRef.current) {
      pendingNewSyncRef.current = true;
      return;
    }
    let afterId = messagesRef.current[messagesRef.current.length - 1]?.id;
    if (!afterId || selectedIdRef.current !== id) return;
    syncingNewRef.current = true;
    const wasVisible = lastVisibleRef.current;
    let received = 0;
    try {
      for (;;) {
        const result: {
          data: { messages: ChatMessage[]; hasMore: boolean };
        } = await json(await fetch(`/api/v1/conversations/${id}/messages?afterId=${afterId}`, { credentials: "include" }));
        if (selectedIdRef.current !== id) return;
        const fresh: ChatMessage[] = result.data.messages.filter((item) => item.id > afterId!);
        if (fresh.length) {
          if (wasVisible) pendingScrollRef.current = "bottom";
          const next = [...messagesRef.current, ...fresh];
          messagesRef.current = next;
          setMessages(next);
          received += fresh.filter((item) => item.senderId !== session.user.id).length;
          afterId = fresh[fresh.length - 1].id;
        }
        if (!result.data.hasMore || !fresh.length) break;
      }
      if (received) {
        if (wasVisible) {
          setNewMessageCount(0);
          void markRead(id);
        } else setNewMessageCount((count) => count + received);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "新消息加载失败");
    } finally {
      syncingNewRef.current = false;
      if (pendingNewSyncRef.current) {
        pendingNewSyncRef.current = false;
        if (selectedIdRef.current) void loadNewMessages(selectedIdRef.current);
      }
    }
  }

  function updateLastVisibility() {
    const list = messageListRef.current;
    const last = lastMessageRef.current;
    if (!list || !last) return;
    const viewport = list.getBoundingClientRect();
    const bubble = last.getBoundingClientRect();
    const visible = bubble.top < viewport.bottom && bubble.bottom > viewport.top;
    lastVisibleRef.current = visible;
    setShowScrollBottom(!visible);
    if (visible && newMessageCount) {
      setNewMessageCount(0);
      if (selectedIdRef.current) void markRead(selectedIdRef.current);
    }
  }

  function onMessageScroll(event: UIEvent<HTMLDivElement>) {
    updateLastVisibility();
    if (event.currentTarget.scrollTop < 80) void loadOlderMessages();
  }

  function scrollToLatest() {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    lastVisibleRef.current = true;
    setShowScrollBottom(false);
    setNewMessageCount(0);
    if (selectedIdRef.current) void markRead(selectedIdRef.current);
  }

  async function markRead(id: number) {
    await fetch(`/api/v1/conversations/${id}/read`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": session.csrfToken },
    });
    setConversations((items) =>
      items.map((item) =>
        item.id === id ? { ...item, unreadCount: 0 } : item,
      ),
    );
    await loadConversations();
  }

  async function loadPrivacy() {
    try {
      const result = await json<{
        data: { messagePrivacy: "FOLLOWERS" | "MUTUAL" };
      }>(
        await fetch("/api/v1/me/settings/message-privacy", {
          credentials: "include",
        }),
      );
      setPrivacy(result.data.messagePrivacy);
    } catch {
      /* 设置页仍可保持默认展示 */
    }
  }

  async function changeFollow(person: Person) {
    try {
      await json(
        await fetch(`/api/v1/users/${person.id}/follow`, {
          method: person.isFollowing ? "DELETE" : "PUT",
          credentials: "include",
          headers: { "X-CSRF-Token": session.csrfToken },
        }),
      );
      await loadPeople(connectionType);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "关注操作失败");
    }
  }

  async function startChat(person: Person) {
    try {
      const result = await json<{ data: { id: number } }>(
        await fetch("/api/v1/conversations", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ targetUserId: person.id }),
        }),
      );
      await loadConversations();
      setSelectedId(result.data.id);
      setSection("chats");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法发起聊天");
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true);
    try {
      const result = await json<{ data: ChatMessage }>(
        await fetch(`/api/v1/conversations/${selectedId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ body: draft.trim() }),
        }),
      );
      setDraft("");
      pendingScrollRef.current = "bottom";
      if (!messagesRef.current.some((item) => item.id === result.data.id)) {
        const next = [...messagesRef.current, result.data];
        messagesRef.current = next;
        setMessages(next);
      } else scrollToLatest();
      await loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "消息发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function savePrivacy(value: "FOLLOWERS" | "MUTUAL") {
    try {
      const result = await json<{
        data: { messagePrivacy: "FOLLOWERS" | "MUTUAL" };
      }>(
        await fetch("/api/v1/me/settings/message-privacy", {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ messagePrivacy: value }),
        }),
      );
      setPrivacy(result.data.messagePrivacy);
      setNotice("消息接收设置已保存");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "设置保存失败");
    }
  }

  async function hideConversation(id: number) {
    if (!window.confirm("仅从你的会话列表隐藏此聊天？对方的消息不会被删除。"))
      return;
    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      if (!response.ok) await json(response);
      setSelectedId(null);
      setMessages([]);
      await loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "隐藏会话失败");
    }
  }

  const selected = conversations.find((item) => item.id === selectedId);
  const unreadTotal = conversations.reduce(
    (sum, item) => sum + item.unreadCount,
    0,
  );

  return (
    <main className="social-page">
      <header className="social-heading">
        <div>
          <p className="eyebrow">PAWTRACE SOCIAL</p>
          <h1>消息与关注</h1>
          <p>与关注的人交流，私密消息按联系人聚合。</p>
        </div>
        <button className="secondary-button" onClick={openSystemNotifications}>
          系统通知
        </button>
      </header>
      {notice && (
        <div className="social-notice" role="alert">
          {notice}
        </div>
      )}
      <nav className="social-tabs">
        <button
          className={section === "chats" ? "active" : ""}
          onClick={() => setSection("chats")}
        >
          会话 {unreadTotal > 0 && <b>{unreadTotal}</b>}
        </button>
        <button
          className={section === "contacts" ? "active" : ""}
          onClick={() => setSection("contacts")}
        >
          关注与好友
        </button>
        <button
          className={section === "settings" ? "active" : ""}
          onClick={() => setSection("settings")}
        >
          消息设置
        </button>
      </nav>
      {section === "contacts" && (
        <section className="social-card">
          <div className="social-tabs compact">
            {(["discover", "following", "followers", "friends"] as const).map(
              (type) => (
                <button
                  key={type}
                  className={connectionType === type ? "active" : ""}
                  onClick={() => {
                    setConnectionType(type);
                    void loadPeople(type);
                  }}
                >
                  {
                    {
                      discover: "发现用户",
                      following: "我的关注",
                      followers: "我的粉丝",
                      friends: "互关好友",
                    }[type]
                  }
                </button>
              ),
            )}
          </div>
          {connectionType === "discover" && (
            <form
              className="social-search"
              onSubmit={(event) => {
                event.preventDefault();
                void loadPeople("discover", search);
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索昵称或医生展示名"
              />
              <button className="secondary-button">搜索</button>
            </form>
          )}
          {people.length === 0 ? (
            <p className="social-empty">这里还没有用户。</p>
          ) : (
            people.map((person) => (
              <article className="social-person" key={person.id}>
                <span className="social-avatar">
                  {person.nickname.slice(0, 1)}
                </span>
                <div>
                  <strong>
                    {person.professional?.displayName || person.nickname}
                  </strong>
                  <p>
                    {person.professional
                      ? `${person.professional.type === "VETERINARIAN" ? "认证宠物医生" : "认证医生助理"} · ${person.professional.organization}`
                      : person.followsMe
                        ? "关注了你"
                        : "宠物主人"}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void changeFollow(person)}
                >
                  {person.isFollowing ? "取消关注" : "关注"}
                </button>
                {person.isFollowing && (
                  <button
                    className="primary-button compact"
                    onClick={() => void startChat(person)}
                  >
                    聊天
                  </button>
                )}
              </article>
            ))
          )}
        </section>
      )}
      {section === "chats" && (
        <section className="social-chat-layout">
          <aside className="social-chat-list">
            {conversations.length === 0 ? (
              <p className="social-empty">
                还没有会话。去关注用户并开始聊天吧。
              </p>
            ) : (
              conversations.map((item) => (
                <button
                  key={item.id}
                  className={selectedId === item.id ? "selected" : ""}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="social-avatar">
                    {item.peer.nickname.slice(0, 1)}
                  </span>
                  <span className="social-chat-summary">
                    <strong>
                      {item.peer.professional?.displayName ||
                        item.peer.nickname}
                    </strong>
                    <small>{item.lastMessage?.body || "开始聊天"}</small>
                  </span>
                  {item.unreadCount > 0 && <b>{item.unreadCount}</b>}
                </button>
              ))
            )}
          </aside>
          <div className="social-chat-panel">
            {selected ? (
              <>
                <div className="social-chat-header">
                  <strong>
                    {selected.peer.professional?.displayName ||
                      selected.peer.nickname}
                  </strong>
                  <button
                    className="danger-link"
                    onClick={() => void hideConversation(selected.id)}
                  >
                    隐藏会话
                  </button>
                </div>
                <div className="social-message-viewport">
                <div className="social-message-list" ref={messageListRef} onScroll={onMessageScroll}>
                  {hasMore && (
                    <button
                      className="secondary-button"
                      disabled={loadingOlder}
                      onClick={() => void loadOlderMessages()}
                    >
                      {loadingOlder ? "正在加载..." : "向上滚动加载更早消息"}
                    </button>
                  )}
                  {messages.length === 0 && (
                    <p className="social-empty">发送第一条消息吧。</p>
                  )}
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      ref={item.id === messages[messages.length - 1]?.id ? lastMessageRef : undefined}
                      className={`social-message ${item.senderId === session.user.id ? "mine" : ""}`}
                    >
                      <p>{item.body}</p>
                      <time>
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </time>
                    </div>
                  ))}
                </div>
                {(newMessageCount > 0 || showScrollBottom) && (
                  <div className="social-latest-control">
                    {newMessageCount > 0 && <span className="social-new-message-tip">最新消息 {newMessageCount} 条</span>}
                    <button type="button" className="social-scroll-bottom" aria-label="回到最新消息" title="回到最新消息" onClick={scrollToLatest}>↓</button>
                  </div>
                )}
                </div>
                <form className="social-composer" onSubmit={sendMessage}>
                  <textarea
                    value={draft}
                    maxLength={2000}
                    rows={2}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="输入消息…"
                  />
                  <button
                    className="primary-button compact"
                    disabled={busy || !draft.trim()}
                  >
                    发送
                  </button>
                </form>
              </>
            ) : (
              <p className="social-empty">
                选择一个会话，或从关注列表发起聊天。
              </p>
            )}
          </div>
        </section>
      )}
      {section === "settings" && (
        <section className="social-card social-settings">
          <h2>消息隐私</h2>
          <p>
            选择谁可以向你发送新的聊天消息。更改后立即生效，历史消息不会被删除。
          </p>
          <label>
            <input
              type="radio"
              checked={privacy === "FOLLOWERS"}
              onChange={() => void savePrivacy("FOLLOWERS")}
            />{" "}
            允许存在单向关注关系的会话双方聊天（默认）
          </label>
          <label>
            <input
              type="radio"
              checked={privacy === "MUTUAL"}
              onChange={() => void savePrivacy("MUTUAL")}
            />{" "}
            仅接收互相关注用户的消息
          </label>
        </section>
      )}
    </main>
  );
}
