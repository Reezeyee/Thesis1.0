import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { MessageCircle, Send } from 'lucide-react';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import type { AuthSession } from '../auth/AuthProvider';
import type { OwnerAdminMessageRecord } from '../types/appState';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

/**
 * Direct Admin <-> Owner message thread, shared by both OwnerDashboard and the Admin-side
 * "Owner Messages" module (see App.tsx). Writes straight to the owner_admin_messages collection
 * (never through useFarmData's updateState) because the read-only Owner role cannot write the
 * shared app_state/farm blob at all -- see firestore.rules. There is exactly one Admin and one
 * Owner account in this system, so this is a single shared thread with no conversation picker.
 */
export function OwnerAdminMessaging({ session }: { session: AuthSession }) {
  const [messages, setMessages] = useState<OwnerAdminMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const senderRole = session.role === 'OWNER' ? 'OWNER' : 'ADMINISTRATOR';
  const otherPartyLabel = senderRole === 'OWNER' ? 'Admin' : 'Owner';

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.OWNER_ADMIN_MESSAGES), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ messageId: d.id, ...(d.data() as Omit<OwnerAdminMessageRecord, 'messageId'>) })));
        setLoading(false);
      },
      () => {
        setError('Could not load messages. Confirm firestore.rules has been published.');
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await addDoc(collection(db, COLLECTIONS.OWNER_ADMIN_MESSAGES), {
        senderUid: session.userId,
        senderRole,
        senderName: session.displayName || (senderRole === 'OWNER' ? 'Owner' : 'Admin'),
        body,
        createdAt: new Date().toISOString(),
      });
      setDraft('');
    } catch {
      setError('Could not send that message. Try again.');
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <Card className="flex flex-col h-[560px]">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Messages with {otherPartyLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 pt-4">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading messages…</p>
          ) : grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No messages yet -- send a note to {otherPartyLabel.toLowerCase()} below.
            </p>
          ) : (
            grouped.map((m) => {
              const isMine = m.senderUid === session.userId;
              return (
                <div key={m.messageId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted/70 text-foreground rounded-bl-sm'
                    }`}
                  >
                    {!isMine ? (
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.senderName || otherPartyLabel}</p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {new Date(m.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p className="text-[11px] font-medium text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-2">
            {error}
          </p>
        ) : null}

        <div className="flex items-end gap-2 pt-3 mt-1 border-t border-border/60">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${otherPartyLabel}…`}
            className="min-h-9 h-9 max-h-28 text-xs rounded-xl resize-none"
          />
          <Button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="h-9 rounded-xl px-3 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
