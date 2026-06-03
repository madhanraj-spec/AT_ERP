import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../pages/admin/Dashboard';

const HomeRouter = () => {
    const { profile } = useAuth();

    if (!profile) return <div>Loading...</div>;

    // Direct specific roles to their main pages if desired, or show a generic dashboard
    // For Admin, show AdminDashboard
    if (profile.role === 'admin') {
        return <AdminDashboard />;
    }

    // For Merchandiser, maybe OrderList? or a Merch Dashboard.
    if (profile.role === 'merchandiser') {
        return <Navigate to="/merch/orders" replace />;
    }

    // For others, show a generic welcome for now
    return (
        <div className="container" style={{ paddingTop: '2rem' }}>
            <h1>Welcome, {profile.full_name}</h1>
            <p>Role: {profile.role}</p>
            <p>Select an option from the sidebar to begin.</p>
        </div>
    );
};

export default HomeRouter;
