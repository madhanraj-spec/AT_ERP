import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MerchandiserDashboard from './pages/Merchandiser/Dashboard';
import CreateOrder from './pages/Merchandiser/CreateOrder';
import OrdersManagement from './pages/Orders/Management';
import GreigeYarnDashboard from './pages/GreigeYarn/Dashboard';
import ReceiptsList from './pages/GreigeYarn/ReceiptsList';
import ReceiptForm from './pages/GreigeYarn/ReceiptForm';
import StockManagement from './pages/GreigeYarn/StockManagement';
import MovementTracking from './pages/GreigeYarn/MovementTracking';
import DeliveriesList from './pages/GreigeYarn/DeliveriesList';
import DeliverYarn from './pages/GreigeYarn/DeliverYarn';
import NewDelivery from './pages/GreigeYarn/NewDelivery';
import AdminApprovals from './pages/Admin/Approvals';
import AdminFinances from './pages/Admin/Finances';
import ProductionBoard from './pages/Production/Board';
import WarpingOrderForms from './pages/Production/WarpingOrderForms';
import CreateWarpingOrderForm from './pages/Production/CreateWarpingOrderForm';
import SizingOrderForms from './pages/Production/SizingOrderForms';
import WarpingSizing from './pages/Production/WarpingSizing';
import WeavingOrderForms from './pages/Production/WeavingOrderForms';
import FabricInput from './pages/Production/FabricInput';
import FabricCut from './pages/Production/FabricCut'; // Import the new FabricCut component
import MastersDashboard from './pages/Masters/Dashboard';
import MasterDetail from './pages/Masters/MasterDetail';
import UserManagement from './pages/Admin/UserManagement';
import DyeingFormsList from './pages/Merchandiser/DyeingFormsList';
import CreateDyeingForm from './pages/Merchandiser/CreateDyeingForm';
import DyeingFormView from './pages/Merchandiser/DyeingFormView';
import DyedYarnDashboard from './pages/DyedYarn/Dashboard';
import ReceiveYarn from './pages/DyedYarn/ReceiveYarn';
import DeliverDyedYarn from './pages/DyedYarn/DeliverYarn';
import DyedYarnMovement from './pages/DyedYarn/MovementLog';
import DyedYarnOrders from './pages/DyedYarn/OrderStock';
import StockInventory from './pages/DyedYarn/StockInventory';
import AllotToRedyeing from './pages/DyedYarn/Redyeing';
import FourPointInspection from './pages/Inspection/FourPointInspection';
import UnwashedInspection from './pages/Inspection/UnwashedInspection';
import WashedInspection from './pages/Inspection/WashedInspection';
import InspectionReport from './pages/Inspection/InspectionReport';
import ProcessingModule from './pages/Processing/ProcessingModule';
import DispatchModule from './pages/Dispatch/DispatchModule';
import { Loader } from 'lucide-react';
import EwayBillDashboard from './pages/EwayBill/EwayBillDashboard';

function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted-current)' }}>Loading your portal...</p>
      </div>
    );
  }

  return (
    <>
      {session && profile ? (
        <AppLayout user={profile}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              profile?.role === 'merchandiser' ?
                <Navigate to="/merchandiser/orders" replace /> :
                profile?.role === 'yarn' ?
                  <Navigate to="/greige-yarn" replace /> :
                  <Dashboard user={profile} />
            } />

            {/* Merchandiser Routes */}
            <Route path="/merchandiser">
              <Route index element={<Navigate to="/merchandiser/orders" replace />} />
              <Route path="orders" element={<OrdersManagement />} />
              <Route path="create-order" element={<CreateOrder />} />
              <Route path="edit-order/:id" element={<CreateOrder />} />
              <Route path="dyeing-forms" element={<DyeingFormsList />} />
              <Route path="create-dyeing-form" element={<CreateDyeingForm />} />
              <Route path="dyeing-forms/:id" element={<DyeingFormView />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin">
              <Route path="orders" element={<OrdersManagement />} />
              <Route path="create-order" element={<CreateOrder />} />
              <Route path="edit-order/:id" element={<CreateOrder />} />
              <Route path="dyeing-forms" element={<DyeingFormsList />} />
              <Route path="create-dyeing-form" element={<CreateDyeingForm />} />
              <Route path="dyeing-forms/:id" element={<DyeingFormView />} />
              <Route path="approvals" element={<AdminApprovals />} />
              <Route path="finances" element={<AdminFinances />} />
              <Route path="users" element={<UserManagement />} />
            </Route>

            {/* Inventory Routes */}
            <Route path="/greige-yarn">
              <Route index element={<GreigeYarnDashboard />} />
              <Route path="receipts" element={<ReceiptsList />} />
              <Route path="receipt" element={<ReceiptForm />} />
              <Route path="stock" element={<StockManagement />} />
              <Route path="movement" element={<MovementTracking />} />
              <Route path="deliveries" element={<DeliveriesList />} />
              <Route path="deliveries/:id" element={<DeliverYarn />} />
              <Route path="new-delivery" element={<NewDelivery />} />
              {/* DOF view accessible from greige yarn context */}
              <Route path="dof-view/:id" element={<DyeingFormView />} />
            </Route>
            <Route path="/dyed-yarn" element={<DyedYarnDashboard />} />
            <Route path="/dyed-yarn/receive" element={<ReceiveYarn />} />
            <Route path="/dyed-yarn/deliver" element={<DeliverDyedYarn />} />
            <Route path="/dyed-yarn/movement" element={<DyedYarnMovement />} />
            <Route path="/dyed-yarn/orders" element={<OrdersManagement hideNewOrderButton={true} showAllMerchandisers={true} backPath="/dyed-yarn" />} />
            <Route path="/dyed-yarn/inventory" element={<StockInventory />} />
            <Route path="/dyed-yarn/redyeing" element={<AllotToRedyeing />} />

            {/* Production Routes */}
            <Route path="/production">
              <Route index element={<ProductionBoard />} />
              <Route path="warping-forms" element={<WarpingOrderForms />} />
              <Route path="warping-forms/new" element={<CreateWarpingOrderForm />} />
              <Route path="sizing-forms" element={<SizingOrderForms />} />
              <Route path="weaving-forms" element={<WeavingOrderForms />} />
              <Route path="fabric-input" element={<FabricInput />} />
              <Route path="fabric-movement" element={<FabricInput defaultView="fabric_movement" />} />
              <Route path="fabric-cut" element={<FabricCut />} /> {/* New route for Fabric Cut */}
            </Route>
            <Route path="/warping-sizing">
              <Route index element={<WarpingSizing />} />
            </Route>
            <Route path="/weaving">
              <Route index element={<WeavingOrderForms />} />
            </Route>
            <Route path="/inspection">
              <Route path="four-point" element={<FourPointInspection />} />
              <Route path="unwashed" element={<UnwashedInspection />} />
              <Route path="washed" element={<WashedInspection />} />
              <Route path="report" element={<InspectionReport />} />
            </Route>
            <Route path="/processing" element={<ProcessingModule />} />
            <Route path="/dispatch" element={<DispatchModule />} />
            <Route path="/eway-bill" element={<EwayBillDashboard />} />
            {/* Masters Routing */}
            <Route path="/masters">
              <Route index element={<MastersDashboard />} />
              <Route path=":type" element={<MasterDetail />} />
            </Route>

            {/* Catch All */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppLayout>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <div style={{ fontSize: '3rem' }}>🚧</div>
      <h2 style={{ color: 'var(--color-primary)' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted-current)' }}>This module is under development. Coming soon!</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
