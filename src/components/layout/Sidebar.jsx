import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  PackageSearch,
  CheckSquare,
  Droplet,
  Scissors,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Coins,
  Users,
  Truck
} from 'lucide-react';

const MASTER_LINKS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { name: 'Orders', path: '/merchandiser/orders', icon: ShoppingCart },
  { name: 'Dyeing Order Forms', path: '/admin/dyeing-forms', icon: Droplet },
  { name: 'Dyeing Order Forms', path: '/merchandiser/dyeing-forms', icon: Droplet },
  { name: 'Approvals', path: '/admin/approvals', icon: CheckSquare },
  { name: 'Finances', path: '/admin/finances', icon: Coins },
  { name: 'Greige Yarn', path: '/greige-yarn', icon: PackageSearch },
  { name: 'Dyed Yarn', path: '/dyed-yarn', icon: Droplet },
  { name: 'Production Management', path: '/production', icon: Scissors },
  { name: 'Warping and Sizing', path: '/warping-sizing', icon: Layers },
  { name: 'Weaving', path: '/weaving', icon: Layers },
  { 
    name: 'Inspection', 
    icon: CheckSquare,
    subLinks: [
      { name: '4 Point Inspection', path: '/inspection/four-point' },
      { name: 'Un Washed Inspection', path: '/inspection/unwashed' },
      { name: 'Washed Inspection', path: '/inspection/washed' },
      { name: 'Inspection Report', path: '/inspection/report' }
    ]
  },
  { name: 'Processing', path: '/processing', icon: Layers },
  { name: 'Dispatch', path: '/dispatch', icon: Truck },
  { name: 'E-Way Bill', path: '/eway-bill', icon: Truck },
  { name: 'Masters', path: '/masters', icon: Settings },
  { name: 'User Management', path: '/admin/users', icon: Users }
];

export default function Sidebar({ user, mobileMenuOpen, setMobileMenuOpen }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [rolePermissions, setRolePermissions] = useState(null);

  useEffect(() => {
    if (user?.role) {
      supabase
        .from('role_permissions')
        .select('*')
        .eq('role_name', user.role)
        .single()
        .then(({ data }) => {
          if (data) setRolePermissions(data);
        });
    }
  }, [user?.role]);
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (!rolePermissions) {
      // Fallback static links matching initial config while loading
      switch(user?.role) {
        case 'admin':
          return [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
            { name: 'Dyeing Order Forms', path: '/admin/dyeing-forms', icon: Droplet },
            { name: 'Approvals', path: '/admin/approvals', icon: CheckSquare },
            { name: 'Finances', path: '/admin/finances', icon: Coins },
            { name: 'Greige Yarn', path: '/greige-yarn', icon: PackageSearch },
            { name: 'Dyed Yarn', path: '/dyed-yarn', icon: Droplet },
            { name: 'Production Management', path: '/production', icon: Scissors },
            { name: 'Warping and Sizing', path: '/warping-sizing', icon: Layers },
            { name: 'Weaving', path: '/weaving', icon: Layers },
            { 
              name: 'Inspection', 
              icon: CheckSquare,
              subLinks: [
                { name: '4 Point Inspection', path: '/inspection/four-point' },
                { name: 'Un Washed Inspection', path: '/inspection/unwashed' },
                { name: 'Washed Inspection', path: '/inspection/washed' },
                { name: 'Inspection Report', path: '/inspection/report' }
              ]
            },
            { name: 'Processing', path: '/processing', icon: Layers },
            { name: 'Dispatch', path: '/dispatch', icon: Truck },
            { name: 'E-Way Bill', path: '/eway-bill', icon: Truck },
            { name: 'Masters', path: '/masters', icon: Settings },
            { name: 'User Management', path: '/admin/users', icon: Users }
          ];
        case 'merchandiser':
          return [
            { name: 'Orders', path: '/merchandiser/orders', icon: ShoppingCart },
            { name: 'Dyeing Order Forms', path: '/merchandiser/dyeing-forms', icon: Droplet },
            { name: 'Masters', path: '/masters', icon: Settings }
          ];
        case 'yarn':
          return [
            { name: 'Greige Yarn', path: '/greige-yarn', icon: PackageSearch },
            { name: 'Dyed Yarn', path: '/dyed-yarn', icon: Droplet },
            { name: 'Processing', path: '/processing', icon: Layers },
            { name: 'Dispatch', path: '/dispatch', icon: Truck },
            { name: 'E-Way Bill', path: '/eway-bill', icon: Truck },
            { name: 'Masters', path: '/masters', icon: Settings }
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
            { name: 'Processing', path: '/processing', icon: Layers },
            { name: 'Dispatch', path: '/dispatch', icon: Truck },
            { name: 'Masters', path: '/masters', icon: Settings }
          ];
        case 'warping_sizing':
          return [
            { name: 'Warping and Sizing', path: '/warping-sizing', icon: Layers }
          ];
        case 'weaving':
          return [
            { name: 'Weaving', path: '/weaving', icon: Layers },
            { name: 'Processing', path: '/processing', icon: Layers }
          ];
        case 'inspection':
          return [
            { 
              name: 'Inspection', 
              icon: CheckSquare,
              subLinks: [
                { name: '4 Point Inspection', path: '/inspection/four-point' },
                { name: 'Un Washed Inspection', path: '/inspection/unwashed' },
                { name: 'Washed Inspection', path: '/inspection/washed' },
                { name: 'Inspection Report', path: '/inspection/report' }
              ]
            },
            { name: 'Processing', path: '/processing', icon: Layers }
          ];
        default:
          return [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
          ];
      }
    }

    const allowedPaths = rolePermissions.sidebar_links || [];
    return MASTER_LINKS.map(link => {
      if (link.subLinks) {
        const filteredSubs = link.subLinks.filter(sub => allowedPaths.includes(sub.path));
        if (filteredSubs.length > 0) {
          return { ...link, subLinks: filteredSubs };
        }
        return null;
      }
      return allowedPaths.includes(link.path) ? link : null;
    }).filter(Boolean);
  };

  const location = useLocation();
  const links = getNavLinks();
  const [expandedMenus, setExpandedMenus] = useState({});

  useEffect(() => {
    const currentPath = location.pathname;
    const initialExpanded = {};
    links.forEach(link => {
      if (link.subLinks) {
        const hasActiveSub = link.subLinks.some(sub => sub.path === currentPath);
        if (hasActiveSub) {
          initialExpanded[link.name.toLowerCase()] = true;
        }
      }
    });
    setExpandedMenus(prev => ({ ...prev, ...initialExpanded }));
  }, [location.pathname]);

  const toggleMenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  return (
    <div className={`no-print app-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{
      width: isCollapsed ? '80px' : '260px',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
      color: 'white',
      borderRight: '1px solid var(--color-primary-dark)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
      zIndex: 1000
    }}>
      {/* Sidebar Header */}
      <div style={{ 
        padding: isCollapsed ? '1rem 0.5rem' : '1.5rem 1.25rem', 
        display: 'flex', 
        flexDirection: isCollapsed ? 'column' : 'row',
        alignItems: 'center', 
        justifyContent: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        gap: '0.75rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          width: '100%',
          paddingRight: isCollapsed ? '0' : '2rem'
        }}>
          <img 
            src="/logo.png" 
            alt="Company Logo" 
            style={{ 
              height: isCollapsed ? '32px' : '42px', 
              width: isCollapsed ? '32px' : '100%',
              maxWidth: isCollapsed ? '32px' : '100%',
              objectFit: 'contain'
            }} 
          />
        </div>
        <button 
          onClick={() => {
            if (mobileMenuOpen) {
              setMobileMenuOpen(false);
            } else {
              setIsCollapsed(!isCollapsed);
            }
          }} 
          className="sidebar-toggle-btn"
          style={{ 
            position: isCollapsed ? 'static' : 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: isCollapsed ? 'none' : 'translateY(-50%)',
            background: 'rgba(255,255,255,0.12)', 
            border: 'none', 
            color: 'white', 
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: isCollapsed ? '0.5rem' : '0',
            transition: 'background-color 0.2s',
            backdropFilter: 'blur(4px)',
            zIndex: 10
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
        >
          {mobileMenuOpen ? <X size={16} /> : (isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="custom-scrollbar" style={{ padding: isCollapsed ? '1.5rem 0' : '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
        {!isCollapsed && (
          <div style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', paddingLeft: '0.5rem', marginBottom: '-0.25rem' }}>
            {user?.role.replace('_', ' ')} portal
          </div>
        )}
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {links.map((link) => {
            const hasSubLinks = !!link.subLinks;
            const isExpanded = expandedMenus[link.name.toLowerCase()];
            const isSubPathActive = hasSubLinks && link.subLinks.some(sub => sub.path === location.pathname);

            if (hasSubLinks) {
              return (
                <div key={link.name} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <button
                    onClick={() => toggleMenu(link.name.toLowerCase())}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      gap: '0.75rem',
                      padding: isCollapsed ? '0.75rem' : '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      color: 'white',
                      backgroundColor: isSubPathActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: isSubPathActive ? '600' : '400',
                      transition: 'all var(--transition-fast)',
                      width: isCollapsed ? 'max-content' : 'auto',
                      textAlign: 'left',
                      position: 'relative',
                      fontSize: '0.875rem'
                    }}
                    className="hover-lift"
                    title={isCollapsed ? link.name : ""}
                  >
                    <link.icon size={18} />
                    {!isCollapsed && <span style={{ flex: 1 }}>{link.name}</span>}
                    {!isCollapsed && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </button>
                  {isExpanded && !isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.15)', marginLeft: '1.5rem' }}>
                      {link.subLinks.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
                          style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.5rem 1rem 0.5rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            color: isActive ? 'white' : 'rgba(255,255,255,0.75)',
                            backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                            fontWeight: isActive ? '600' : '400',
                            fontSize: '0.875rem',
                            transition: 'all var(--transition-fast)',
                          })}
                          className="hover-lift"
                        >
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.6)' }} />
                          <span>{sub.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.75rem' : '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                  fontWeight: isActive ? '600' : '400',
                  transition: 'all var(--transition-fast)',
                  width: isCollapsed ? 'max-content' : 'auto',
                  borderLeft: isActive ? '3px solid white' : '3px solid transparent',
                  paddingLeft: isActive ? (isCollapsed ? '0.75rem' : 'calc(1rem - 3px)') : (isCollapsed ? '0.75rem' : '1rem'),
                  fontSize: '0.875rem'
                })}
                className="hover-lift"
                title={isCollapsed ? link.name : ""}
              >
                <link.icon size={18} />
                {!isCollapsed && <span>{link.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Profile Card and Sign Out */}
      <div style={{ 
        padding: isCollapsed ? '1rem 0' : '1rem', 
        margin: isCollapsed ? '0.5rem' : '0.75rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        transition: 'all 0.3s',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '0.75rem', 
          marginBottom: isCollapsed ? '0' : '1rem', 
          padding: isCollapsed ? '0' : '0.25rem',
          width: '100%'
        }}>
          <div style={{ 
            minWidth: '36px', 
            height: '36px', 
            borderRadius: 'var(--radius-full)', 
            backgroundColor: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--color-primary)', 
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textTransform: 'capitalize' }}>{user?.role.replace('_', ' ')}</div>
            </div>
          )}
        </div>
        
        {!isCollapsed && (
          <button 
            onClick={handleLogout}
            className="btn hover-lift" 
            style={{ 
              width: '100%', 
              padding: '0.5rem 1rem',
              justifyContent: 'center', 
              backgroundColor: 'rgba(255,255,255,0.08)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-md)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
