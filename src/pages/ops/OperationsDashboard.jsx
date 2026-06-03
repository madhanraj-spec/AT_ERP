import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

const OperationsDashboard = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch orders ready for production (e.g. approved dyeing orders or just raw orders)
    // "operations team will schedule the warping, sizing and weaving for the order"
    // So they need to see Orders and create Plans.

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        const { data, error } = await supabase
            .from('production_plans')
            .select(`
            *,
            order_items (
                fabric_specification,
                orders (order_number, buyer_name)
            )
        `)
            .order('start_date');

        if (error) console.error(error);
        else setPlans(data || []);
        setLoading(false);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Operations Planning</h1>
                <button className="btn btn-primary">Schedule New Job</button>
            </div>

            <div className="card">
                <h3>Production Schedule</h3>
                {plans.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>No active production plans.</p>
                ) : (
                    <table style={{ width: '100%', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Order</th>
                                <th>Process</th>
                                <th>Machine</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map(plan => (
                                <tr key={plan.id}>
                                    <td>{plan.start_date}</td>
                                    <td>{plan.order_items?.orders?.order_number}</td>
                                    <td>{plan.process_type}</td>
                                    <td>{plan.machine_id}</td>
                                    <td>{plan.status}</td>
                                    <td>
                                        {plan.process_type === 'weaving' && plan.status !== 'completed' && (
                                            <button
                                                className="btn"
                                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                                onClick={async () => {
                                                    const rollNo = prompt('Enter Roll Number:');
                                                    if (!rollNo) return;
                                                    const length = prompt('Enter Length (meters):');
                                                    if (!length) return;

                                                    const { error } = await supabase.from('fabric_rolls').insert([{
                                                        production_plan_id: plan.id,
                                                        roll_number: rollNo,
                                                        length: parseFloat(length),
                                                        status: 'woven' // ready for inspection
                                                    }]);

                                                    if (error) alert('Error: ' + error.message);
                                                    else alert('Roll created successfully!');
                                                }}
                                            >Generate Roll</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default OperationsDashboard;
