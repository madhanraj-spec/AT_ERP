import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const AdminDashboard = () => {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [stats, setStats] = useState({ orders: 0, pending_dyeing: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        // Fetch pending dyeing orders
        const { data: pendingDyeing, error: dyeingError } = await supabase
            .from('dyeing_orders')
            .select('*, order_items(*, orders(*))')
            .eq('status', 'pending');

        if (!dyeingError) setPendingOrders(pendingDyeing || []);

        // Simple stats
        const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });

        setStats({
            orders: ordersCount || 0,
            pending_dyeing: pendingDyeing?.length || 0,
        });

        setLoading(false);
    };

    const handleApprove = async (id) => {
        const { error } = await supabase
            .from('dyeing_orders')
            .update({ status: 'approved', approved_at: new Date() })
            .eq('id', id);

        if (error) {
            alert('Error approving: ' + error.message);
        } else {
            fetchDashboardData();
        }
    };

    if (loading) return <div>Loading dashboard...</div>;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1>Admin Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Overview and Approvals</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{stats.pending_dyeing}</h2>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Pending Approvals</span>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{stats.orders}</h2>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Orders</span>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3>Pending Dyeing Approvals</h3>
                {pendingOrders.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>No pending approvals.</p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '1rem' }}>Date</th>
                                    <th style={{ padding: '1rem' }}>Order #</th>
                                    <th style={{ padding: '1rem' }}>Item</th>
                                    <th style={{ padding: '1rem' }}>Color</th>
                                    <th style={{ padding: '1rem' }}>Qty (Kg)</th>
                                    <th style={{ padding: '1rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingOrders.map((dOrder) => (
                                    <tr key={dOrder.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>{format(new Date(dOrder.created_at), 'MMM dd')}</td>
                                        <td style={{ padding: '1rem' }}>{dOrder.order_items?.orders?.order_number}</td>
                                        <td style={{ padding: '1rem' }}>{dOrder.order_items?.fabric_specification}</td>
                                        <td style={{ padding: '1rem' }}>{dOrder.color_code}</td>
                                        <td style={{ padding: '1rem' }}>{dOrder.quantity}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <button
                                                onClick={() => handleApprove(dOrder.id)}
                                                className="btn"
                                                style={{ backgroundColor: '#dcfce7', color: '#166534', gap: '0.5rem', padding: '0.5rem 1rem' }}
                                            >
                                                <CheckCircle size={16} /> Approve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
