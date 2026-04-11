import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useChatStore from '../stores/useChatStore';
import DisputeChatRoom from '../components/DisputeChatRoom';
import EntityEditorDrawer from '../components/EntityEditorDrawer';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, Clock, User, Wrench,
  MapPin, Eye, Database, Loader2, RefreshCw
} from 'lucide-react';

/**
 * DisputesPage — Split-pane dispute resolution console.
 * Left: Dispute tickets list | Right: Live chat + entity inspector
 */
export default function DisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { connect, connected, disconnect } = useChatStore();

  // ── Fetch disputed jobs ──────────────────────────────
  useEffect(() => {
    fetchDisputes();
  }, []);

  // ── Connect socket on mount ──────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) connect(token);
    return () => disconnect();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      // Fetch actual support tickets instead of jobs
      const res = await api.get('/admin/tickets', {
        params: { limit: 100 },
      });
      
      // Filter out resolved/closed to show only active disputes
      const activeTickets = (res.data.tickets || []).filter(
          t => t.status !== 'resolved' && t.status !== 'closed'
      );
      setDisputes(activeTickets);
    } catch (err) {
      console.error('[DisputesPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':           return 'border-red-500/20 bg-red-500/10 text-red-400';
      case 'admin_replied':  return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
      case 'awaiting_admin': return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
      case 'resolved':       return 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400';
      default:         return 'border-zinc-700 bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="flex h-full gap-0 overflow-hidden rounded-xl border border-zinc-800">
      {/* ── Left Panel: Dispute List ───────────────────── */}
      <div className="flex w-80 flex-none flex-col border-r border-zinc-800 bg-zinc-950/50">
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Active Disputes
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {disputes.length} open case{disputes.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* ⭐ FIX: Add manual refresh button so new incoming tickets load instantly */}
          <button 
            onClick={fetchDisputes} 
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          )}

          {!loading && disputes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <AlertTriangle className="mb-2 h-6 w-6" />
              <p className="text-xs">No active disputes</p>
            </div>
          )}

          {disputes.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className={`w-full border-b border-zinc-800/50 px-4 py-3 text-left transition-colors hover:bg-zinc-900/50 ${
                selected?.id === ticket.id ? 'bg-purple-500/5 border-l-2 border-l-purple-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white">{ticket.ticket_number}</span>
                <Badge className={`text-[9px] ${getStatusColor(ticket.status)}`}>
                  {(ticket.status).toUpperCase()}
                </Badge>
              </div>

              <p className="text-[11px] text-zinc-400 truncate mb-1">
                {ticket.ticket_type === 'job_dispute' ? `Job #${ticket.job_id} • ${ticket.job_category}` : 'General Support Inquiry'}
              </p>

              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {ticket.raised_by_name || `User #${ticket.raised_by_user_id}`}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock className="h-3 w-3" />
                {new Date(ticket.last_activity_at || ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Chat + Actions ───────────────── */}
      <div className="flex flex-1 flex-col bg-zinc-950">
        {selected ? (
          <>
            {/* Ticket context bar */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/30 px-4 py-2">
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>
                  <span className="text-zinc-600">Ticket Type:</span>{' '}
                  <span className="text-emerald-400">{selected.ticket_type}</span>
                </span>
                {selected.job_id && (
                  <span>
                    <span className="text-zinc-600">Linked Job:</span>{' '}
                    <span className="text-white">#{selected.job_id}</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditorOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <Database className="h-3 w-3" />
                Edit Job Record
              </button>
            </div>

            {/* Chat */}
            <DisputeChatRoom disputeId={selected.id} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-zinc-600">
            <AlertTriangle className="mb-3 h-10 w-10 text-zinc-700" />
            <p className="text-sm font-medium">No dispute selected</p>
            <p className="mt-1 text-xs text-zinc-600">Choose a case from the left panel to begin investigation</p>
          </div>
        )}
      </div>

      {/* ── Entity Editor Drawer ────────────────────────── */}
      {editorOpen && selected && (
        <EntityEditorDrawer
          tableName="support_tickets"
          entityId={selected.id}
          onClose={() => setEditorOpen(false)}
          onSave={() => fetchDisputes()}
        />
      )}
    </div>
  );
}
