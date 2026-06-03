import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const GreigeInventory = () => {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStock();
    }, []);

    const fetchStock = async () => {
        const { data, error } = await supabase
            .from('greige_yarn_stock')
            .select('*')
            .order('yarn_type');

        if (error) console.error('Error fetching stock:', error);
        else setStock(data || []);
        setLoading(false);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Greige Yarn Inventory</h1>
                <div>
                    <Link to="/yarn/transfer" className="btn" style={{ marginRight: '1rem', border: '1px solid var(--border-color)' }}>
                        Transfer / Issue
                    </Link>
                    <button className="btn btn-primary" onClick={() => alert('Stock entry not implemented yet (use SQL seed)')}>
                        <Plus size={18} style={{ marginRight: '0.5rem' }} /> Add Stock
                    </button>
                </div>
            </div>

            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '1rem' }}>Yarn Type</th>
                            <th style={{ padding: '1rem' }}>Quantity (Kg)</th>
                            <th style={{ padding: '1rem' }}>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stock.length === 0 ? (
                            <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center' }}>No stock data found.</td></tr>
                        ) : (
                            stock.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>{item.yarn_type}</td>
                                    <td style={{ padding: '1rem' }}>{item.quantity}</td>
                                    <td style={{ padding: '1rem' }}>{item.location}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GreigeInventory;
