import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Trash, Printer, ArrowLeft, Check } from 'lucide-react';

const CreateOrder = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const [formData, setFormData] = useState({
        buyer_name: '',
        order_date: new Date().toISOString().split('T')[0],
    });

    const [items, setItems] = useState([
        { fabric_specification: '', design_specification: '', quantity: '', greige_yarn_requirement: '' }
    ]);

    const handleAddItem = () => {
        setItems([...items, { fabric_specification: '', design_specification: '', quantity: '', greige_yarn_requirement: '' }]);
    };

    const handleRemoveItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleReview = (e) => {
        e.preventDefault();
        setIsConfirming(true);
    };

    const handleSubmit = async () => {
        setLoading(true);

        try {
            // 1. Create Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    buyer_name: formData.buyer_name,
                    order_date: formData.order_date,
                    merchandiser_id: user.id,
                    status: 'confirmed'
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items
            const orderItems = items.map(item => ({
                order_id: orderData.id,
                fabric_specification: item.fabric_specification,
                design_specification: item.design_specification,
                quantity: parseFloat(item.quantity),
                greige_yarn_requirement: parseFloat(item.greige_yarn_requirement)
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            navigate('/merch/orders');
        } catch (error) {
            console.error('Error creating order:', error);
            alert('Error creating order: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (isConfirming) {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto' }} className="print-container">
                <style>{`
                    @media print {
                        aside,
                        .no-print {
                            display: none !important;
                        }
                        main {
                            margin-left: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .print-card {
                            border: none !important;
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        body {
                            background: white !important;
                            color: black !important;
                        }
                    }
                `}</style>
                
                {/* Header info (only visible during print or as preview header) */}
                <div style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '2rem' }}>Fabric ERP</h1>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Order Summary & Confirmation</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h3 style={{ margin: 0 }}>Ashok Textiles</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>Department: Merchandising</p>
                        </div>
                    </div>
                </div>

                <div className="card print-card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Order Details</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.875rem' }}>Buyer Name</span>
                            <strong style={{ fontSize: '1.125rem' }}>{formData.buyer_name}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.875rem' }}>Order Date</span>
                            <strong style={{ fontSize: '1.125rem' }}>{formData.order_date}</strong>
                        </div>
                    </div>
                </div>

                <div className="card print-card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Order Items Summary</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '0.75rem 0.5rem' }}>#</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Fabric Specification</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Design Specification</th>
                                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Quantity (Mtrs/Kg)</th>
                                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Greige Yarn Req (Kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.75rem 0.5rem' }}>{idx + 1}</td>
                                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.fabric_specification}</td>
                                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.design_specification || '-'}</td>
                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{parseFloat(item.quantity).toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{parseFloat(item.greige_yarn_requirement).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Signature section for print layout */}
                <div style={{ display: 'none', justifyContent: 'space-between', marginTop: '4rem', paddingTop: '2rem' }} className="print-only-block">
                    <style>{`
                        @media print {
                            .print-only-block {
                                display: flex !important;
                            }
                        }
                    `}</style>
                    <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '0.5rem' }}>
                        Prepared By
                    </div>
                    <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '0.5rem' }}>
                        Authorized Signatory
                    </div>
                </div>

                {/* Actions */}
                <div className="no-print" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => setIsConfirming(false)}
                        className="btn"
                        style={{ backgroundColor: 'var(--color-gray-200)', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                    >
                        <ArrowLeft size={16} /> Edit Details
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn"
                        style={{ backgroundColor: 'var(--color-secondary)', color: 'white', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                    >
                        <Printer size={16} /> Print Review
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                    >
                        <Check size={16} /> {loading ? 'Submitting...' : 'Complete & Submit'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1>Create New Order</h1>
            <form onSubmit={handleReview} style={{ marginTop: '2rem' }}>
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3>Order Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label>Buyer Name</label>
                            <input
                                type="text"
                                required
                                value={formData.buyer_name}
                                onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label>Order Date</label>
                            <input
                                type="date"
                                required
                                value={formData.order_date}
                                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Order Items</h3>
                        <button type="button" onClick={handleAddItem} className="btn" style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}>
                            <Plus size={16} style={{ marginRight: '0.5rem' }} /> Add Item
                        </button>
                    </div>

                    {items.map((item, index) => (
                        <div key={index} style={{
                            padding: '1rem',
                            backgroundColor: 'var(--bg-body)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1rem',
                            position: 'relative'
                        }}>
                            {items.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        background: 'none',
                                        border: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Trash size={16} />
                                </button>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label>Fabric Specification</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Cotton 60s"
                                        value={item.fabric_specification}
                                        onChange={(e) => handleItemChange(index, 'fabric_specification', e.target.value)}
                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label>Design Specification</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Plain Weave"
                                        value={item.design_specification}
                                        onChange={(e) => handleItemChange(index, 'design_specification', e.target.value)}
                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label>Quantity (Meters/Kg)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label>Greige Yarn Req. (Kg)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={item.greige_yarn_requirement}
                                        onChange={(e) => handleItemChange(index, 'greige_yarn_requirement', e.target.value)}
                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button type="button" onClick={() => navigate('/merch/orders')} className="btn" style={{ backgroundColor: 'var(--color-gray-200)' }}>Cancel</button>
                    <button type="submit" className="btn btn-primary">
                        Proceed to Review
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateOrder;
