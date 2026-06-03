import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader, AlertCircle, CheckCircle, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function NewDelivery() {
  const navigate = useNavigate();
  const [dofNumber, setDofNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null); // { found, form }
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!dofNumber.trim()) {
      setError('Please enter a DOF Number.');
      return;
    }
    setSearching(true);
    setResult(null);
    setError('');

    try {
      const { data, error: dbErr } = await supabase
        .from('dyeing_order_forms')
        .select(`
          id, dof_number, status,
          dyeing_unit:master_partners(partner_name)
        `)
        .ilike('dof_number', dofNumber.trim())
        .maybeSingle();

      if (dbErr) throw dbErr;

      if (!data) {
        setResult({ found: false });
        return;
      }

      if (data.status === 'pending' || data.status === 'rejected') {
        setResult({ found: true, form: data, notApproved: true });
        return;
      }

      if (data.status === 'fully_sent') {
        setResult({ found: true, form: data, fullySent: true });
        return;
      }

      // approved or partially_sent — navigate immediately
      navigate(`/greige-yarn/deliveries/${data.id}`);
    } catch (err) {
      setError('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }} className="fade-in">
      {/* Header */}
      <button
        onClick={() => navigate('/greige-yarn')}
        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Truck size={28} color="#7f1d1d" />
        </div>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          New Greige Yarn Delivery
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
          Enter an Order Form Number to create a new delivery
        </p>
      </div>

      {/* Search Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleSearch}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-current)', marginBottom: '0.5rem' }}>
            Enter Order Form Number
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', marginBottom: '1rem', marginTop: 0 }}>
            Enter a Dyeing Order Form (DOF) number, e.g. <strong>AT/2026/DOF/00001</strong>
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={dofNumber}
              onChange={e => { setDofNumber(e.target.value); setError(''); setResult(null); }}
              placeholder="AT/2026/DOF/00001"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: '2px solid var(--border-current)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontWeight: '600',
                outline: 'none',
                fontFamily: 'monospace',
                letterSpacing: '0.5px',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-current)'}
              autoFocus
            />
            <button
              type="submit"
              disabled={searching}
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', opacity: searching ? 0.7 : 1, cursor: searching ? 'not-allowed' : 'pointer' }}
            >
              {searching ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.75rem 1rem', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </form>

        {/* Results */}
        {result && (
          <div style={{ marginTop: '1.5rem' }}>
            {!result.found && (
              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
                <AlertCircle size={32} color="#dc2626" />
                <p style={{ margin: 0, fontWeight: '700', color: '#991b1b', fontSize: '1rem' }}>Order Form Not Found</p>
                <p style={{ margin: 0, color: '#7f1d1d', fontSize: '0.85rem' }}>
                  No DOF found with number "<strong>{dofNumber}</strong>". Please check and try again.
                </p>
              </div>
            )}

            {result.found && result.notApproved && (
              <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
                <AlertCircle size={32} color="#d97706" />
                <p style={{ margin: 0, fontWeight: '700', color: '#92400e', fontSize: '1rem' }}>Order Form Not Approved</p>
                <p style={{ margin: 0, color: '#78350f', fontSize: '0.85rem' }}>
                  <strong>{result.form.dof_number}</strong> has status <strong>{result.form.status?.toUpperCase()}</strong>. Only approved DOFs can receive greige yarn deliveries.
                </p>
              </div>
            )}

            {result.found && result.fullySent && (
              <div style={{ backgroundColor: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
                <CheckCircle size={32} color="#1d4ed8" />
                <p style={{ margin: 0, fontWeight: '700', color: '#1e40af', fontSize: '1rem' }}>Order Form Already Fully Delivered</p>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.85rem' }}>
                  <strong>{result.form.dof_number}</strong> has already received all required greige yarn. All quantities are fully sent.
                </p>
                <button
                  onClick={() => navigate(`/greige-yarn/deliveries/${result.form.id}`)}
                  style={{ backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  View Delivery History
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
          Or <button onClick={() => navigate('/greige-yarn/deliveries')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
            browse all approved order forms →
          </button>
        </p>
      </div>
    </div>
  );
}
