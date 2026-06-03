import React, { useState } from 'react';
import { Factory, ShieldAlert, LogIn, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'var(--bg-current)',
      backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(128,0,0,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(128,0,0,0.05) 0%, transparent 40%)'
    }}>
      <div className="glass-panel fade-in hover-lift" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            padding: '1rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-primary)'
          }}>
            <Factory size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>AT Fabric ERP</h1>
          <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', margin: 0 }}>Sign in to your department portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="input-field"
              placeholder="you@atfabrics.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? <Loader size={18} className="spin" /> : <LogIn size={18} />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Info */}
        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(128, 0, 0, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(128,0,0,0.1)' }}>
          <ShieldAlert size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', margin: 0 }}>
            Access is managed by your Admin. Contact your system administrator if you need credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
