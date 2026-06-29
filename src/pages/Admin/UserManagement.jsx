import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle, 
  Loader,
  Shield,
  RefreshCw,
  Sliders,
  Settings,
  Plus
} from 'lucide-react';

const ALL_SIDEBAR_ITEMS = [
  { group: 'General', name: 'Dashboard', path: '/dashboard' },
  { group: 'Orders', name: 'Orders (Admin)', path: '/admin/orders' },
  { group: 'Orders', name: 'Orders (Merchandiser)', path: '/merchandiser/orders' },
  { group: 'Dyeing', name: 'Dyeing Order Forms (Admin)', path: '/admin/dyeing-forms' },
  { group: 'Dyeing', name: 'Dyeing Order Forms (Merchandiser)', path: '/merchandiser/dyeing-forms' },
  { group: 'Finance & Approvals', name: 'Approvals', path: '/admin/approvals' },
  { group: 'Finance & Approvals', name: 'Finances', path: '/admin/finances' },
  { group: 'Yarn', name: 'Greige Yarn', path: '/greige-yarn' },
  { group: 'Yarn', name: 'Dyed Yarn', path: '/dyed-yarn' },
  { group: 'Production', name: 'Production Management', path: '/production' },
  { group: 'Production', name: 'Warping and Sizing', path: '/warping-sizing' },
  { group: 'Production', name: 'Weaving', path: '/weaving' },
  { group: 'Inspection', name: '4 Point Inspection', path: '/inspection/four-point' },
  { group: 'Inspection', name: 'Un Washed Inspection', path: '/inspection/unwashed' },
  { group: 'Inspection', name: 'Washed Inspection', path: '/inspection/washed' },
  { group: 'Inspection', name: 'Inspection Report', path: '/inspection/report' },
  { group: 'Processing', name: 'Processing', path: '/processing' },
  { group: 'System', name: 'Masters', path: '/masters' },
  { group: 'System', name: 'User Management', path: '/admin/users' }
];

export default function UserManagement() {
  const { profile: loggedInProfile } = useAuth();
  
  // Protect the page: only admins can load it
  if (!loggedInProfile || loggedInProfile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'
  const [users, setUsers] = useState([]);
  const [dbRoles, setDbRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // User Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // User Form states
  const [userFormData, setUserFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'merchandiser'
  });

  // Role Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // null for new, otherwise role object
  
  // Role Form states
  const [roleFormData, setRoleFormData] = useState({
    roleName: '',
    label: '',
    sidebarLinks: []
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchUsers(), fetchRoles()]);
    } catch (err) {
      console.error('Error loading User Management data:', err);
      setError('Failed to load users or roles from database.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setUsers(data || []);
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role_name');
    if (error) throw error;
    setDbRoles(data || []);
  };

  // User Actions
  const handleOpenAddUserModal = () => {
    setUserFormData({
      fullName: '',
      email: '',
      password: '',
      role: dbRoles[0]?.role_name || 'merchandiser'
    });
    setFormError('');
    setShowAddUserModal(true);
  };

  const handleOpenEditUserModal = (user) => {
    setSelectedUser(user);
    setUserFormData({
      fullName: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'merchandiser'
    });
    setFormError('');
    setShowEditUserModal(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (!userFormData.fullName.trim() || !userFormData.email.trim() || !userFormData.password.trim()) {
        throw new Error('All fields are required.');
      }
      if (userFormData.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const { data, error } = await supabase.rpc('create_user_admin', {
        p_email: userFormData.email.trim().toLowerCase(),
        p_password: userFormData.password,
        p_full_name: userFormData.fullName.trim(),
        p_role: userFormData.role
      });

      if (error) throw error;

      setSuccess('User created successfully!');
      setShowAddUserModal(false);
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding user:', err);
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (!userFormData.fullName.trim() || !userFormData.email.trim()) {
        throw new Error('Full Name and Email are required.');
      }
      if (userFormData.password && userFormData.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const { error } = await supabase.rpc('update_user_admin', {
        p_user_id: selectedUser.id,
        p_email: userFormData.email.trim().toLowerCase(),
        p_password: userFormData.password || null,
        p_full_name: userFormData.fullName.trim(),
        p_role: userFormData.role
      });

      if (error) throw error;

      setSuccess('User updated successfully!');
      setShowEditUserModal(false);
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user:', err);
      setFormError(err.message || 'Failed to update user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (userId === loggedInProfile.id) {
      alert('You cannot delete your own account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This will permanently remove their credentials.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_user_admin', {
        p_user_id: userId
      });
      if (error) throw error;
      setSuccess('User deleted successfully.');
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user.');
    }
  };

  // Role Actions
  const handleOpenAddRoleModal = () => {
    setEditingRole(null);
    setRoleFormData({
      roleName: '',
      label: '',
      sidebarLinks: []
    });
    setFormError('');
    setShowRoleModal(true);
  };

  const handleOpenEditRoleModal = (role) => {
    setEditingRole(role);
    setRoleFormData({
      roleName: role.role_name,
      label: role.label,
      sidebarLinks: role.sidebar_links || []
    });
    setFormError('');
    setShowRoleModal(true);
  };

  const handleToggleSidebarLink = (path) => {
    setRoleFormData(prev => {
      const isChecked = prev.sidebarLinks.includes(path);
      const newLinks = isChecked 
        ? prev.sidebarLinks.filter(p => p !== path) 
        : [...prev.sidebarLinks, path];
      return { ...prev, sidebarLinks: newLinks };
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const nameKey = roleFormData.roleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!nameKey || !roleFormData.label.trim()) {
        throw new Error('Role ID and Label are required.');
      }

      const payload = {
        role_name: nameKey,
        label: roleFormData.label.trim(),
        sidebar_links: roleFormData.sidebarLinks
      };

      const { error } = await supabase
        .from('role_permissions')
        .upsert(payload, { onConflict: 'role_name' });

      if (error) throw error;

      setSuccess(`Role '${roleFormData.label}' saved successfully!`);
      setShowRoleModal(false);
      await fetchRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving role:', err);
      setFormError(err.message || 'Failed to save role permissions config.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteRole = async (roleName, label) => {
    // Restrict deleting admin or merchandiser
    if (roleName === 'admin' || roleName === 'merchandiser') {
      alert('Default system roles (admin/merchandiser) cannot be deleted.');
      return;
    }

    // Check if any users are assigned to this role
    const usersWithRole = users.filter(u => u.role === roleName);
    if (usersWithRole.length > 0) {
      alert(`Cannot delete role. There are ${usersWithRole.length} users currently assigned to this role.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the role '${label}'? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_name', roleName);

      if (error) throw error;

      setSuccess('Role deleted successfully.');
      await fetchRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err.message || 'Failed to delete role.');
    }
  };

  // Search logic
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const roleLabel = dbRoles.find(r => r.role_name === user.role)?.label || user.role;
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      roleLabel?.toLowerCase().includes(query)
    );
  });

  const getRoleBadgeStyle = (roleName) => {
    switch (roleName) {
      case 'admin':
        return { backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.2)' };
      case 'merchandiser':
        return { backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)' };
      case 'yarn':
      case 'greige_yarn':
      case 'dyed_yarn':
        return { backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.2)' };
      case 'weaving':
      case 'warping_sizing':
        return { backgroundColor: 'rgba(147, 51, 234, 0.12)', color: '#9333ea', border: '1px solid rgba(147, 51, 234, 0.2)' };
      default:
        return { backgroundColor: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.2)' };
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            backgroundColor: 'rgba(128, 0, 0, 0.1)', 
            color: 'var(--color-primary)', 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-lg)' 
          }}>
            <Users size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary)', margin: 0 }}>User Management</h1>
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', margin: 0 }}>
              Manage logins, create custom roles, and map system sidebar links dynamically.
            </p>
          </div>
        </div>

        {activeTab === 'users' ? (
          <button 
            onClick={handleOpenAddUserModal}
            className="btn btn-primary hover-lift"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
          >
            <UserPlus size={18} />
            Add New User
          </button>
        ) : (
          <button 
            onClick={handleOpenAddRoleModal}
            className="btn btn-primary hover-lift"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
          >
            <Plus size={18} />
            Create Custom Role
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-current)', marginBottom: '1.5rem', paddingBottom: '2px' }}>
        <button 
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'users' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'users' ? 'var(--color-primary)' : 'var(--text-muted-current)',
            fontWeight: activeTab === 'users' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.95rem'
          }}
        >
          Users List
        </button>
        <button 
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'roles' ? '3px solid var(--color-primary)' : '3px solid transparent',
            color: activeTab === 'roles' ? 'var(--color-primary)' : 'var(--text-muted-current)',
            fontWeight: activeTab === 'roles' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.95rem'
          }}
        >
          Roles & Permissions
        </button>
      </div>

      {/* Toast banners */}
      {success && (
        <div className="fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: '#047857',
          marginBottom: '1.5rem'
        }}>
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: '#b91c1c',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
          <Loader size={36} className="spin" color="var(--color-primary)" />
          <span style={{ color: 'var(--text-muted-current)', fontSize: '0.9rem' }}>Loading data...</span>
        </div>
      ) : activeTab === 'users' ? (
        /* Users Tab Content */
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={18} style={{ 
                position: 'absolute', 
                left: '1rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted-current)' 
              }} />
              <input 
                type="text" 
                placeholder="Search by name, email, or role..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.5rem', margin: 0 }}
              />
            </div>
            
            <button 
              onClick={loadData} 
              className="btn btn-outline" 
              style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {filteredUsers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.75rem', textAlign: 'center' }}>
              <Users size={48} style={{ opacity: 0.3 }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>No Users Found</h3>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                Create new ERP system user profiles to get started.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-current)' }}>
                    <th style={{ padding: '1rem' }}>Full Name</th>
                    <th style={{ padding: '1rem' }}>Email Address</th>
                    <th style={{ padding: '1rem' }}>Role</th>
                    <th style={{ padding: '1rem' }}>Created At</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const roleDetails = dbRoles.find(r => r.role_name === user.role);
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--border-current)' }} className="table-row-hover">
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{user.full_name}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted-current)' }}>{user.email}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.25rem',
                            padding: '0.25rem 0.6rem', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            textTransform: 'capitalize',
                            ...getRoleBadgeStyle(user.role)
                          }}>
                            {user.role === 'admin' && <Shield size={12} />}
                            {roleDetails?.label || user.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted-current)' }}>
                          {new Date(user.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleOpenEditUserModal(user)}
                              className="btn-action"
                              style={{ padding: '6px', color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="btn-action"
                              style={{ padding: '6px', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}
                              disabled={user.id === loggedInProfile.id}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Roles Tab Content */
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-current)' }}>
                  <th style={{ padding: '1rem' }}>Role ID (Key)</th>
                  <th style={{ padding: '1rem' }}>Display Label</th>
                  <th style={{ padding: '1rem' }}>Allowed Pages Count</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dbRoles.map((role) => (
                  <tr key={role.role_name} style={{ borderBottom: '1px solid var(--border-current)' }} className="table-row-hover">
                    <td style={{ padding: '1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{role.role_name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.25rem',
                        padding: '0.25rem 0.6rem', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.75rem', 
                        fontWeight: '600',
                        ...getRoleBadgeStyle(role.role_name)
                      }}>
                        {role.label}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted-current)' }}>
                      {role.sidebar_links?.length || 0} items mapped
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleOpenEditRoleModal(role)}
                          className="btn-action"
                          style={{ padding: '6px', color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                          title="Edit Permissions Map"
                        >
                          <Sliders size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(role.role_name, role.label)}
                          className="btn-action"
                          style={{ padding: '6px', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}
                          disabled={role.role_name === 'admin' || role.role_name === 'merchandiser'}
                          title="Delete Role"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '480px', 
            padding: '2rem', 
            position: 'relative',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(128, 0, 0, 0.15)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.1)',
            color: '#1f2937'
          }}>
            <button 
              onClick={() => setShowAddUserModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '1.5rem' }}>Add New User</h2>
            
            {formError && (
              <div style={{
                padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)',
                color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddUser}>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input 
                  type="text" 
                  value={userFormData.fullName}
                  onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input 
                  type="email" 
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="e.g. user@at.com"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Password</label>
                <input 
                  type="password" 
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">System Role</label>
                <select 
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  {dbRoles.map(r => (
                    <option key={r.role_name} value={r.role_name}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddUserModal(false)}
                  className="btn btn-outline"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? <Loader size={16} className="spin" /> : null}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '480px', 
            padding: '2rem', 
            position: 'relative',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(128, 0, 0, 0.15)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.1)',
            color: '#1f2937'
          }}>
            <button 
              onClick={() => setShowEditUserModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.25rem' }}>Edit User</h2>
            <p style={{ color: '#4b5563', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Modify role assignments or update password details.
            </p>
            
            {formError && (
              <div style={{
                padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)',
                color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleEditUser}>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input 
                  type="text" 
                  value={userFormData.fullName}
                  onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input 
                  type="email" 
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="e.g. user@at.com"
                  className="input-field"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">New Password (Optional)</label>
                <input 
                  type="password" 
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label className="input-label">System Role</label>
                <select 
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  {dbRoles.map(r => (
                    <option key={r.role_name} value={r.role_name}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditUserModal(false)}
                  className="btn btn-outline"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? <Loader size={16} className="spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Config Modal */}
      {showRoleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '640px', 
            padding: '2rem', 
            maxHeight: '90vh', 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(128, 0, 0, 0.15)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.1)',
            color: '#1f2937'
          }}>
            <button 
              onClick={() => setShowRoleModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.25rem' }}>
              {editingRole ? 'Edit Role Configuration' : 'Create Custom Role'}
            </h2>
            <p style={{ color: '#4b5563', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Define user-role identifiers and select allowed navigation paths.
            </p>

            {formError && (
              <div style={{
                padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)',
                color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="input-label">Role Key (Unique ID)</label>
                    <input 
                      type="text" 
                      value={roleFormData.roleName}
                      onChange={(e) => setRoleFormData({ ...roleFormData, roleName: e.target.value })}
                      placeholder="e.g. yarn_operator"
                      className="input-field"
                      disabled={!!editingRole}
                      required
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="input-label">Display Label</label>
                    <input 
                      type="text" 
                      value={roleFormData.label}
                      onChange={(e) => setRoleFormData({ ...roleFormData, label: e.target.value })}
                      placeholder="e.g. Yarn Operator"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <label className="input-label" style={{ marginBottom: '0.75rem', display: 'block', fontWeight: '600' }}>
                    Sidebar Menu Navigation Access
                  </label>
                  
                  {/* Group items by category */}
                  {Object.entries(
                    ALL_SIDEBAR_ITEMS.reduce((acc, item) => {
                      if (!acc[item.group]) acc[item.group] = [];
                      acc[item.group].push(item);
                      return acc;
                    }, {})
                  ).map(([groupName, items]) => (
                    <div key={groupName} style={{ marginBottom: '1.25rem', backgroundColor: 'rgba(128,0,0,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(128,0,0,0.1)' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {groupName}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
                        {items.map(item => {
                          const isChecked = roleFormData.sidebarLinks.includes(item.path);
                          return (
                            <label key={item.path} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSidebarLink(item.path)}
                                style={{ accentColor: 'var(--color-primary)', width: '15px', height: '15px' }}
                              />
                              <span style={{ color: isChecked ? '#1f2937' : '#4b5563', fontWeight: isChecked ? '500' : '400' }}>
                                {item.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-current)' }}>
                <button 
                  type="button" 
                  onClick={() => setShowRoleModal(false)}
                  className="btn btn-outline"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? <Loader size={16} className="spin" /> : null}
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
