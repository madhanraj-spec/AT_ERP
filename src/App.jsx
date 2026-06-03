import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Login from './pages/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import OrderList from './pages/merch/OrderList';
import CreateOrder from './pages/merch/CreateOrder';
import OrderDetails from './pages/merch/OrderDetails';
import CreateDyeingOrder from './pages/merch/CreateDyeingOrder';
import AdminDashboard from './pages/admin/Dashboard';
import HomeRouter from './components/HomeRouter';
import GreigeInventory from './pages/yarn/GreigeInventory';
import TransferYarn from './pages/yarn/TransferYarn';
import DyedYarnStock from './pages/dyeing/DyedYarnStock';
import OperationsDashboard from './pages/ops/OperationsDashboard';
import InspectionDashboard from './pages/inspection/InspectionDashboard';
import FinanceDashboard from './pages/finance/FinanceDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Dashboard / Home */}
            <Route path="/" element={<HomeRouter />} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />

            {/* Merchandiser Routes */}
            <Route path="/merch/orders" element={<OrderList />} />
            <Route path="/merch/orders/new" element={<CreateOrder />} />
            <Route path="/merch/orders/:id" element={<OrderDetails />} />
            <Route path="/merch/orders/:orderId/items/:itemId/dyeing/new" element={<CreateDyeingOrder />} />

            {/* Greige Yarn Routes */}
            <Route path="/yarn/greige" element={<GreigeInventory />} />
            <Route path="/yarn/transfer" element={<TransferYarn />} />

            {/* Dyeing Routes */}
            <Route path="/dyeing" element={<DyedYarnStock />} />

            {/* Operations Routes */}
            <Route path="/ops" element={<OperationsDashboard />} />

            {/* Inspection Routes */}
            <Route path="/inspection" element={<InspectionDashboard />} />

            {/* Finance Routes */}
            <Route path="/finance" element={<FinanceDashboard />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
