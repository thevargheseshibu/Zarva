import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Save, Loader2, Check, AlertCircle, Database } from 'lucide-react';

/**
 * EntityEditorDrawer — God-Mode dynamic entity editor.
 *
 * Fetches ALL columns of a record from any whitelisted table,
 * renders editable fields based on data type inference,
 * and PATCHes only modified fields back to the server.
 *
 * @param {{ tableName: string, entityId: number|string, onClose: () => void, onSave?: () => void }} props
 */
export default function EntityEditorDrawer({ tableName, entityId, onClose, onSave }) {
  const [entity, setEntity] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [error, setError] = useState('');

  // ── Fetch entity data ─────────────────────────────────
  useEffect(() => {
    if (!tableName || !entityId) return;
    setLoading(true);
    setSaveStatus(null);

    api.get(`/admin/tables/${tableName}/${entityId}`)
      .then(res => {
        setEntity(res.data.entity);
        setOriginal(JSON.parse(JSON.stringify(res.data.entity)));
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to fetch entity');
        setLoading(false);
      });
  }, [tableName, entityId]);

  // ── Handle field changes ──────────────────────────────
  const handleChange = useCallback((key, value) => {
    setEntity(prev => ({ ...prev, [key]: value }));
    setSaveStatus(null);
  }, []);

  // ── Save only modified fields ─────────────────────────
  const handleSave = async () => {
    if (!entity || !original) return;

    // Diff: only send changed fields
    const diff = {};
    for (const [key, val] of Object.entries(entity)) {
      if (JSON.stringify(val) !== JSON.stringify(original[key])) {
        diff[key] = val;
      }
    }

    if (Object.keys(diff).length === 0) {
      setSaveStatus('success');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/admin/tables/${tableName}/${entityId}`, diff);
      setOriginal(JSON.parse(JSON.stringify(entity)));
      setSaveStatus('success');
      onSave?.();
    } catch (err) {
      setSaveStatus('error');
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Infer input type from value ───────────────────────
  const renderField = (key, value) => {
    // Read-only fields
    const readOnly = ['id', 'user_id', 'created_at', 'updated_at'].includes(key);
    const isModified = original && JSON.stringify(value) !== JSON.stringify(original[key]);

    // Boolean → switch-style toggle
    if (typeof value === 'boolean') {
      return (
        <button
          onClick={() => !readOnly && handleChange(key, !value)}
          disabled={readOnly}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value ? 'bg-emerald-500' : 'bg-zinc-700'
          } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      );
    }

    // JSON / Object → textarea
    if (typeof value === 'object' && value !== null) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          readOnly={readOnly}
          onChange={(e) => {
            try {
              handleChange(key, JSON.parse(e.target.value));
            } catch { /* ignore invalid JSON while typing */ }
          }}
          className={`h-20 w-full resize-y rounded-md border bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-200 outline-none transition-colors
            ${readOnly ? 'border-zinc-800 text-zinc-500' : 'border-zinc-700 focus:border-purple-500/50'}
            ${isModified ? 'border-amber-500/50' : ''}`}
        />
      );
    }

    // Number
    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          readOnly={readOnly}
          onChange={(e) => handleChange(key, Number(e.target.value))}
          className={`h-9 w-full rounded-md border bg-zinc-800 px-3 text-sm text-zinc-200 outline-none transition-colors
            ${readOnly ? 'border-zinc-800 text-zinc-500' : 'border-zinc-700 focus:border-purple-500/50'}
            ${isModified ? 'border-amber-500/50' : ''}`}
        />
      );
    }

    // Long text → textarea
    const strVal = value?.toString() || '';
    if (strVal.length > 100) {
      return (
        <textarea
          value={strVal}
          readOnly={readOnly}
          onChange={(e) => handleChange(key, e.target.value)}
          rows={3}
          className={`w-full resize-y rounded-md border bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors
            ${readOnly ? 'border-zinc-800 text-zinc-500' : 'border-zinc-700 focus:border-purple-500/50'}
            ${isModified ? 'border-amber-500/50' : ''}`}
        />
      );
    }

    // Default → text input
    return (
      <input
        type="text"
        value={value ?? ''}
        readOnly={readOnly}
        onChange={(e) => handleChange(key, e.target.value === '' ? null : e.target.value)}
        className={`h-9 w-full rounded-md border bg-zinc-800 px-3 text-sm text-zinc-200 outline-none transition-colors
          ${readOnly ? 'border-zinc-800 text-zinc-500' : 'border-zinc-700 focus:border-purple-500/50'}
          ${isModified ? 'border-amber-500/50' : ''}`}
      />
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
              <Database className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Entity Editor</h2>
              <p className="text-xs text-zinc-500">
                <span className="font-mono text-purple-400">{tableName}</span>
                <span className="mx-1">→</span>
                <span className="font-mono text-zinc-400">#{entityId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          )}

          {!loading && error && !entity && (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && entity && (
            <div className="space-y-3">
              {Object.entries(entity).map(([key, value]) => {
                const isModified = original && JSON.stringify(value) !== JSON.stringify(original[key]);
                return (
                  <div key={key} className="group">
                    <div className="mb-1 flex items-center gap-2">
                      <label className="font-mono text-[11px] font-medium text-zinc-500">{key}</label>
                      {isModified && (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-400">
                          MODIFIED
                        </Badge>
                      )}
                    </div>
                    {renderField(key, value)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {entity && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <div>
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Changes saved & audited
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="h-9 text-xs">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="h-9 gap-2 text-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
