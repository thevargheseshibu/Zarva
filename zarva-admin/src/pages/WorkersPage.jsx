import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, UserCheck, Filter } from 'lucide-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// ── Decoupled Cell Renderers (prevents stale closures) ─────────

const StatusCellRenderer = ({ value }) => (
  <Badge className={value
    ? 'border-red-500/20 bg-red-500/10 text-red-400'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }>
    {value ? 'BLOCKED' : 'ACTIVE'}
  </Badge>
);

const OnlineCellRenderer = ({ value }) => (
  <span className="flex items-center gap-2 text-sm">
    <span className={`h-2 w-2 rounded-full ${value ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
    {value ? 'Online' : 'Offline'}
  </span>
);

const KycCellRenderer = ({ value }) => {
  if (!value) return <span className="text-zinc-500">—</span>;
  const colors = {
    approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    pending:  'border-amber-500/20 bg-amber-500/10 text-amber-400',
    rejected: 'border-red-500/20 bg-red-500/10 text-red-400',
  };
  return <Badge className={colors[value] || colors.pending}>{value.toUpperCase()}</Badge>;
};

const RatingCellRenderer = ({ value }) => {
  if (!value) return <span className="text-zinc-500">—</span>;
  const v = parseFloat(value);
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-amber-400">★</span>
      <span className="font-medium text-white">{v.toFixed(1)}</span>
    </span>
  );
};

const ActionsCellRenderer = ({ data, context }) => {
  if (data.role === 'worker' && data.kyc_status && data.kyc_status !== 'approved') {
    return (
      <Button
        size="sm"
        className="h-7 border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
        onClick={() => context.handleApproveKYC(data.id)}
      >
        <UserCheck className="mr-1 h-3 w-3" />
        Approve
      </Button>
    );
  }
  return null;
};

// ── Main Component ─────────────────────────────────────────────

export default function WorkersPage() {
  const [rowData, setRowData]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [search, setSearch]         = useState('');
  const debounceRef                 = useRef(null);
  const gridRef                     = useRef(null);

  const fetchWorkers = useCallback(async (currentPage, searchQuery) => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { page: currentPage, limit: 50, role: 'worker', search: searchQuery }
      });
      setRowData(response.data.users || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
      setPage(response.data.page || 1);
    } catch (error) {
      console.error('[WorkersPage] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers(page, search);
  }, [page, fetchWorkers]);

  // Debounced search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchWorkers(1, val);
    }, 500);
  };

  const handleApproveKYC = useCallback(async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve-kyc`);
      setRowData(prev => prev.map(u =>
        u.id === userId ? { ...u, kyc_status: 'approved', is_verified: true } : u
      ));
    } catch (error) {
      console.error('[WorkersPage] KYC approval error:', error);
    }
  }, []);

  const columnDefs = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'category', headerName: 'Category', width: 130 },
    { field: 'average_rating', headerName: 'Rating', width: 100, cellRenderer: RatingCellRenderer },
    { field: 'total_jobs', headerName: 'Jobs', width: 80 },
    { field: 'is_online', headerName: 'Status', width: 100, cellRenderer: OnlineCellRenderer },
    { field: 'kyc_status', headerName: 'KYC', width: 110, cellRenderer: KycCellRenderer },
    { field: 'is_blocked', headerName: 'Account', width: 100, cellRenderer: StatusCellRenderer },
    { field: 'actions', headerName: '', width: 120, cellRenderer: ActionsCellRenderer },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Worker Management</h1>
          <p className="text-sm text-zinc-400">{total} professionals registered</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            className="h-9 w-72 rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="ag-theme-alpine flex-1 rounded-xl border border-zinc-800 overflow-hidden">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          context={{ handleApproveKYC }}
          suppressPaginationPanel={true}
          domLayout="normal"
          rowHeight={44}
          headerHeight={40}
          defaultColDef={{
            resizable: true,
            sortable: false,
          }}
          overlayLoadingTemplate='<span class="text-zinc-400 text-sm">Loading workers...</span>'
          overlayNoRowsTemplate='<span class="text-zinc-500 text-sm">No workers found</span>'
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <Button
          disabled={page <= 1 || loading}
          onClick={() => setPage(p => p - 1)}
          variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          ← Previous
        </Button>
        <span className="text-xs font-medium text-zinc-400">
          Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
          <span className="ml-3 text-zinc-500">({total} total)</span>
        </span>
        <Button
          disabled={page >= totalPages || loading}
          onClick={() => setPage(p => p + 1)}
          variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
