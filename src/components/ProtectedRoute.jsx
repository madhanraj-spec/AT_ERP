import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRoles = [] }) => {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-primary)' }}>
                Loading...
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If roles are specified, check if user has required role
    if (allowedRoles.length > 0 && profile) {
        // Admin always has access to everything (or we can be explicit)
        if (profile.role === 'admin') {
            // admin access
        } else if (!allowedRoles.includes(profile.role)) {
            // Redirect to unauthorized or their home dashboard
            // For now, let's just show a simple unauthorized message or redirect home
            return <div style={{ padding: '2rem', textAlign: 'center' }}>Unauthorized Access</div>;
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;
