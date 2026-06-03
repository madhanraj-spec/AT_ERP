import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const TransferYarn = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        yarn_type: '',
        quantity: '',
        transaction_type: 'out', // default 'out' generally for transfers
        source_destination: 'dyeing', // default
        reference_id: '' // optional
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Record Transaction
            const { error: transError } = await supabase
                .from('yarn_transactions')
                .insert([{
                    ...formData,
                    quantity: parseFloat(formData.quantity),
                    created_by: user.id
                }]);

            if (transError) throw transError;

            // 2. Update Stock (Simple generic logic, real app needs robust transactions)
            // Call RPC or manually update. For now, we'll try to find existing stock and update it.
            // Ideally this is a Postgres Trigger or Function.
            // I'll assume we have a function or I'll just do a client-side update for prototype using current value.

            // Let's implement a simple direct update for now
            // Find stock
            const { data: stockData } = await supabase
                .from('greige_yarn_stock')
                .select('*')
                .eq('yarn_type', formData.yarn_type)
                .single();

            if (stockData) {
                const newQty = formData.transaction_type === 'in'
                    ? stockData.quantity + parseFloat(formData.quantity)
                    : stockData.quantity - parseFloat(formData.quantity);

                await supabase
                    .from('greige_yarn_stock')
                    .update({ quantity: newQty })
                    .eq('id', stockData.id);
            } else if (formData.transaction_type === 'in') {
                // Create new stock entry
                await supabase.from('greige_yarn_stock').insert([{
                    yarn_type: formData.yarn_type,
                    quantity: parseFloat(formData.quantity),
                    location: 'Warehouse A'
                }]);
            }

            alert('Transfer recorded successfully');
            navigate('/yarn/greige');

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1>Issue / Transfer Yarn</h1>
            <div className="card">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label>Yarn Type</label>
                        <input
                            type="text"
                            required
                            placeholder="Cotton 60s"
                            value={formData.yarn_type}
                            onChange={(e) => setFormData({ ...formData, yarn_type: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                        />
                    </div>

                    <div>
                        <label>Transaction Type</label>
                        <select
                            value={formData.transaction_type}
                            onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                        >
                            <option value="out">Issue / Send Out</option>
                            <option value="in">Receive / Inward</option>
                        </select>
                    </div>

                    <div>
                        <label>Quantity (Kg)</label>
                        <input
                            type="number"
                            required
                            step="0.01"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                        />
                    </div>

                    <div>
                        <label>Source / Destination</label>
                        <select
                            value={formData.source_destination}
                            onChange={(e) => setFormData({ ...formData, source_destination: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                        >
                            <option value="dyeing">Dyeing Dept</option>
                            <option value="weaving">Weaving Dept</option>
                            <option value="spinning_mill">Spinning Mill (Supplier)</option>
                        </select>
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        Submit Transaction
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TransferYarn;
