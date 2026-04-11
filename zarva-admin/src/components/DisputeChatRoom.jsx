import { useState, useEffect, useRef } from 'react';
import useChatStore from '../stores/useChatStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send, Paperclip, Lock, MessageSquare,
  Loader2, WifiOff, Shield
} from 'lucide-react';

/**
 * DisputeChatRoom — Real-time chat panel for a single dispute.
 *
 * Features:
 *   - Auto-scroll on new messages
 *   - Internal notes rendered with amber/lock styling
 *   - Bubble differentiation by sender_role
 *   - Internal Note toggle for admins
 *   - Typing indicator
 */
export default function DisputeChatRoom({ disputeId }) {
  const {
    connected, messages, typingUser,
    joinRoom, sendMessage, sendTyping,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  // ── Join room when disputeId changes ─────────────────
  useEffect(() => {
    if (disputeId && connected) {
      joinRoom(disputeId);
    }
  }, [disputeId, connected, joinRoom]);

  // ── Auto-scroll to bottom ────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handle send ──────────────────────────────────────
  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    sendMessage({
      content: trimmed,
      isInternalNote,
    });
    setInput('');
  };

  // ── Handle typing indicator ──────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(), 300);
  };

  // ── Handle enter key ─────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!disputeId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
        <MessageSquare className="mb-3 h-10 w-10 text-zinc-700" />
        <p className="text-sm">Select a dispute to open the chat</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Dispute #{disputeId}</span>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Connected
            </Badge>
          ) : (
            <Badge className="border-red-500/20 bg-red-500/10 text-red-400">
              <WifiOff className="mr-1 h-3 w-3" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-xs">No messages yet — start the conversation</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isAdmin = msg.sender_role === 'admin' || msg.sender_role === 'superadmin';
          const isInternal = msg.is_internal_note;

          // ── Internal note (admin whisper) ─────────────────
          if (isInternal) {
            return (
              <div key={msg.id || i} className="flex justify-end">
                <div className="max-w-[75%] rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      Internal Note
                    </span>
                    <span className="text-[10px] text-amber-400/60">• {msg.sender_name || 'Admin'}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-amber-200">{msg.content}</p>
                  <p className="mt-1 text-right text-[10px] text-amber-400/40">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            );
          }

          // ── Admin message ─────────────────────────────────
          if (isAdmin) {
            return (
              <div key={msg.id || i} className="flex justify-end">
                <div className="max-w-[75%] rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-2">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-purple-300">
                      {msg.sender_name || 'Admin'}
                    </span>
                    <Badge className="border-purple-500/20 bg-purple-500/10 text-[8px] text-purple-400">ADMIN</Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-200">{msg.content}</p>
                  <p className="mt-1 text-right text-[10px] text-zinc-500">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            );
          }

          // ── Customer / Worker message ─────────────────────
          const isCustomer = msg.sender_role === 'customer';
          return (
            <div key={msg.id || i} className="flex justify-start">
              <div className={`max-w-[75%] rounded-lg border px-3 py-2 ${
                isCustomer
                  ? 'border-blue-500/20 bg-blue-500/10'
                  : 'border-emerald-500/20 bg-emerald-500/10'
              }`}>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold ${isCustomer ? 'text-blue-300' : 'text-emerald-300'}`}>
                    {msg.sender_name || (isCustomer ? 'Customer' : 'Worker')}
                  </span>
                  <Badge className={`text-[8px] ${
                    isCustomer
                      ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {msg.sender_role?.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-zinc-200">{msg.content}</p>
                {msg.attachment_url && (
                  <a href={msg.attachment_url} target="_blank" rel="noreferrer"
                    className="mt-1 inline-block text-xs text-blue-400 underline">
                    📎 Attachment
                  </a>
                )}
                <p className="mt-1 text-right text-[10px] text-zinc-500">
                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '300ms' }} />
            </span>
            {typingUser.name} is typing...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 px-4 py-3">
        {/* Internal note toggle */}
        <div className="mb-2 flex items-center gap-3">
          <button
            onClick={() => setIsInternalNote(!isInternalNote)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              isInternalNote
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
            }`}
          >
            <Lock className="h-3 w-3" />
            Internal Note
          </button>
          {isInternalNote && (
            <span className="text-[10px] text-amber-400/70">
              Only admins will see this message
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isInternalNote ? 'Write an internal note...' : 'Type a message...'}
            rows={1}
            className={`flex-1 resize-none rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-colors
              ${isInternalNote
                ? 'border-amber-500/30 focus:border-amber-500/50'
                : 'border-zinc-800 focus:border-purple-500/50'
              }`}
          />

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className={`h-9 w-9 p-0 ${
              isInternalNote ? 'bg-amber-600 hover:bg-amber-500' : ''
            }`}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
