import { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// 1. Decouple Cell Renderers from the main component to prevent stale closures
const StatusCellRenderer = (props) => (
  <Badge variant={props.value ? 'destructive' : 'secondary'}>
    {props.value ? 'BLOCKED' : 'ACTIVE'}
  </Badge>
);

const KycCellRenderer = (props) => {
  const status = props.value;
  if (!status) return <span>-</span>;
  return (
    <Badge variant={status === 'approved' ? 'default' : 'destructive'}>
      {status.toUpperCase()}
    </Badge>
  );
};

const ActionsCellRenderer = (props) => {
  const { data, context } = props;
  if (data.role === 'worker' && data.kyc_status !== 'approved') {
    return (
      <Button size="sm" onClick={() => context.handleApproveKYC(data.id)}>
        Approve KYC
      </Button>
    );
  }
  return null;
};

export default function UsersPage() {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 2. Introduce state for Server-Side Pagination & Search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const gridRef = useRef(null);

  const fetchUsers = useCallback(async (currentPage, searchQuery) => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { page: currentPage, limit: 50, search: searchQuery }
      });
      setRowData(response.data.users);
      setTotalPages(response.data.pages);
      setPage(response.data.page);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync grid with pagination state
  useEffect(() => {
    fetchUsers(page, search);
  }, [page, search, fetchUsers]);

  const handleApproveKYC = useCallback(async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve-kyc`);
      setRowData(prev => prev.map(user => 
        user.id === userId ? { ...user, kyc_status: 'approved', is_verified: true } : user
      ));
    } catch (error) {
      console.error('Failed to approve KYC:', error);
      alert('Network error approving user.');
    }
  }, []);

  const columnDefs = [
    { field: 'id', headerName: 'ID', width: 90, sortable: true },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'phone', headerName: 'Phone' },
    { field: 'role', headerName: 'Role', width: 120 },
    { field: 'is_blocked', headerName: 'Status', width: 120, cellRenderer: StatusCellRenderer },
    { field: 'kyc_status', headerName: 'KYC', width: 130, cellRenderer: KycCellRenderer },
    { field: 'actions', headerName: 'Actions', width: 150, cellRenderer: ActionsCellRenderer }
  ];

  return (
    <div className="p-6 h-screen flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <input 
          type="text" 
          placeholder="Search users..." 
          className="border p-2 rounded-md w-64 shadow-sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset pagination on new search
          }}
        />
      </div>

      <div className="ag-theme-alpine w-full flex-grow">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          context={{ handleApproveKYC }} // Pass callbacks via AG Grid context
          loadingOverlayComponent={() => <span>Loading Data...</span>}
          suppressPaginationPanel={true} // Hide AG Grid client-pagination
        />
      </div>

      {/* Custom Server-Side Pagination Controls */}
      <div className="flex justify-between items-center py-2 bg-white rounded-md">
        <Button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} variant="outline">
          Previous
        </Button>
        <span className="text-sm font-medium">Page {page} of {totalPages || 1}</span>
        <Button disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)} variant="outline">
          Next
        </Button>
      </div>
    </div>
  );
}
