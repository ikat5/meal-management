"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

/**
 * GROUP PAGE — three jobs:
 *   1. No group yet  → create-group and join-group forms
 *   2. In a group    → info card (invite code, members, my bazar preference,
 *                      leave button)
 *   3. Group chat    → simple polling chat (refreshes every 5 seconds)
 */
export default function GroupPage() {
  const [me, setMe] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // create / join form state
  const [newName, setNewName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadEverything = useCallback(async () => {
    try {
      const { user } = await api("/api/auth/me");
      setMe(user);
      if (user.groupId) {
        const g = await api("/api/groups/me");
        setGroup(g.group);
      } else {
        setGroup(null);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const { messages } = await api("/api/messages?limit=50");
      setMessages([...messages].reverse()); // API is newest-first; chat reads top-down
    } catch {
      // not in a group / transient error — chat just stays empty
    }
  }, []);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  // Poll chat every 5s while in a group
  useEffect(() => {
    if (!group) return;
    loadMessages();
    const timer = setInterval(loadMessages, 5000);
    return () => clearInterval(timer);
  }, [group, loadMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/groups", { method: "POST", body: { name: newName } });
      await loadEverything();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/groups/join", { method: "POST", body: { inviteCode } });
      await loadEverything();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLeave() {
    if (!confirm("Leave this group? You can rejoin later with the invite code.")) return;
    setError("");
    try {
      await api("/api/groups/leave", { method: "POST" });
      setMessages([]);
      await loadEverything();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText;
    setChatText("");
    try {
      await api("/api/messages", { method: "POST", body: { text } });
      await loadMessages();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handlePreferenceChange(value: number) {
    try {
      await api("/api/auth/me", { method: "PATCH", body: { bazarPreference: value } });
      setMe({ ...me, bazarPreference: value });
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p className="py-10 text-center text-gray-500">Loading…</p>;

  // ── No group: create or join ─────────────────────────────────────────
  if (!group) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Create or join a group</h1>
        {error && <p className="alert-error">{error}</p>}
        <p className="text-sm text-gray-600">
          <strong>Rule:</strong> you can only be in ONE group at a time.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <form onSubmit={handleCreate} className="card space-y-3">
            <h2 className="font-semibold">Create a new group</h2>
            <div>
              <label htmlFor="groupName" className="label">Group name</label>
              <input
                id="groupName"
                required
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Bachelor Mess 2026"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Create group</button>
          </form>

          <form onSubmit={handleJoin} className="card space-y-3">
            <h2 className="font-semibold">Join with invite code</h2>
            <div>
              <label htmlFor="inviteCode" className="label">Invite code</label>
              <input
                id="inviteCode"
                required
                className="input uppercase"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. X7KP2Q"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Join group</button>
          </form>
        </div>
      </div>
    );
  }

  // ── In a group: info + chat ──────────────────────────────────────────
  const isAdmin = group.admin?._id === me?._id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{group.name}</h1>
          <p className="text-sm text-gray-500">Admin: {group.admin?.name}</p>
        </div>
        <button onClick={handleLeave} className="btn-danger">Leave group</button>
      </div>

      {error && <p className="alert-error">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold">Invite code</h2>
            <p className="mt-1 text-sm text-gray-500">
              Share this with friends so they can join:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-lg bg-gray-100 px-4 py-2 text-lg font-bold tracking-widest">
                {group.inviteCode}
              </code>
              <button
                className="btn-ghost"
                onClick={() => navigator.clipboard.writeText(group.inviteCode)}
              >
                Copy
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold">Members ({group.members.length})</h2>
            <ul className="mt-3 divide-y divide-gray-100">
              {group.members.map((m: any) => (
                <li key={m.user._id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {m.user.name}
                      {m.user._id === me?._id && " (you)"}
                    </p>
                    <p className="text-xs text-gray-500">
                      joined {new Date(m.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {m.user._id === group.admin?._id && (
                    <span className="badge">admin</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="font-semibold">My bazar preference</h2>
            <p className="mt-1 text-sm text-gray-500">
              How many consecutive market days do you prefer? Used when the
              {isAdmin ? " " : " admin "}generates the monthly schedule.
            </p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handlePreferenceChange(n)}
                  className={
                    me?.bazarPreference === n ? "btn-primary" : "btn-ghost"
                  }
                >
                  {n} day{n > 1 && "s"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="card flex h-[32rem] flex-col">
          <h2 className="font-semibold">Group chat 💬</h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">
                No messages yet — say hi!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender?._id === me?._id;
              return (
                <div key={msg._id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isMine ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {!isMine && (
                      <p className="text-xs font-semibold text-emerald-700">
                        {msg.sender?.name}
                      </p>
                    )}
                    <p>{msg.text}</p>
                    <p className={`mt-0.5 text-[10px] ${isMine ? "text-emerald-100" : "text-gray-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={handleSend} className="mt-3 flex gap-2">
            <input
              className="input"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type a message…"
              maxLength={1000}
            />
            <button type="submit" className="btn-primary">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
