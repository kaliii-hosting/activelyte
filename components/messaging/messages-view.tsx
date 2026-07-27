"use client";

// Real-time messaging UI: conversation list + thread, with read receipts and
// unread indicators. Uses the conversation/message services (Firestore
// listeners), gated by Security Rules. Styled with Activelyte tokens.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdminRole } from "@/lib/types/roles";
import { listOrgUsers, type DirectoryUser } from "@/lib/services/directory";
import { sendPrivateBroadcast } from "@/lib/services/broadcast-service";
import {
  listenConversations,
  listenMemberStates,
  getOrCreateDirectConversation,
  createGroupConversation,
  markConversationRead,
  getMyMemberState,
  getConversation,
} from "@/lib/services/conversation-service";
import {
  listenMessages,
  sendTextMessage,
  sendAttachmentMessage,
} from "@/lib/services/message-service";
import {
  uploadAttachment,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/services/attachment-service";
import {
  listenPresence,
  listenTyping,
  setTyping,
  type Presence,
} from "@/lib/services/presence-service";
import type {
  Attachment,
  Conversation,
  ConversationMemberState,
  Message,
} from "@/lib/types/models";

const millis = (v: unknown): number =>
  v && typeof (v as { toMillis?: () => number }).toMillis === "function"
    ? (v as { toMillis: () => number }).toMillis()
    : 0;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentView({ att }: { att: Attachment }) {
  if (att.kind === "image") {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="mv-att-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={att.url} alt={att.name} />
      </a>
    );
  }
  if (att.kind === "voice") {
    return <audio className="mv-att-audio" controls src={att.url} />;
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      download={att.name}
      className="mv-att-file"
    >
      <span className="mv-att-ic" aria-hidden>
        📎
      </span>
      <span className="mv-att-meta">
        <span className="mv-att-name">{att.name}</span>
        <span className="mv-att-size">{formatBytes(att.size)}</span>
      </span>
    </a>
  );
}

function timeLabel(v: unknown): string {
  const ms = millis(v);
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function MessagesView() {
  const { user } = useAuth();
  const me = user?.uid;
  const org = user?.organizationId;

  const [dir, setDir] = useState<Record<string, DirectoryUser>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [linkedConv, setLinkedConv] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const searchParams = useSearchParams();

  // Open a conversation passed via ?c= (e.g. from the home People strip).
  useEffect(() => {
    const c = searchParams.get("c");
    if (c) setActiveId(c);
  }, [searchParams]);

  // If the deep-linked conversation isn't in the live list yet (listener lag
  // right after creation), fetch it once so the thread opens immediately.
  useEffect(() => {
    if (!activeId || conversations.some((c) => c.id === activeId)) return;
    getConversation(activeId).then((c) => c && setLinkedConv(c)).catch(() => {});
  }, [activeId, conversations]);

  // Load the org directory (names for direct/group titles + new-chat picker).
  useEffect(() => {
    if (!org) return;
    listOrgUsers(org)
      .then((users) => setDir(Object.fromEntries(users.map((u) => [u.uid, u]))))
      .catch(() => {});
  }, [org]);

  // Live conversation list.
  useEffect(() => {
    if (!me) return;
    return listenConversations(
      me,
      (cs) => setConversations(cs),
      (e) => setError(e.message),
    );
  }, [me]);

  // Compute unread indicators whenever conversations change.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        conversations.map(async (c) => {
          const state = await getMyMemberState(c.id, me).catch(() => null);
          const lastAt = millis(c.lastMessage?.at);
          const readAt = millis(state?.lastReadAt);
          next[c.id] =
            !!c.lastMessage &&
            c.lastMessage.senderId !== me &&
            lastAt > readAt;
        }),
      );
      if (!cancelled) setUnread(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, me]);

  const titleFor = useCallback(
    (c: Conversation): string => {
      if (c.type === "group") return c.title || "Group";
      const other = c.memberIds.find((u) => u !== me);
      return (other && dir[other]?.displayName) || dir[other ?? ""]?.email || "Direct message";
    },
    [dir, me],
  );

  const startDirect = async (otherUid: string) => {
    if (!me || !org) return;
    try {
      const id = await getOrCreateDirectConversation({ uid: me, organizationId: org }, otherUid);
      setActiveId(id);
      setShowNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start conversation.");
    }
  };

  const startGroup = async (title: string, memberIds: string[]) => {
    if (!me || !org) return;
    try {
      const id = await createGroupConversation({ uid: me, organizationId: org }, title, memberIds);
      setActiveId(id);
      setShowNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create group.");
    }
  };

  const startBroadcast = async (text: string, recipientUids: string[]) => {
    try {
      const { delivered } = await sendPrivateBroadcast(recipientUids, text);
      setShowNew(false);
      setError(null);
      // (delivered count could surface as a toast; conversations appear via the
      // live listener automatically.)
      void delivered;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed.");
    }
  };

  const isAdmin = isAdminRole(user?.role);

  if (!org) {
    return (
      <div className="mv-nostate">
        <style>{css}</style>
        <p className="mv-nostate-title">Messaging</p>
        <p className="mv-nostate-sub">
          Messaging is available to organization members. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const active =
    conversations.find((c) => c.id === activeId) ??
    (linkedConv?.id === activeId ? linkedConv : null);

  return (
    <div className={`mv${activeId ? " mv-thread-open" : ""}`}>
      <style>{css}</style>

      <aside className="mv-list">
        <div className="mv-list-head">
          <h1>Messages</h1>
          <button className="mv-new" onClick={() => setShowNew(true)}>
            + New
          </button>
        </div>
        {error && <div className="mv-error">{error}</div>}
        {conversations.length === 0 ? (
          <div className="mv-empty">No conversations yet. Tap “New”.</div>
        ) : (
          <ul>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  className={`mv-conv${c.id === activeId ? " on" : ""}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="mv-avatar" aria-hidden>
                    {c.type === "group" ? "#" : titleFor(c).charAt(0).toUpperCase()}
                  </span>
                  <span className="mv-conv-main">
                    <span className="mv-conv-top">
                      <span className="mv-conv-name">{titleFor(c)}</span>
                      <span className="mv-conv-time">{timeLabel(c.lastMessage?.at)}</span>
                    </span>
                    <span className="mv-conv-sub">
                      {c.lastMessage?.text ?? "No messages yet"}
                    </span>
                  </span>
                  {unread[c.id] && <span className="mv-dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="mv-pane">
        {active && me ? (
          <Thread
            key={active.id}
            conversation={active}
            me={me}
            dir={dir}
            title={titleFor(active)}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="mv-pane-empty">Select a conversation</div>
        )}
      </section>

      {showNew && (
        <NewConversation
          me={me!}
          dir={dir}
          isAdmin={isAdmin}
          onClose={() => setShowNew(false)}
          onDirect={startDirect}
          onGroup={startGroup}
          onBroadcast={startBroadcast}
        />
      )}
    </div>
  );
}

function Thread({
  conversation,
  me,
  dir,
  title,
  onBack,
}: {
  conversation: Conversation;
  me: string;
  dir: Record<string, DirectoryUser>;
  title: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Record<string, ConversationMemberState>>({});
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [otherPresence, setOtherPresence] = useState<Presence | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const otherUid =
    conversation.type === "direct"
      ? conversation.memberIds.find((u) => u !== me)
      : undefined;

  useEffect(() => {
    return listenMessages(conversation.id, setMessages, (e) => setErr(e.message));
  }, [conversation.id]);
  useEffect(() => {
    return listenMemberStates(conversation.id, setMembers);
  }, [conversation.id]);
  useEffect(() => {
    return listenTyping(conversation.id, me, setTypingUids);
  }, [conversation.id, me]);
  useEffect(() => {
    if (!otherUid) return;
    return listenPresence(otherUid, setOtherPresence);
  }, [otherUid]);

  // Publish typing state as the user types; auto-clear after a short pause and
  // on unmount / conversation switch.
  const publishTyping = (value: string) => {
    setText(value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      void setTyping(conversation.id, me, true);
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      isTypingRef.current = false;
      void setTyping(conversation.id, me, false);
    }, 2500);
  };
  useEffect(() => {
    return () => {
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
      if (isTypingRef.current) void setTyping(conversation.id, me, false);
    };
  }, [conversation.id, me]);

  // Mark read when the thread is open and new messages arrive.
  useEffect(() => {
    if (messages.length) void markConversationRead(conversation.id, me);
  }, [conversation.id, me, messages.length]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // "Read" for my latest message = another member's lastReadAt >= its time.
  const lastMineReadBy = useMemo(() => {
    const mine = [...messages].reverse().find((m) => m.senderId === me);
    if (!mine) return false;
    const at = millis(mine.createdAt);
    return conversation.memberIds
      .filter((u) => u !== me)
      .some((u) => millis(members[u]?.lastReadAt) >= at && at > 0);
  }, [messages, members, conversation.memberIds, me]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setErr(null);
    setText("");
    // Sending implies you stopped typing.
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    isTypingRef.current = false;
    void setTyping(conversation.id, me, false);
    try {
      await sendTextMessage(conversation.id, me, t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send.");
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ pct: number; name: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);

  const doUpload = async (blob: Blob, name: string, durationMs?: number) => {
    if (blob.size > MAX_ATTACHMENT_BYTES) {
      setErr("Attachment too large (max 10 GB).");
      return;
    }
    setErr(null);
    setUpload({ pct: 0, name });
    try {
      const { promise } = uploadAttachment(conversation.id, me, blob, name, {
        durationMs,
        onProgress: (pct) => setUpload({ pct, name }),
      });
      const attachment = await promise;
      await sendAttachmentMessage(conversation.id, me, attachment);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUpload(null);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void doUpload(f, f.name);
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      recStartRef.current = Date.now();
      mr.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        if (blob.size)
          void doUpload(blob, `voice-${Date.now()}.webm`, Date.now() - recStartRef.current);
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setErr("Microphone unavailable or permission denied.");
    }
  };

  const nameOf = (uid: string) =>
    uid === me ? "You" : dir[uid]?.displayName || dir[uid]?.email || "Member";

  return (
    <div className="mv-t">
      <header className="mv-t-head">
        <button className="mv-back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        {conversation.type === "direct" && (
          <span
            className={`mv-presence ${otherPresence?.state === "online" ? "on" : "off"}`}
            aria-label={otherPresence?.state === "online" ? "Online" : "Offline"}
          />
        )}
        <span className="mv-t-title">{title}</span>
        {conversation.type === "group" && (
          <span className="mv-t-count">{conversation.memberIds.length} members</span>
        )}
      </header>

      <div className="mv-t-body">
        {err && <div className="mv-error">{err}</div>}
        {messages.map((m, i) => {
          const mine = m.senderId === me;
          const showSender =
            conversation.type === "group" && !mine &&
            messages[i - 1]?.senderId !== m.senderId;
          const isLastMine = mine && i === messages.length - 1;
          return (
            <div key={m.id} className={`mv-msg${mine ? " mine" : ""}`}>
              {showSender && <span className="mv-msg-sender">{nameOf(m.senderId)}</span>}
              <div className={`mv-bubble${m.attachment ? " has-att" : ""}`}>
                {m.attachment && <AttachmentView att={m.attachment} />}
                {m.text && <span className="mv-bubble-text">{m.text}</span>}
                <span className="mv-bubble-time">{timeLabel(m.createdAt)}</span>
              </div>
              {isLastMine && (
                <span className="mv-receipt">{lastMineReadBy ? "Read" : "Sent"}</span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {typingUids.length > 0 && (
        <div className="mv-typing">
          {conversation.type === "group"
            ? `${typingUids.map(nameOf).join(", ")} ${typingUids.length === 1 ? "is" : "are"} typing`
            : "typing"}
          <span className="mv-typing-dots">
            <i /><i /><i />
          </span>
        </div>
      )}

      {upload && (
        <div className="mv-upload">
          <span>
            Uploading {upload.name} · {upload.pct}%
          </span>
          <div className="mv-upload-bar">
            <span style={{ width: `${upload.pct}%` }} />
          </div>
        </div>
      )}

      <form className="mv-t-input" onSubmit={send}>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={onPickFile}
          accept="image/*,audio/*,video/*,application/*,text/*"
        />
        <button
          type="button"
          className="mv-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!upload}
          aria-label="Attach file"
        >
          📎
        </button>
        <input
          type="text"
          placeholder="Message…"
          value={text}
          onChange={(e) => publishTyping(e.target.value)}
          maxLength={4000}
        />
        <button
          type="button"
          className={`mv-icon-btn${recording ? " rec" : ""}`}
          onClick={toggleRecording}
          disabled={!!upload}
          aria-label={recording ? "Stop recording" : "Record voice note"}
        >
          {recording ? "■" : "🎤"}
        </button>
        <button type="submit" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  );
}

type NewMode = "direct" | "group" | "broadcast";

function NewConversation({
  me,
  dir,
  isAdmin,
  onClose,
  onDirect,
  onGroup,
  onBroadcast,
}: {
  me: string;
  dir: Record<string, DirectoryUser>;
  isAdmin: boolean;
  onClose: () => void;
  onDirect: (uid: string) => void;
  onGroup: (title: string, memberIds: string[]) => void;
  onBroadcast: (text: string, recipientUids: string[]) => void;
}) {
  const others = Object.values(dir).filter((u) => u.uid !== me);
  const [mode, setMode] = useState<NewMode>("direct");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const multi = mode !== "direct";

  const toggle = (uid: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });

  const modes: NewMode[] = isAdmin
    ? ["direct", "group", "broadcast"]
    : ["direct", "group"];

  return (
    <div className="mv-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mv-modal-card">
        <div className="mv-modal-head">
          <span>
            {mode === "direct" ? "New message" : mode === "group" ? "New group" : "New broadcast"}
          </span>
          <div className="mv-seg">
            {modes.map((m) => (
              <button
                key={m}
                className={mode === m ? "on" : ""}
                onClick={() => {
                  setMode(m);
                  setPicked(new Set());
                }}
              >
                {m === "direct" ? "Direct" : m === "group" ? "Group" : "Broadcast"}
              </button>
            ))}
          </div>
        </div>

        {mode === "group" && (
          <input
            className="mv-modal-title"
            placeholder="Group name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
        {mode === "broadcast" && (
          <>
            <textarea
              className="mv-modal-textarea"
              placeholder="Broadcast message — each recipient gets it privately"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={4000}
            />
            <div className="mv-modal-hint">
              Recipients won’t see each other or each other’s replies.
            </div>
          </>
        )}

        <ul className="mv-picker">
          {others.length === 0 && <li className="mv-empty">No one else in your org yet.</li>}
          {others.map((u) => (
            <li key={u.uid}>
              <button
                className={multi && picked.has(u.uid) ? "picked" : ""}
                onClick={() => (multi ? toggle(u.uid) : onDirect(u.uid))}
              >
                <span className="mv-avatar sm" aria-hidden>
                  {(u.displayName || u.email).charAt(0).toUpperCase()}
                </span>
                <span>{u.displayName || u.email}</span>
                {multi && picked.has(u.uid) && <span className="mv-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>

        {mode === "group" && (
          <button
            className="mv-modal-create"
            disabled={title.trim().length < 2 || picked.size === 0}
            onClick={() => onGroup(title, [...picked])}
          >
            Create group
          </button>
        )}
        {mode === "broadcast" && (
          <button
            className="mv-modal-create"
            disabled={text.trim().length < 1 || picked.size === 0}
            onClick={() => onBroadcast(text, [...picked])}
          >
            Send to {picked.size || ""} {picked.size === 1 ? "person" : "people"}
          </button>
        )}
      </div>
    </div>
  );
}

const css = `
  .mv{display:flex;height:calc(100dvh - var(--top-header-h,56px) - var(--bottom-nav-h,160px) - 40px);
    max-width:960px;margin:0 auto;border:1.5px solid #2a2a2a;border-radius:8px;overflow:hidden;
    font-family:'Saira',sans-serif;color:#F2F2F2;background:#050505}
  .mv-list{width:320px;flex:none;border-right:1.5px solid #2a2a2a;display:flex;flex-direction:column;min-height:0}
  .mv-list-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
  .mv-list-head h1{font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .mv-new{background:#F5852A;border:none;border-radius:5px;color:#1a1103;font-family:'Rajdhani',sans-serif;
    font-weight:700;letter-spacing:1px;font-size:13px;padding:6px 12px;cursor:pointer;text-transform:uppercase}
  .mv-list ul{list-style:none;margin:0;padding:0;overflow-y:auto;flex:1;min-height:0}
  .mv-conv{width:100%;display:flex;align-items:center;gap:11px;padding:11px 14px;background:none;border:none;
    border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;text-align:left;color:inherit;font-family:inherit}
  .mv-conv:hover{background:rgba(255,255,255,.03)}
  .mv-conv.on{background:linear-gradient(90deg,rgba(90,46,8,.5),rgba(24,14,5,.25)),#080808}
  .mv-avatar{width:40px;height:40px;flex:none;border-radius:50%;background:#242424;border:1.5px solid #555;
    display:grid;place-items:center;font-weight:700;color:#cfcfcf}
  .mv-avatar.sm{width:32px;height:32px;font-size:13px}
  .mv-conv-main{flex:1;min-width:0}
  .mv-conv-top{display:flex;justify-content:space-between;gap:8px}
  .mv-conv-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mv-conv-time{font-size:11px;color:#7C7C7C;flex:none}
  .mv-conv-sub{display:block;font-size:13px;color:#7C7C7C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
  .mv-dot{width:9px;height:9px;border-radius:50%;background:#F5852A;flex:none}

  .mv-pane{flex:1;min-width:0;display:flex;flex-direction:column}
  .mv-pane-empty,.mv-empty,.mv-nostate{color:#7C7C7C;font-size:14px}
  .mv-pane-empty{margin:auto}
  .mv-empty{padding:24px;text-align:center}

  .mv-t{display:flex;flex-direction:column;height:100%;min-height:0}
  .mv-t-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
  .mv-back{display:none;background:none;border:none;color:#F0842E;font-size:26px;line-height:1;cursor:pointer}
  .mv-t-title{font-size:16px;font-weight:700;letter-spacing:1px}
  .mv-t-count{font-size:12px;color:#7C7C7C;margin-left:auto}
  .mv-presence{width:9px;height:9px;border-radius:50%;flex:none}
  .mv-presence.on{background:#31c07a;box-shadow:0 0 6px rgba(49,192,122,.7)}
  .mv-presence.off{background:#555}
  .mv-typing{display:flex;align-items:center;gap:6px;padding:2px 16px 6px;font-size:12px;color:#F0842E;font-style:italic}
  .mv-typing-dots{display:inline-flex;gap:3px}
  .mv-typing-dots i{width:5px;height:5px;border-radius:50%;background:#F0842E;opacity:.4;
    animation:mv-typing 1.2s infinite}
  .mv-typing-dots i:nth-child(2){animation-delay:.2s}
  .mv-typing-dots i:nth-child(3){animation-delay:.4s}
  @keyframes mv-typing{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
  .mv-t-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;min-height:0}
  .mv-msg{display:flex;flex-direction:column;align-items:flex-start;max-width:78%}
  .mv-msg.mine{align-self:flex-end;align-items:flex-end}
  .mv-msg-sender{font-size:11px;color:#F0842E;margin:0 0 2px 4px;font-weight:600}
  .mv-bubble{background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:8px 12px;display:flex;
    align-items:flex-end;gap:8px;flex-wrap:wrap}
  .mv-msg.mine .mv-bubble{background:linear-gradient(180deg,#7a3f0f,#5a2e08);border-color:#F5852A}
  .mv-bubble-text{font-size:14px;line-height:1.35;white-space:pre-wrap;word-break:break-word}
  .mv-bubble-time{font-size:10px;color:#a89988;flex:none}
  .mv-msg.mine .mv-bubble-time{color:#e8c9a8}
  .mv-receipt{font-size:10px;color:#8C8C8C;margin:2px 4px 0}
  .mv-bubble.has-att{flex-direction:column;align-items:stretch;padding:6px}
  .mv-att-img{display:block;max-width:240px}
  .mv-att-img img{width:100%;height:auto;border-radius:8px;display:block}
  .mv-att-audio{width:230px;height:38px;margin:2px 0}
  .mv-att-file{display:flex;align-items:center;gap:10px;padding:8px 10px;min-width:180px;text-decoration:none;color:inherit}
  .mv-att-ic{font-size:22px}
  .mv-att-meta{display:flex;flex-direction:column;min-width:0}
  .mv-att-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
  .mv-att-size{font-size:11px;color:#a89988}
  .mv-att-img+.mv-bubble-text,.mv-att-file+.mv-bubble-text,.mv-att-audio+.mv-bubble-text{margin-top:5px}

  .mv-upload{padding:6px 14px}
  .mv-upload span{font-size:12px;color:#F0842E}
  .mv-upload-bar{height:4px;background:#2a2a2a;border-radius:2px;margin-top:4px;overflow:hidden}
  .mv-upload-bar>span{display:block;height:100%;background:#F5852A;transition:width .15s ease}

  .mv-icon-btn{width:42px;height:42px;flex:none;border:1.5px solid #333;border-radius:50%;background:#0c0c0c;
    color:#cfcfcf;font-size:17px;cursor:pointer;display:grid;place-items:center;padding:0}
  .mv-icon-btn:hover:not(:disabled){border-color:#F5852A}
  .mv-icon-btn:disabled{opacity:.5}
  .mv-icon-btn.rec{border-color:#ff5a3c;color:#ff5a3c;animation:mv-rec 1s infinite}
  @keyframes mv-rec{50%{background:rgba(255,90,60,.18)}}
  .mv-t-input{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(255,255,255,.08)}
  .mv-t-input input{flex:1;height:42px;padding:0 14px;background:#0c0c0c;border:1.5px solid #333;border-radius:22px;
    color:#F2F2F2;font-family:inherit;font-size:14px;outline:none}
  .mv-t-input input:focus{border-color:#F5852A}
  .mv-t-input button{height:42px;padding:0 20px;border:none;border-radius:22px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .mv-t-input button:disabled{opacity:.5}

  .mv-error{margin:8px 12px;padding:8px 10px;border-radius:5px;font-size:12px;
    background:rgba(255,90,60,.08);border:1px solid rgba(255,90,60,.4);color:#ff9c7a}

  .mv-nostate{display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;gap:8px;padding:20px}
  .mv-nostate-title{font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F2F2F2;margin:0}
  .mv-nostate-sub{max-width:320px;line-height:1.5;margin:0}

  .mv-modal{position:fixed;inset:0;z-index:150;background:rgba(4,4,6,.6);backdrop-filter:blur(8px);
    display:grid;place-items:center;padding:20px}
  .mv-modal-card{width:100%;max-width:400px;background:#0b0b0b;border:2px solid #F5852A;border-radius:8px;
    max-height:80vh;display:flex;flex-direction:column;overflow:hidden}
  .mv-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;
    border-bottom:1px solid rgba(255,255,255,.08);font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:14px}
  .mv-seg{display:flex;gap:0;border:1px solid #4A4A4A;border-radius:5px;overflow:hidden}
  .mv-seg button{background:none;border:none;color:#8C8C8C;font-family:inherit;font-size:11px;
    padding:5px 9px;cursor:pointer;text-transform:none;letter-spacing:0;border-right:1px solid #4A4A4A}
  .mv-seg button:last-child{border-right:none}
  .mv-seg button.on{background:#F5852A;color:#1a1103;font-weight:700}
  .mv-modal-textarea{margin:12px 16px 0;padding:10px 12px;background:#0c0c0c;border:1.5px solid #333;
    border-radius:5px;color:#F2F2F2;font-family:inherit;font-size:14px;outline:none;resize:vertical}
  .mv-modal-textarea:focus{border-color:#F5852A}
  .mv-modal-hint{margin:6px 16px 0;font-size:11px;color:#7C7C7C}
  .mv-modal-title{margin:12px 16px 0;height:40px;padding:0 12px;background:#0c0c0c;border:1.5px solid #333;
    border-radius:5px;color:#F2F2F2;font-family:inherit;font-size:14px;outline:none}
  .mv-modal-title:focus{border-color:#F5852A}
  .mv-picker{list-style:none;margin:8px 0;padding:0;overflow-y:auto;flex:1}
  .mv-picker button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 16px;background:none;border:none;
    color:#F2F2F2;font-family:inherit;font-size:14px;cursor:pointer;text-align:left}
  .mv-picker button:hover,.mv-picker button.picked{background:rgba(245,133,42,.12)}
  .mv-check{margin-left:auto;color:#F5852A;font-weight:700}
  .mv-modal-create{margin:8px 16px 16px;height:42px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .mv-modal-create:disabled{opacity:.5}

  @media (max-width:720px){
    .mv-list{width:100%}
    .mv-pane{display:none}
    .mv-thread-open .mv-list{display:none}
    .mv-thread-open .mv-pane{display:flex}
    .mv-back{display:block}
  }
`;
