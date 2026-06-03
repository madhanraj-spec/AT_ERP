import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Plus } from 'lucide-react';
import { format } from 'date-fns';

const OrderDetails = () => {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrderDetails();
    }, [id]);

    const fetchOrderDetails = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
        *,
        order_items (
          *,
          dyeing_orders (*)
        )
      `)
            .eq('id', id)
            .single();

        if (error) console.error('Error fetching order:', error);
        else setOrder(data);
        setLoading(false);
    };

    if (loading) return <div>Loading details...</div>;
    if (!order) return <div>Order not found.</div>;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/merch/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <ArrowLeft size={16} /> Back to Orders
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>Order #{order.order_number}</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Buyer: {order.buyer_name} | Date: {format(new Date(order.order_date), 'PPP')}</p>
                    </div>
                    <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.875rem',
                        backgroundColor: order.status === 'completed' ? '#dcfce7' : '#f3f4f6',
                        color: order.status === 'completed' ? '#166534' : '#374151',
                        textTransform: 'capitalize'
                    }}>
                        {order.status.replace('_', ' ')}
                    </span>
                </div>
            </div>

            <div className="card">
                <h3>Order Items</h3>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {order.order_items.map((item) => (
                        <div key={item.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0 }}>{item.fabric_specification}</h4>
                                <span>Qty: {item.quantity}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Design: {item.design_specification}</p>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Greige Yarn Req: {item.greige_yarn_requirement}</p>

                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Dyeing Orders</h5>
                                    <Link to={`/merch/orders/${id}/items/${item.id}/dyeing/new`} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                                        <Plus size={14} style={{ marginRight: '0.25rem' }} /> Add Dyeing Order
                                    </Link>
                                </div>

                                {item.dyeing_orders && item.dyeing_orders.length > 0 ? (
                                    <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                <th>Color</th>
                                                <th>Qty</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.dyeing_orders.map(dOrder => (
                                                <tr key={dOrder.id}>
                                                    <td>{dOrder.color_code}</td>
                                                    <td>{dOrder.quantity}</td>
                                                    <td>{dOrder.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>No dyeing orders yet.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;
