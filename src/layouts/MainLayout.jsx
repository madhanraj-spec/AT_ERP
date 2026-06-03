import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const MainLayout = () => {
    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{
                flex: 1,
                marginLeft: '260px',
                padding: '2rem',
                minHeight: '100vh',
                backgroundColor: 'var(--bg-body)'
            }}>
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
