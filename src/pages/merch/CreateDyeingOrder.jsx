import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const CreateDyeingOrder = () => {
    const { orderId, itemId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        color_code: '',
        quantity: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('dyeing_orders')
                .insert([{
                    order_item_id: itemId,
                    color_code: formData.color_code,
                    quantity: parseFloat(formData.quantity),
                    status: 'pending' // pending admin approval
                }]);

            if (error) throw error;

            navigate(`/merch/orders/${orderId}`);
        } catch (error) {
            console.error('Error creating dyeing order:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1>Create Dyeing Order</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Request dyeing for order item.</p>

            <div className="card">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Color Code / Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Navy Blue #000080"
                            value={formData.color_code}
                            onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Quantity (Kg)</label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" onClick={() => navigate(`/merch/orders/${orderId}`)} className="btn" style={{ backgroundColor: 'var(--color-gray-200)' }}>Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-primary">
                            {loading ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDyeingOrder;
