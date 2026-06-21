"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, MessageCircle, Send, X } from "lucide-react";

import {
  buildMessagingWsUrl,
  getDirectMessages,
  getLeagueMessages,
  markMessagesRead,
  type AuthUser,
  type ChatMessage,
  type MessagingContact,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConversationType = "dm" | "league";

type Conversation = {
  type: ConversationType;
  id: string;
  name: string;
  avatar: string | null;
  unreadCount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDisplayName(member: MessagingContact): string {
  return member.alias || member.email;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Avatar({
  avatarUrl,
  name,
  size = "md",
}: {
  avatarUrl: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center shrink-0`}
    >
      {initials(name)}
    </div>
  );
}

function MessageBubble({
  msg,
  isMe,
  showSender,
}: {
  msg: ChatMessage;
  isMe: boolean;
  showSender: boolean;
}) {
  const senderName = msg.senderAlias || msg.senderEmail;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} gap-0.5`}>
      {showSender && !isMe && (
        <span className="text-[10px] text-zinc-400 pl-1">{senderName}</span>
      )}
      <div
        className={`max-w-[220px] rounded-2xl px-3 py-2 text-sm leading-snug break-words ${
          isMe
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-zinc-100 text-zinc-900 rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
      <span className="text-[10px] text-zinc-400">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessagingOverlay({
  currentUser,
  leagueId,
  leagueName,
  members,
}: {
  currentUser: AuthUser;
  leagueId: string | null;
  leagueName: string | null;
  members: MessagingContact[];
}) {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"list" | "conversation">("list");
  const [selected, setSelected] = React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = React.useState<Record<string, number>>({});
  const [inputText, setInputText] = React.useState("");
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  // Ref so the WS message handler can read current selected conversation
  // without being a side-effect inside a state setter (Strict Mode safe).
  const selectedRef = React.useRef<Conversation | null>(null);
  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Build conversation list from league + members
  const conversations: Conversation[] = React.useMemo(() => {
    const list: Conversation[] = [];
    if (leagueId && leagueName) {
      list.push({
        type: "league",
        id: leagueId,
        name: leagueName,
        avatar: null,
        unreadCount: unreadCounts[leagueId] ?? 0,
      });
    }
    for (const m of members) {
      if (m.userId === currentUser.id) continue;
      list.push({
        type: "dm",
        id: m.userId,
        name: getDisplayName(m),
        avatar: m.avatarDataUrl,
        unreadCount: unreadCounts[m.userId] ?? 0,
      });
    }
    return list;
  }, [leagueId, leagueName, members, unreadCounts, currentUser.id]);

  const totalUnread = React.useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts],
  );

  // WebSocket setup
  const connectWs = React.useCallback(() => {
    const url = buildMessagingWsUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as Record<string, unknown>;
        if (data.type === "unread_counts") {
          setUnreadCounts(data.counts as Record<string, number>);
        } else if (data.type === "new_message") {
          const msg = data.message as ChatMessage;
          const cur = selectedRef.current;
          const inThisConversation =
            cur != null &&
            ((cur.type === "league" && msg.channelType === "league" && msg.leagueId === cur.id) ||
              (cur.type === "dm" &&
                msg.channelType === "dm" &&
                (msg.senderId === cur.id || msg.recipientId === cur.id)));

          if (inThisConversation && cur) {
            // Deduplicate in case the same message arrives more than once
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
            if (msg.senderId !== currentUser.id) {
              wsRef.current?.send(
                JSON.stringify({
                  type: "mark_read",
                  conversationType: cur.type,
                  conversationId: cur.id,
                }),
              );
            }
          } else {
            const countKey =
              msg.channelType === "league"
                ? (msg.leagueId ?? "")
                : msg.senderId === currentUser.id
                  ? (msg.recipientId ?? "")
                  : msg.senderId;
            if (countKey && msg.senderId !== currentUser.id) {
              setUnreadCounts((prev) => ({
                ...prev,
                [countKey]: (prev[countKey] ?? 0) + 1,
              }));
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connectWs, 4000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [currentUser.id]);

  React.useEffect(() => {
    setMounted(true);
    connectWs();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWs]);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when conversation opens
  React.useEffect(() => {
    if (view === "conversation") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [view]);

  async function openConversation(conv: Conversation) {
    setSelected(conv);
    setView("conversation");
    setMessages([]);
    setLoadingMessages(true);
    try {
      const msgs =
        conv.type === "league"
          ? await getLeagueMessages(conv.id)
          : await getDirectMessages(conv.id);
      setMessages(msgs);
    } finally {
      setLoadingMessages(false);
    }
    // Mark as read
    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
    wsRef.current?.send(
      JSON.stringify({
        type: "mark_read",
        conversationType: conv.type,
        conversationId: conv.id,
      }),
    );
    markMessagesRead(conv.type, conv.id).catch(() => {});
  }

  function sendMessage() {
    if (!selected || !inputText.trim() || !wsRef.current) return;
    const ws = wsRef.current;
    if (ws.readyState !== WebSocket.OPEN) return;

    const content = inputText.trim();
    setInputText("");

    if (selected.type === "dm") {
      ws.send(JSON.stringify({ type: "send_dm", recipientId: selected.id, content }));
    } else {
      ws.send(JSON.stringify({ type: "send_league", leagueId: selected.id, content }));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function goBack() {
    setView("list");
    setSelected(null);
    setMessages([]);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-80 rounded-2xl shadow-2xl border border-zinc-200 bg-white flex flex-col overflow-hidden dark:border-zinc-700 dark:bg-zinc-900"
             style={{ height: "480px" }}>

          {/* Header */}
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-700 px-4 py-3 shrink-0 bg-white dark:bg-zinc-900">
            {view === "conversation" && (
              <button
                onClick={goBack}
                className="flex size-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                type="button"
                aria-label="Back to conversations"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {view === "list" ? (
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">Messages</p>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  {selected && (
                    <Avatar avatarUrl={selected.avatar} name={selected.name} size="sm" />
                  )}
                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50 truncate">
                    {selected?.name}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              type="button"
              aria-label="Close messages"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Conversation list */}
          {view === "list" && (
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800">
              {conversations.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-zinc-400">No conversations yet</p>
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={`${conv.type}-${conv.id}`}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  onClick={() => openConversation(conv)}
                  type="button"
                >
                  <div className="relative">
                    <Avatar avatarUrl={conv.avatar} name={conv.name} />
                    {conv.type === "league" && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white">
                        #
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-50 truncate">
                        {conv.name}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {conv.type === "league" ? "League chat" : "Direct message"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Message thread */}
          {view === "conversation" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                {loadingMessages && (
                  <div className="flex justify-center py-4">
                    <div className="size-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  </div>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-zinc-400">No messages yet. Say hi!</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === currentUser.id;
                  const prevMsg = messages[i - 1];
                  const showSender =
                    selected?.type === "league" &&
                    (!prevMsg || prevMsg.senderId !== msg.senderId);
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={isMe}
                      showSender={showSender}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-zinc-100 dark:border-zinc-700 px-3 py-2 shrink-0 flex items-end gap-2 bg-white dark:bg-zinc-900">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-h-24 overflow-y-auto"
                  style={{ lineHeight: "1.4" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95"
        type="button"
        aria-label={open ? "Close messages" : "Open messages"}
      >
        {open ? (
          <X className="size-6" />
        ) : (
          <MessageCircle className="size-6" />
        )}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
    </div>,
    document.body,
  );
}
