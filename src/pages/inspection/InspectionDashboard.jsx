import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardCheck } from 'lucide-react';

const InspectionDashboard = () => {
    const [rolls, setRolls] = useState([]);

    useEffect(() => {
        fetchRolls();
    }, []);

    const fetchRolls = async () => {
        // Fetch rolls that need inspection (status 'woven' or 'finished')
        const { data, error } = await supabase
            .from('fabric_rolls')
            .select('*, production_plan_id(*)')
            .in('status', ['woven', 'finished', 'inspected_raw']); // Show all relevant stages

        if (error) console.error(error);
        else setRolls(data || []);
    };

    const handleInspect = async (id, result) => {
        // Simplified inspection logic: just Pass/Fail
        // In real app, we'd open a modal for 4-point system entry
        const grade = result === 'pass' ? 'A' : 'B';
        const nextStatus = result === 'pass' ? 'processing' : 'b_grade'; // if raw inspection passed, send to processing

        // If it was already finished, then next is dispatched
        // We need to know current status. For simplicity, let's assume raw -> processing.

        const { error } = await supabase
            .from('fabric_rolls')
            .update({ status: nextStatus, grade: grade })
            .eq('id', id);

        if (error) alert('Error: ' + error.message);
        else fetchRolls();
    };

    return (
        <div>
            <h1>Quality Inspection</h1>
            <div className="card">
                <table style={{ width: '100%', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th>Roll #</th>
                            <th>Length</th>
                            <th>Current Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rolls.map(roll => (
                            <tr key={roll.id}>
                                <td>{roll.roll_number}</td>
                                <td>{roll.length}</td>
                                <td>{roll.status}</td>
                                <td>
                                    {(roll.status === 'woven' || roll.status === 'finished') && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn" onClick={() => handleInspect(roll.id, 'pass')} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Pass (A)</button>
                                            <button className="btn" onClick={() => handleInspect(roll.id, 'fail')} style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Fail (B)</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InspectionDashboard;
