import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, UserCheck, Database } from 'lucide-react';
import EntityEditorDrawer from '../components/EntityEditorDrawer';

const darkTheme = themeQuartz.withParams({
  backgroundColor: '#18181b',
  headerBackgroundColor: '#111113',
  oddRowBackgroundColor: '#1c1c1f',
  rowHoverColor: '#27272a',
  foregroundColor: '#e4e4e7',
  headerFontSize: 12,
  fontSize: 13,
  borderColor: '#27272a',
  fontFamily: 'Inter, system-ui, sans-serif',
});

// ── Cell Renderers ──────────────────────────

const StatusCellRenderer = ({ value }) => (
  <Badge className={value
    ? 'border-red-500/20 bg-red-500/10 text-red-400'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }>
    {value ? 'BLOCKED' : 'ACTIVE'}
  </Badge>
);

const ActionsCellRenderer = ({ data, context }) => {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10"
        title="God Mode: Edit Customer"
        onClick={() => context.handleEdit(data.id)}
      >
        <Database className="h-4 w-4" />
      </Button>
    </div>
  );
};

// ── Main Component ──────────────────────────

export default function CustomersPage() {
  const [rowData, setRowData]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [search, setSearch]         = useState('');
  const [editorState, setEditorState] = useState({ open: false, id: null });
  const debounceRef                 = useRef(null);
  const gridRef                     = useRef(null);

  const fetchCustomers = useCallback(async (currentPage, searchQuery) => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { page: currentPage, limit: 50, role: 'customer', search: searchQuery }
      });
      setRowData(response.data.users || []);
      setTotalPages(response.data.pages || 1);
      setTotal(response.data.total || 0);
      setPage(response.data.page || 1);
    } catch (error) {
      console.error('[CustomersPage] fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers(page, search);
  }, [page, fetchCustomers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchCustomers(1, val);
    }, 500);
  };

  const columnDefs = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { field: 'created_at', headerName: 'Joined', width: 130,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('en-IN') : '—' },
    { field: 'is_blocked', headerName: 'Status', width: 110, cellRenderer: StatusCellRenderer },
    { field: 'actions', headerName: 'Actions', width: 100, cellRenderer: ActionsCellRenderer },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer Management</h1>
          <p className="text-sm text-zinc-400">{total} customers registered</p>
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

      <div className="flex-1 rounded-xl border border-zinc-800 overflow-hidden">
        <AgGridReact
          ref={gridRef}
          theme={darkTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          context={{ handleEdit: (id) => setEditorState({ open: true, id }) }}
          suppressPaginationPanel={true}
          domLayout="normal"
          rowHeight={44}
          headerHeight={40}
          defaultColDef={{ resizable: true, sortable: false }}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <Button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800">
          ← Previous
        </Button>
        <span className="text-xs font-medium text-zinc-400">
          Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
          <span className="ml-3 text-zinc-500">({total} total)</span>
        </span>
        <Button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} variant="outline"
          className="h-8 border-zinc-700 bg-transparent px-4 text-xs text-zinc-300 hover:bg-zinc-800">
          Next →
        </Button>
      </div>

      {editorState.open && (
        <EntityEditorDrawer
          tableName="users"
          entityId={editorState.id}
          onClose={() => setEditorState({ open: false, id: null })}
          onSave={() => fetchCustomers(page, search)}
        />
      )}
    </div>
  );
}
