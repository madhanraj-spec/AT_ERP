import React, { useState } from 'react';
import { mockProductionJobs, mockForms } from '../../lib/mockData';
import { PlayCircle, CheckCircle, Clock } from 'lucide-react';

export default function ProductionBoard() {
  const [jobs, setJobs] = useState(mockProductionJobs);

  const startJob = (id) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, status: 'in_progress' } : j));
  };

  const completeJob = (id) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, status: 'completed' } : j));
  };

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Production Kanban Board</h1>
      <p style={{ color: 'var(--text-muted-current)', marginBottom: '2rem' }}>
        Track ongoing production jobs across in-house and vendor units.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Scheduled Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)' }}>
            <Clock size={18} /> Scheduled
          </h3>
          {jobs.filter(j => j.status === 'pending' || j.status === 'scheduled').map(job => (
             <JobCard key={job.id} job={job} action={() => startJob(job.id)} actionLabel="Start Job" icon={<PlayCircle size={16}/>} btnClass="btn-primary" />
          ))}
          {jobs.filter(j => j.status === 'pending' || j.status === 'scheduled').length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted-current)' }}>No pending jobs</div>
          )}
        </div>

        {/* In Progress Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>
            <PlayCircle size={18} /> In Progress
          </h3>
          {jobs.filter(j => j.status === 'in_progress').map(job => (
             <JobCard key={job.id} job={job} action={() => completeJob(job.id)} actionLabel="Mark Complete" icon={<CheckCircle size={16}/>} btnClass="btn-success" />
          ))}
        </div>

        {/* Completed Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
            <CheckCircle size={18} /> Completed
          </h3>
          {jobs.filter(j => j.status === 'completed').map(job => (
             <JobCard key={job.id} job={job} action={null} />
          ))}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, action, actionLabel, icon, btnClass }) {
  const form = mockForms.find(f => f.id === job.form_id);
  
  return (
    <div className="glass-panel fade-in hover-lift" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{job.job_type}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>{job.id}</span>
      </div>
      
      <div>
        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Vendor: {job.vendor_name || 'Unassigned'}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Order Ref: {form?.order_id}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
         <div>Qty Issued: <strong>{job.qty_issued || 0}</strong></div>
         <div>Qty Received: <strong>{job.qty_received || 0}</strong></div>
      </div>

      {action && (
        <button onClick={action} className={`btn ${btnClass}`} style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem', backgroundColor: btnClass==='btn-success' ? 'var(--color-success)' : '' }}>
          {icon} {actionLabel}
        </button>
      )}
    </div>
  );
}
