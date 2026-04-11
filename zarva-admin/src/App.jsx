import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import WorkersPage from './pages/WorkersPage';
import MapPage from './pages/MapPage';
import JobsPage from './pages/JobsPage';
import DisputesPage from './pages/DisputesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/disputes" element={<DisputesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
