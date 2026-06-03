import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    Users,
    ShoppingBag,
    Layers,
    Palette,
    Settings,
    ClipboardCheck,
    DollarSign,
    LogOut,
    Menu
} from 'lucide-react';
import styles from './Sidebar.module.css';

const Sidebar = () => {
    const { profile, signOut } = useAuth();
    const role = profile?.role || 'guest';

    const menuItems = [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'merchandiser', 'greige_yarn', 'dyeing', 'operations', 'inspection', 'finance'] },
        { label: 'User Management', path: '/admin/users', icon: Users, roles: ['admin'] },
        { label: 'Orders', path: '/merch/orders', icon: ShoppingBag, roles: ['admin', 'merchandiser'] },
        { label: 'Inventory (Greige)', path: '/yarn/greige', icon: Layers, roles: ['admin', 'greige_yarn'] },
        { label: 'Dyeing', path: '/dyeing', icon: Palette, roles: ['admin', 'dyeing'] },
        { label: 'Operations', path: '/ops', icon: Settings, roles: ['admin', 'operations'] },
        { label: 'Inspection', path: '/inspection', icon: ClipboardCheck, roles: ['admin', 'inspection'] },
        { label: 'Finance', path: '/finance', icon: DollarSign, roles: ['admin', 'finance'] },
    ];

    const filteredItems = menuItems.filter(item => item.roles.includes(role));

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <ActivityIcon />
                <span>Fabric ERP</span>
            </div>

            <div className={styles.userInfo}>
                <div className={styles.userAvatar}>{profile?.full_name?.charAt(0) || 'U'}</div>
                <div className={styles.userDetails}>
                    <span className={styles.userName}>{profile?.full_name || 'User'}</span>
                    <span className={styles.userRole}>{role}</span>
                </div>
            </div>

            <nav className={styles.nav}>
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className={styles.footer}>
                <button onClick={signOut} className={styles.logoutBtn}>
                    <LogOut size={20} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

// Simple Logo Icon
const ActivityIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

export default Sidebar;
