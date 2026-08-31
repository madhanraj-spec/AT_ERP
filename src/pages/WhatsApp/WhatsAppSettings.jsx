import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  Settings, 
  Phone, 
  User, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Search,
  Bell,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { 
  getWhatsAppConfig, 
  sendOpenWaMessage, 
  formatPhoneNumber 
} from '../../utils/openwaService';

export default function WhatsAppSettings() {
  const { profile } = useAuth();
  
  // State for Settings
  const [botUrl, setBotUrl] = useState('https://openwa-attendance-bot.onrender.com');
  const [apiKey, setApiKey] = useState('FacPassAttendanceOpenWaMasterKey2026');
  const [endpoint, setEndpoint] = useState('/api/sessions');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  // State for Contacts
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // State for Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    designation: 'Admin',
    notify_dof: true,
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // State for Live Test Message Tool
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('👋 Hello from Ashok Textiles ERP! WhatsApp bot connection is active and working perfectly.');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Load initial settings and contacts
  useEffect(() => {
    loadSettings();
    loadContacts();
    checkBotSession();
  }, []);

  const checkBotSession = async () => {
    setCheckingSession(true);
    setQrCode(null);
    try {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const base = isDev ? '/openwa-proxy' : 'https://openwa-attendance-bot.onrender.com';
      const res = await fetch(`${base}/api/sessions`, {
        headers: { 'X-API-Key': 'FacPassAttendanceOpenWaMasterKey2026' }
      });
      if (res.ok) {
        const sessions = await res.json();
        if (Array.isArray(sessions) && sessions.length > 0) {
          const sess = sessions[0];
          setSessionInfo(sess);

          if (sess.status === 'qr_ready' && sess.id) {
            const qrRes = await fetch(`${base}/api/sessions/${sess.id}/qr`, {
              headers: { 'X-API-Key': 'FacPassAttendanceOpenWaMasterKey2026' }
            });
            if (qrRes.ok) {
              const qrData = await qrRes.json();
              if (qrData?.qrCode) setQrCode(qrData.qrCode);
            }
          }
        }
      }
    } catch (e) {
      console.log('Session check note:', e.message);
    } finally {
      setCheckingSession(false);
    }
  };

  const loadSettings = async () => {
    try {
      const config = await getWhatsAppConfig();
      setBotUrl(config.botUrl);
      setApiKey(config.apiKey);
      setEndpoint(config.endpoint);
      setIsEnabled(config.isEnabled);
    } catch (err) {
      console.error('Error loading WhatsApp settings:', err);
    }
  };

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        // Table might not exist or empty
        console.warn('Contacts table load error:', error);
      } else {
        setContacts(data || []);
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const cleanUrl = botUrl.trim().replace(/\/+$/, '');
      const cleanKey = apiKey.trim();
      const cleanEndpoint = endpoint.trim().startsWith('/') ? endpoint.trim() : `/${endpoint.trim()}`;

      const updates = [
        { key: 'openwa_bot_url', value: cleanUrl },
        { key: 'openwa_api_key', value: cleanKey },
        { key: 'openwa_endpoint', value: cleanEndpoint },
        { key: 'is_enabled', value: isEnabled ? 'true' : 'false' }
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from('whatsapp_settings')
          .upsert(item, { onConflict: 'key' });
        if (error) throw error;
      }

      setSettingsStatus({ type: 'success', message: 'WhatsApp bot settings saved successfully!' });
      setTimeout(() => setSettingsStatus(null), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSettingsStatus({ type: 'error', message: 'Failed to save settings: ' + err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      phone: '',
      designation: 'Admin',
      notify_dof: true,
      is_active: true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      phone: contact.phone || '',
      designation: contact.designation || 'Admin',
      notify_dof: contact.notify_dof !== false,
      is_active: contact.is_active !== false,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter contact name.');
      return;
    }

    const formatted = formatPhoneNumber(formData.phone);
    if (!formatted || formatted.clean.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSavingContact(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formatted.clean,
        designation: formData.designation.trim() || 'Admin',
        notify_dof: formData.notify_dof,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingContact) {
        const { error } = await supabase
          .from('whatsapp_contacts')
          .update(payload)
          .eq('id', editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_contacts')
          .insert([payload]);
        if (error) throw error;
      }

      setModalOpen(false);
      loadContacts();
    } catch (err) {
      console.error('Error saving contact:', err);
      setFormError(err.message || 'Error saving contact');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contact) => {
    if (!window.confirm(`Are you sure you want to delete ${contact.name} (${contact.phone})?`)) return;
    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .delete()
        .eq('id', contact.id);
      if (error) throw error;
      setContacts(prev => prev.filter(c => c.id !== contact.id));
    } catch (err) {
      alert('Error deleting contact: ' + err.message);
    }
  };

  const handleToggleActive = async (contact) => {
    const updatedStatus = !contact.is_active;
    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({ is_active: updatedStatus, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
      if (error) throw error;
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_active: updatedStatus } : c));
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleToggleNotifyDof = async (contact) => {
    const updatedNotify = !contact.notify_dof;
    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({ notify_dof: updatedNotify, updated_at: new Date().toISOString() })
        .eq('id', contact.id);
      if (error) throw error;
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, notify_dof: updatedNotify } : c));
    } catch (err) {
      alert('Error updating notification preference: ' + err.message);
    }
  };

  const handleSendLiveTest = async (phoneToSend, customMsg) => {
    const targetPhone = phoneToSend || testPhone;
    const targetMsg = customMsg || testMessage;

    if (!targetPhone) {
      alert('Please enter a recipient phone number for the test.');
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    const res = await sendOpenWaMessage({
      phone: targetPhone,
      message: targetMsg,
      botUrl,
      apiKey,
      endpoint,
    });

    setSendingTest(false);
    setTestResult(res);
  };

  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.designation || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 0.5rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <div style={{ 
              backgroundColor: 'rgba(37, 211, 102, 0.15)', 
              color: '#25D366', 
              padding: '0.5rem', 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={24} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: 'var(--text-current)' }}>
              WhatsApp Bot & Contacts
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', margin: 0 }}>
            Configure your Render OpenWA bot and manage numbers that receive automated ERP notifications.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => { loadSettings(); loadContacts(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              backgroundColor: 'var(--bg-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '8px',
              color: 'var(--text-current)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            onClick={handleOpenAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Plus size={16} />
            Add Recipient Number
          </button>
        </div>
      </div>

      {/* Main Grid: Bot Config & Live Test */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        {/* OpenWA Bot Config Card */}
        <div style={{
          backgroundColor: 'var(--bg-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-current)' }}>
                OpenWA Bot Settings
              </h3>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={e => setIsEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
              />
              <span style={{ color: isEnabled ? '#25D366' : 'var(--text-muted-current)' }}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Session Status Banner */}
          <div style={{
            marginBottom: '1rem',
            padding: '0.65rem 0.75rem',
            borderRadius: '8px',
            backgroundColor: sessionInfo?.status === 'ready' 
              ? 'rgba(34, 197, 94, 0.08)' 
              : sessionInfo?.status === 'qr_ready' 
                ? 'rgba(239, 68, 68, 0.08)' 
                : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${sessionInfo?.status === 'ready' 
              ? 'rgba(34, 197, 94, 0.25)' 
              : sessionInfo?.status === 'qr_ready' 
                ? 'rgba(239, 68, 68, 0.25)' 
                : 'rgba(245, 158, 11, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: sessionInfo?.status === 'ready' ? '#22c55e' : sessionInfo?.status === 'qr_ready' ? '#ef4444' : '#f59e0b',
                boxShadow: sessionInfo?.status === 'ready' ? '0 0 6px #22c55e' : 'none'
              }} />
              <span style={{ 
                fontWeight: '600', 
                color: sessionInfo?.status === 'ready' ? '#16a34a' : sessionInfo?.status === 'qr_ready' ? '#dc2626' : '#d97706' 
              }}>
                {sessionInfo?.status === 'ready'
                  ? `🟢 Active Session: ${sessionInfo.name || 'factory-admin'} (${sessionInfo.phone ? `+${sessionInfo.phone}` : 'Connected'})`
                  : sessionInfo?.status === 'qr_ready'
                    ? `⚠️ WhatsApp Session Logged Out / Needs QR Scan`
                    : checkingSession ? 'Checking Render Bot session...' : 'Render Bot Session: Standby'}
              </span>
            </div>
            <button
              type="button"
              onClick={checkBotSession}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
              title="Re-check session"
            >
              <RefreshCw size={14} style={checkingSession ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>

          {/* QR Code Scan Box if QR is ready */}
          {sessionInfo?.status === 'qr_ready' && qrCode && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px dashed #ef4444',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#b91c1c', marginBottom: '0.25rem' }}>
                📱 Scan QR Code to Connect WhatsApp
              </div>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>
                Open WhatsApp on your phone → Settings / Menu → <b>Linked Devices</b> → Link a Device:
              </p>
              <div style={{ display: 'inline-block', padding: '8px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={checkBotSession}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  I've Scanned the QR Code
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                RENDER BOT URL
              </label>
              <input
                type="url"
                value={botUrl}
                onChange={e => setBotUrl(e.target.value)}
                placeholder="https://openwa-attendance-bot.onrender.com"
                required
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-current)',
                  backgroundColor: 'var(--bg-input, transparent)',
                  color: 'var(--text-current)',
                  fontSize: '0.875rem'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '0.2rem', display: 'block' }}>
                Shared session bot hosted on Render.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                API / MASTER KEY
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Master Key or Auth Token"
                  style={{
                    width: '100%',
                    padding: '0.55rem 2.25rem 0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--bg-input, transparent)',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted-current)',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                  ENDPOINT
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  placeholder="/sendText"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--bg-input, transparent)',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingSettings}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: savingSettings ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {savingSettings ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={15} />}
                  Save Config
                </button>
              </div>
            </div>

            {settingsStatus && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                backgroundColor: settingsStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: settingsStatus.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${settingsStatus.type === 'success' ? '#86efac' : '#fca5a5'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {settingsStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {settingsStatus.message}
              </div>
            )}
          </form>
        </div>

        {/* Live Test Console Card */}
        <div style={{
          backgroundColor: 'var(--bg-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="#25D366" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-current)' }}>
                Test OpenWA Bot
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.05))', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Live Ping
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                TEST PHONE NUMBER
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="e.g. 9876543210 (10 digits)"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-current)',
                  backgroundColor: 'var(--bg-input, transparent)',
                  color: 'var(--text-current)',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                MESSAGE PREVIEW
              </label>
              <textarea
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-current)',
                  backgroundColor: 'var(--bg-input, transparent)',
                  color: 'var(--text-current)',
                  fontSize: '0.8125rem',
                  resize: 'none'
                }}
              />
            </div>

            <button
              onClick={() => handleSendLiveTest()}
              disabled={sendingTest || !testPhone.trim()}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: '#25D366',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: (sendingTest || !testPhone.trim()) ? 'not-allowed' : 'pointer',
                opacity: (sendingTest || !testPhone.trim()) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: 'auto'
              }}
            >
              {sendingTest ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Sending via Render Bot...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Test WhatsApp Message
                </>
              )}
            </button>

            {testResult && (
              <div style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                backgroundColor: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: testResult.success ? '#16a34a' : '#dc2626',
                border: `1px solid ${testResult.success ? '#86efac' : '#fca5a5'}`,
                wordBreak: 'break-all'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.2rem' }}>
                  {testResult.success ? '✅ Test Message Dispatched Successfully!' : '❌ Dispatch Failed:'}
                </div>
                <div>{testResult.success ? JSON.stringify(testResult.data) : testResult.error}</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Recipient Numbers Directory Section */}
      <div style={{
        backgroundColor: 'var(--bg-current)',
        border: '1px solid var(--border-current)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        
        {/* Directory Header & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-current)' }}>
              Registered Notification Numbers ({contacts.length})
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted-current)' }}>
              These specific phone numbers will automatically receive WhatsApp alerts when events occur (such as new DOF creation).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '300px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, phone..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-current)',
                  backgroundColor: 'var(--bg-input, transparent)',
                  color: 'var(--text-current)',
                  fontSize: '0.8125rem'
                }}
              />
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        {loadingContacts ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted-current)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
            <p>Loading notification numbers...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem 1rem', 
            border: '1px dashed var(--border-current)', 
            borderRadius: '8px',
            backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.02))'
          }}>
            <Phone size={36} color="var(--text-muted-current)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-current)' }}>No WhatsApp Numbers Added Yet</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted-current)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Add the specific phone numbers of admins or managers who should receive instant WhatsApp messages when DOFs are created.
            </p>
            <button
              onClick={handleOpenAddModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Add First Number
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-current)', textAlign: 'left', color: 'var(--text-muted-current)' }}>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Contact Name</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>WhatsApp Phone</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>Designation / Tag</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>DOF Alerts</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(contact => {
                  const formatted = formatPhoneNumber(contact.phone);
                  return (
                    <tr key={contact.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--text-current)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(var(--color-primary-rgb, 128,0,0), 0.1)',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{contact.name}</span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-current)', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        +{formatted?.clean || contact.phone}
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.05))',
                          color: 'var(--text-current)',
                          border: '1px solid var(--border-current)'
                        }}>
                          {contact.designation || 'Admin'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleNotifyDof(contact)}
                          title={contact.notify_dof ? 'Receiving DOF alerts' : 'DOF alerts muted'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: contact.notify_dof ? '#25D366' : 'var(--text-muted-current)'
                          }}
                        >
                          {contact.notify_dof ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#16a34a', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              <Bell size={13} /> Active
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.05))', padding: '2px 6px', borderRadius: '4px' }}>
                              Off
                            </span>
                          )}
                        </button>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleActive(contact)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          {contact.is_active ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#16a34a', fontWeight: '600' }}>
                              <CheckCircle2 size={15} /> Active
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#dc2626', fontWeight: '600' }}>
                              <XCircle size={15} /> Inactive
                            </span>
                          )}
                        </button>
                      </td>

                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            onClick={() => {
                              setTestPhone(contact.phone);
                              handleSendLiveTest(contact.phone, `👋 Hello ${contact.name}! This is a live test notification from Ashok Textiles ERP.`);
                            }}
                            title="Send quick test WhatsApp message"
                            style={{
                              padding: '0.35rem 0.6rem',
                              backgroundColor: 'rgba(37, 211, 102, 0.1)',
                              color: '#25D366',
                              border: '1px solid rgba(37, 211, 102, 0.3)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Send size={13} /> Test
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(contact)}
                            title="Edit Contact"
                            style={{
                              padding: '0.35rem 0.5rem',
                              background: 'none',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--text-current)'
                            }}
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteContact(contact)}
                            title="Delete Contact"
                            style={{
                              padding: '0.35rem 0.5rem',
                              background: 'none',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#dc2626'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
                {editingContact ? 'Edit WhatsApp Contact' : 'Add WhatsApp Recipient Number'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                  CONTACT NAME *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Madhanraj (Admin)"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--bg-input, transparent)',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                  MOBILE NUMBER * (India 10 digits or International with country code)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 9876543210 or 919876543210"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--bg-input, transparent)',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem'
                  }}
                />
                {formData.phone && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '0.25rem', display: 'block' }}>
                    Preview format: +{formatPhoneNumber(formData.phone)?.clean}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)', marginBottom: '0.3rem' }}>
                  DESIGNATION / ROLE
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={e => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Director, Production Head, Merchandiser"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--bg-input, transparent)',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.03))', 
                borderRadius: '8px', 
                border: '1px solid var(--border-current)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.notify_dof}
                    onChange={e => setFormData({ ...formData, notify_dof: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontWeight: '600', color: 'var(--text-current)' }}>
                    Receive New DOF Creation Alerts
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
                  />
                  <span style={{ fontWeight: '600', color: 'var(--text-current)' }}>
                    Active Status (Enabled)
                  </span>
                </label>
              </div>

              {formError && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  fontSize: '0.8125rem'
                }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-current)',
                    borderRadius: '6px',
                    color: 'var(--text-current)',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingContact}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: savingContact ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingContact ? 'Saving...' : editingContact ? 'Update Contact' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
