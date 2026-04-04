import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Shield, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('9746020743');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/dev-login', { phone: `+91${phone}` });
      if (res.data.status === 'ok') {
        const { token, user } = res.data;
        if (user.roles?.includes('admin') || user.active_role === 'admin' || user.roles?.includes('superadmin')) {
          localStorage.setItem('admin_token', token);
          navigate('/');
        } else {
          setError('This account does not have admin privileges.');
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 shadow-lg shadow-purple-500/5">
            <Shield className="h-7 w-7 text-purple-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ZARVA Command Center</h1>
          <p className="mt-1 text-sm text-zinc-500">Admin access only</p>
        </div>

        {/* Form */}
        <form onSubmit={handleDevLogin} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Phone Number</label>
              <div className="flex overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/50 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20">
                <span className="flex items-center border-r border-zinc-700 bg-zinc-800 px-3 text-sm font-medium text-zinc-400">+91</span>
                <input
                  type="text"
                  placeholder="9746020743"
                  className="h-10 w-full bg-transparent px-3 text-sm text-white placeholder-zinc-500 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-purple-600 text-sm font-semibold text-white transition-all hover:bg-purple-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Access Command Center
                </>
              )}
            </button>
          </div>

          <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-zinc-600">
            Development Mode
          </p>
        </form>
      </div>
    </div>
  );
}
