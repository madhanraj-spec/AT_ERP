import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  PackageSearch,
  CheckSquare,
  Truck,
  Settings,
  LogOut,
  Droplet,
  Scissors,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    switch(user?.role) {
      case 'admin':
        return [
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
          { name: 'Dyeing Order Forms', path: '/admin/dyeing-forms', icon: Droplet },
          { name: 'Approvals', path: '/admin/approvals', icon: CheckSquare },
          { name: 'Greige Yarn', path: '/greige-yarn', icon: PackageSearch },
          { name: 'Dyed Yarn', path: '/dyed-yarn', icon: Droplet },
          { name: 'Production Management', path: '/production', icon: Scissors },
          { name: 'Warping and Sizing', path: '/warping-sizing', icon: Layers },
          { name: 'Weaving', path: '/weaving', icon: Layers },
          { name: 'Inspection', path: '/inspection', icon: CheckSquare },
          { name: 'Masters', path: '/masters', icon: Settings }
        ];
      case 'merchandiser':
        return [
          { name: 'Dashboard', path: '/merchandiser', icon: LayoutDashboard },
          { name: 'Orders', path: '/merchandiser/orders', icon: ShoppingCart },
          { name: 'Dyeing Order Forms', path: '/merchandiser/dyeing-forms', icon: Droplet }
        ];
      case 'greige_yarn':
        return [
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Greige Yarn', path: '/greige-yarn', icon: PackageSearch }
        ];
      case 'dyed_yarn':
        return [
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Dyed Yarn', path: '/dyed-yarn', icon: Droplet },
        ];
      case 'production':
        return [
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Production Management', path: '/production', icon: Scissors },
          { name: 'Masters', path: '/masters', icon: Settings }
        ];
      case 'warping_sizing':
        return [
          { name: 'Warping and Sizing', path: '/warping-sizing', icon: Layers }
        ];
      case 'weaving':
        return [
          { name: 'Weaving', path: '/weaving', icon: Layers }
        ];
      case 'inspection':
        return [
          { name: 'Inspection', path: '/inspection', icon: CheckSquare },
        ];
      default:
        return [
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
        ];
    }
  };

  const links = getNavLinks();

  return (
    <div className="no-print" style={{
      width: isCollapsed ? '80px' : '260px',
      transition: 'width 0.3s ease',
      backgroundColor: 'var(--color-primary)',
      color: 'white',
      borderRight: '1px solid var(--color-primary-dark)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ 
        padding: isCollapsed ? '1.5rem 0' : '1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--color-primary-light)' 
      }}>
        {!isCollapsed && (
          <h2 style={{ fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <div style={{ background: 'white', padding: '0.4rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>AT</span>
            </div>
            Fabric ERP
          </h2>
        )}
        {isCollapsed && (
          <div style={{ background: 'white', padding: '0.4rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>AT</span>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: 'none', 
            color: 'white', 
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: isCollapsed ? '1rem' : '0'
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div style={{ padding: isCollapsed ? '1.5rem 0' : '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
        {!isCollapsed && (
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', paddingLeft: '0.5rem' }}>
            {user?.role.replace('_', ' ')} portal
          </div>
        )}
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '0.75rem',
                padding: isCollapsed ? '0.75rem' : '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                fontWeight: isActive ? '600' : '400',
                transition: 'all var(--transition-fast)',
                width: isCollapsed ? 'max-content' : 'auto'
              })}
              className="hover-lift"
              title={isCollapsed ? link.name : ""}
            >
              <link.icon size={18} />
              {!isCollapsed && <span>{link.name}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div style={{ padding: isCollapsed ? '1rem 0' : '1rem', borderTop: '1px solid var(--color-primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '0.75rem', 
          marginBottom: '1rem', 
          padding: isCollapsed ? '0' : '0.5rem',
          width: '100%'
        }}>
          <div style={{ minWidth: '36px', height: '36px', borderRadius: 'var(--radius-full)', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.role.replace('_', ' ')}</div>
            </div>
          )}
        </div>
        <button 
          onClick={handleLogout}
          className="btn hover-lift" 
          style={{ 
            width: isCollapsed ? 'auto' : '100%', 
            padding: isCollapsed ? '0.75rem' : '0.625rem 1.25rem',
            justifyContent: 'center', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            color: 'white', 
            border: '1px solid rgba(255,255,255,0.2)' 
          }}
          title={isCollapsed ? "Sign Out" : ""}
        >
          <LogOut size={16} />
          {!isCollapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
}
