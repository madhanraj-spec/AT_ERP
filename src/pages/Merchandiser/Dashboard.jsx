import React from 'react';
import { mockOrders } from '../../lib/mockData';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

export default function MerchandiserDashboard() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>My Orders</h1>
          <p style={{ color: 'var(--text-muted-current)', margin: 0 }}>Manage your fabric orders and production tracking.</p>
        </div>
        <Link to="/merchandiser/create-order" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <PlusCircle size={18} />
          Create Order
        </Link>
      </div>

      <div className="glass-panel" style={{ padding: '0' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Buyer</th>
                <th>Date / Delivery</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map(order => (
                <tr key={order.id} className="fade-in">
                  <td style={{ fontWeight: 500 }}>{order.id}</td>
                  <td>{order.buyer_name}</td>
                  <td>
                    <div style={{ fontSize: '0.75rem' }}>Ord: {order.order_date}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Del: {order.delivery_date}</div>
                  </td>
                  <td>{order.total_quantity}</td>
                  <td>
                     <span className={`badge badge-${order.status === 'approved' ? 'success' : 'warning'}`}>
                       {order.status}
                     </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>View</button>
                  </td>
                </tr>
              ))}
              {mockOrders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                    No orders found. Create your first order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
