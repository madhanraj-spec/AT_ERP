import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';

const OrderList = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        // RLS will handle filtering for merchandisers to see only their own
        // Admins will see all
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(count)')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching orders:', error);
        else setOrders(data || []);
        setLoading(false);
    };

    if (loading) return <div>Loading orders...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Orders</h2>
                <Link to="/merch/orders/new" className="btn btn-primary">
                    <Plus size={18} style={{ marginRight: '0.5rem' }} />
                    New Order
                </Link>
            </div>

            {orders.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <p>No orders found. Create your first order!</p>
                </div>
            ) : (
                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '1rem' }}>Order #</th>
                                <th style={{ padding: '1rem' }}>Buyer</th>
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Items</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>{order.order_number}</td>
                                    <td style={{ padding: '1rem' }}>{order.buyer_name}</td>
                                    <td style={{ padding: '1rem' }}>{format(new Date(order.order_date), 'MMM dd, yyyy')}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.875rem',
                                            backgroundColor: order.status === 'completed' ? '#dcfce7' : '#f3f4f6',
                                            color: order.status === 'completed' ? '#166534' : '#374151'
                                        }}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{order.order_items?.[0]?.count || 0}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <Link to={`/merch/orders/${order.id}`} className="btn" style={{ padding: '0.5rem', color: 'var(--color-primary)' }}>
                                            <Eye size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OrderList;
