import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, ArrowUpRight, RefreshCw, 
  CheckCircle, XCircle, Eye, AlertTriangle, Lock, Clock, CheckCircle2
} from 'lucide-react';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('payouts'); 
  const [payoutFilter, setPayoutFilter] = useState('processing'); // ⭐ NEW: Sub-filter state
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  const [payouts, setPayouts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [decryptedAccounts, setDecryptedAccounts] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, payoutsRes, paymentsRes] = await Promise.all([
        api.get('/admin/finance/overview'),
        api.get(`/admin/finance/payouts?status=${payoutFilter}`), // ⭐ Uses dynamic filter
        api.get('/admin/finance/payments?limit=50')
      ]);
      setStats(statsRes.data);
      setPayouts(payoutsRes.data.payouts || []);
      setPayments(paymentsRes.data.payments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch automatically when the sub-filter changes
  useEffect(() => { fetchData(); }, [payoutFilter]);

  const revealAccount = async (id) => {
    try {
      const res = await api.get(`/admin/finance/payouts/${id}/bank-details`);
      setDecryptedAccounts(prev => ({ ...prev, [id]: res.data.account_number }));
    } catch (err) {
      alert('Failed to decrypt account number.');
    }
  };

  const processPayout = async (id, action) => {
    const isComplete = action === 'complete';
    const ref = isComplete ? prompt('Enter UTR / Transaction Ref ID (Optional):') : null;
    const reason = !isComplete ? prompt('Enter reason for rejection:') : null;

    if (isComplete && ref === null) return; 
    if (!isComplete && !reason) return; 

    try {
      await api.post(`/admin/finance/payouts/${id}/process`, {
        action,
        transaction_ref: ref || 'MANUAL_TXN',
        failure_reason: reason
      });
      fetchData(); 
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing payout');
    }
  };

  const formatINR = (paise) => `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full overflow-hidden">
      
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Command Center</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage Platform Revenue, Payments, and Worker Payouts</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" /> Platform Revenue
          </div>
          <span className="text-3xl font-bold text-white">{stats ? formatINR(stats.platform_revenue_paise) : '---'}</span>
        </div>
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Lock className="w-4 h-4 text-blue-400" /> Escrow (Held Funds)
          </div>
          <span className="text-3xl font-bold text-white">{stats ? formatINR(stats.escrow_held_paise) : '---'}</span>
        </div>
        <div className="p-5 rounded-xl border border-purple-500/30 bg-purple-500/10 flex flex-col">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <ArrowUpRight className="w-4 h-4" /> Action Required ({stats?.pending_payouts_count || 0})
          </div>
          <span className="text-3xl font-bold text-purple-300">{stats ? formatINR(stats.pending_payouts_paise) : '---'}</span>
        </div>
      </div>

      <div className="flex gap-4 border-b border-zinc-800 mb-6">
        <button 
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 px-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'payouts' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Worker Payouts
        </button>
        <button 
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'payments' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Customer Payments (Inflow)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-10">
        {activeTab === 'payouts' && (
          <div className="flex flex-col gap-4">
            
            {/* ⭐ NEW: Payout Sub-Navigation */}
            <div className="flex gap-2 mb-2">
              <button 
                onClick={() => setPayoutFilter('processing')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${payoutFilter === 'processing' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
              >
                <Clock className="w-3 h-3" /> Processing Queue
              </button>
              <button 
                onClick={() => setPayoutFilter('completed')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${payoutFilter === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
              >
                <CheckCircle2 className="w-3 h-3" /> Settled / Completed
              </button>
            </div>

            {payouts.length === 0 ? (
              <div className="p-12 text-center border border-zinc-800 rounded-xl bg-zinc-900/50 text-zinc-500">No payouts found in this category.</div>
            ) : (
              payouts.map(p => {
                const isRisky = payoutFilter === 'processing' && p.current_available_paise < p.amount_paise; 
                
                return (
                  <div key={p.id} className={`p-5 rounded-xl border ${isRisky ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-white text-lg">{p.worker_name}</h3>
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-sm py-1 px-2">
                            {formatINR(p.amount_paise)}
                          </Badge>
                          {isRisky && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex gap-1 items-center">
                              <AlertTriangle className="w-3 h-3" /> Ledger Discrepancy Risk!
                            </Badge>
                          )}
                          {payoutFilter === 'completed' && (
                             <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">Settled: {new Date(p.processed_at).toLocaleDateString()}</Badge>
                          )}
                        </div>
                        
                        {/* ⭐ FIX: Check payout method and render either UPI or Bank */}
                        {p.payout_method === 'upi' ? (
                            <div className="text-sm text-zinc-400 space-y-1">
                                <p><span className="text-zinc-500">Method:</span> UPI Transfer</p>
                                <p><span className="text-zinc-500">UPI ID:</span> <span className="font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded">{p.upi_id}</span></p>
                                {payoutFilter === 'completed' && p.transaction_ref && (
                                  <p className="mt-2 text-emerald-400/80 font-mono text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> UTR: {p.transaction_ref}</p>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-400 space-y-1">
                                <p><span className="text-zinc-500">Bank:</span> {p.bank_name} ({p.ifsc_code})</p>
                                <p><span className="text-zinc-500">Holder:</span> {p.account_holder_name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-zinc-500">A/C:</span>
                                    <span className="font-mono text-zinc-300 bg-black/50 px-2 py-1 rounded">
                                    {decryptedAccounts[p.id] || '•••• •••• ••••'}
                                    </span>
                                    {!decryptedAccounts[p.id] && (
                                    <button onClick={() => revealAccount(p.id)} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 ml-2">
                                        <Eye className="w-3 h-3" /> Reveal
                                    </button>
                                    )}
                                </div>
                                {payoutFilter === 'completed' && p.transaction_ref && (
                                  <p className="mt-2 text-emerald-400/80 font-mono text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> UTR: {p.transaction_ref}</p>
                                )}
                            </div>
                        )}
                      </div>
                      
                      {/* Only show action buttons if still processing */}
                      {payoutFilter === 'processing' && (
                        <div className="flex flex-col gap-2 min-w-[140px]">
                          <button onClick={() => processPayout(p.id, 'complete')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <CheckCircle className="w-4 h-4" /> Mark Paid
                          </button>
                          <button onClick={() => processPayout(p.id, 'fail')} className="w-full py-2 bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/30 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab Content: Customer Payments ── */}
        {activeTab === 'payments' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-zinc-950/50 text-xs uppercase text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Job ID / Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-zinc-300">{p.customer_name}</td>
                    <td className="px-4 py-3">#{p.job_id} <span className="text-zinc-600 ml-1">({p.type})</span></td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{formatINR(p.amount * 100)}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-zinc-800 text-zinc-300">{p.method?.toUpperCase()}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={p.status === 'captured' ? 'bg-emerald-500/20 text-emerald-400' : p.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                        {p.status?.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
