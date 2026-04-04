import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// ── Cell Renderers ──────────────────────────

const StatusBadge = ({ value }) => {
  const map = {
    searching:     'border-amber-500/20 bg-amber-500/10 text-amber-400',
    assigned:      'border-blue-500/20 bg-blue-500/10 text-blue-400',
    worker_en_route: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    in_progress:   'border-purple-500/20 bg-purple-500/10 text-purple-400',
    completed:     'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    cancelled:     'border-red-500/20 bg-red-500/10 text-red-400',
    disputed:      'border-red-500/20 bg-red-500/10 text-red-400',
  };
  if (!value) return <span className="text-zinc-500">—</span>;
  return <Badge className={map[value] || map.searching}>{value.replace(/_/g, ' ').toUpperCase()}</Badge>;
};

const AmountCell = ({ value }) => {
  if (!value) return <span className="text-zinc-500">—</span>;
  return <span className="font-medium text-emerald-400">₹{Number(value).toLocaleString('en-IN')}</span>;
};

const DateCell = ({ value }) => {
  if (!value) return <span className="text-zinc-500">—</span>;
  return <span className="text-sm text-zinc-300">{new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>;
};

// ── Main Component ──────────────────────────

export default function JobsPage() {
  const [rowData, setRowData]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debounceRef             = useRef(null);
  const gridRef                 = useRef(null);

  const fetchJobs = useCallback(async (currentPage, searchQuery, status) => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: 50, search: searchQuery };
      if (status) params.status = status;
      const response = await api.get('/admin/jobs', { params });
      setRowData(response.data.jobs || []);
      setPage(response.data.page || 1);
    } catch (error) {
      console.error('[JobsPage] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(page, search, statusFilter);
  }, [page, statusFilter, fetchJobs]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchJobs(1, val, statusFilter);
    }, 500);
  };

  const STATUSES = ['', 'searching', 'assigned', 'worker_en_route', 'in_progress', 'completed', 'cancelled'];

  const columnDefs = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'status', headerName: 'Status', width: 140, cellRenderer: StatusBadge },
    { field: 'category', headerName: 'Category', width: 130 },
    { field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 130 },
    { field: 'worker_name', headerName: 'Worker', flex: 1, minWidth: 130,
      valueFormatter: p => p.value || '—' },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'hourly_rate', headerName: 'Rate', width: 90, cellRenderer: AmountCell },
    { field: 'final_amount', headerName: 'Final', width: 100, cellRenderer: AmountCell },
    { field: 'created_at', headerName: 'Created', width: 110, cellRenderer: DateCell },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Jobs Explorer</h1>
          <p className="text-sm text-zinc-400">Monitor and manage all marketplace jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300 outline-none focus:border-purple-500/50"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search jobs..."
              className="h-9 w-64 rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>
      </div>

      <div className="ag-theme-alpine flex-1 rounded-xl border border-zinc-800 overflow-hidden">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          suppressPaginationPanel={true}
          domLayout="normal"
          rowHeight={44}
          headerHeight={40}
          defaultColDef={{ resizable: true, sortable: false }}
          overlayLoadingTemplate='<span class="text-zinc-400 text-sm">Loading jobs...</span>'
          overlayNoRowsTemplate='<span class="text-zinc-500 text-sm">No jobs found</span>'
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <Button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800">
          ← Previous
        </Button>
        <span className="text-xs font-medium text-zinc-400">Page <span className="text-white">{page}</span></span>
        <Button disabled={loading} onClick={() => setPage(p => p + 1)} variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800">
          Next →
        </Button>
      </div>
    </div>
  );
}
