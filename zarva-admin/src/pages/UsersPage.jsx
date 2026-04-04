import { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function UsersPage() {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/admin/users');
        setRowData(response.data.users);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleApproveKYC = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve-kyc`);
      setRowData(prev => prev.map(user => 
        user.id === userId ? { ...user, kyc_status: 'approved' } : user
      ));
    } catch (error) {
      console.error('Failed to approve KYC:', error);
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 90, sortable: true },
    { field: 'name', headerName: 'Name', flex: 1, filter: true },
    { field: 'phone', headerName: 'Phone', filter: true },
    { field: 'role', headerName: 'Role', width: 120, filter: true },
    { 
      field: 'kyc_status', 
      headerName: 'KYC', 
      width: 130,
      cellRenderer: (params) => {
        const status = params.value;
        if (!status) return '-';
        return <Badge variant={status === 'approved' ? 'default' : 'destructive'}>{status.toUpperCase()}</Badge>;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      cellRenderer: (params) => {
        if (params.data.role === 'worker' && params.data.kyc_status !== 'approved') {
          return <Button size="sm" onClick={() => handleApproveKYC(params.data.id)}>Approve KYC</Button>;
        }
        return null;
      }
    }
  ], []);

  return (
    <div className="p-6 h-screen flex flex-col">
      <h1 className="text-3xl font-bold tracking-tight mb-6">User Management</h1>
      <div className="ag-theme-alpine w-full flex-grow">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={50}
          loading={loading}
        />
      </div>
    </div>
  );
}
