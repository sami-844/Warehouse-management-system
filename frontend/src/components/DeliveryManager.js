import React, { useState, useEffect } from 'react';
import { salesAPI } from '../services/api';
import './Sales.css';

function DeliveryManager() {
  const [todayData, setTodayData] = useState(null);
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => { loadToday(); loadAll(); }, []);

  const loadToday = async () => { try { const res = await salesAPI.todayDeliveries(); setTodayData(res || { date: new Date().toISOString().slice(0,10), total_deliveries: 0, by_area: {} }); } catch(e) { console.error(e); setTodayData({ date: new Date().toISOString().slice(0,10), total_deliveries: 0, by_area: {} }); } };
  const loadAll = async () => { setLoading(true); try { const res = await salesAPI.listDeliveries(); setAllDeliveries(Array.isArray(res) ? res : res?.deliveries || []); } catch(e) {} finally { setLoading(false); } };

  const completeDelivery = async (deliveryId) => {
    try {
      await salesAPI.completeDelivery(deliveryId, { actual_delivery_date: new Date().toISOString().slice(0, 10) });
      setMessage({ text: 'Delivery completed!', type: 'success' });
      loadToday(); loadAll();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const statusIcon = () => '';
  const statusColor = (s) => ({ scheduled: '#2563eb', in_transit: '#d97706', delivered: '#16a34a', cancelled: '#dc2626' }[s] || '#6b7280');

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon delivery"></div><div><h1>Deliveries</h1><p>Daily delivery schedule and tracking</p></div></div></div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="tab-bar">
        <button className={`tab-btn ${view === 'today' ? 'active' : ''}`} onClick={() => setView('today')}>Today's Schedule</button>
        <button className={`tab-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>All Deliveries</button>
      </div>

      {view === 'today' && todayData && (
        <div className="tab-content">
          <div className="today-header">
            <h3>{todayData.date} — {todayData.total_deliveries} deliveries</h3>
          </div>
          {!todayData.by_area || Object.keys(todayData.by_area).length === 0 ? <div className="no-data">No deliveries scheduled for today</div> :
            Object.entries(todayData.by_area).map(([area, deliveries]) => (
              <div key={area} className="area-group">
                <div className="area-header"><span className="area-name">{area}</span><span className="area-count">{deliveries.length} stops</span></div>
                <div className="delivery-cards">
                  {deliveries.map(d => (
                    <div key={d.id} className={`delivery-card ${d.status}`}>
                      <div className="dc-header">
                        <span className="dc-order">{d.order_number}</span>
                        <span className="status-pill" style={{ backgroundColor: statusColor(d.status) }}>{statusIcon(d.status)} {d.status}</span>
                      </div>
                      <div className="dc-customer">{d.customer}</div>
                      <div className="dc-address">{d.address || 'No address'}</div>
                      <div className="dc-footer">
                        <span className="dc-driver">{d.driver || 'Unassigned'}</span>
                        <span className="dc-total">{(d.total || 0).toFixed(3)} OMR</span>
                      </div>
                      {d.status !== 'delivered' && (
                        <button className="complete-btn" onClick={() => completeDelivery(d.id)}>Mark Delivered</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {view === 'all' && (
        <div className="tab-content">
          {loading ? <div className="loading-state">Loading...</div> : (
            <table className="data-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Area</th><th>Driver</th><th>Vehicle</th><th>Scheduled</th><th>Delivered</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {allDeliveries.length === 0 ? <tr><td colSpan="10" className="no-data">No deliveries</td></tr> :
                  allDeliveries.map(d => (
                    <tr key={d.id}>
                      <td className="code">{d.order_number}</td><td>{d.customer_name}</td>
                      <td><span className="area-badge">{d.area || '-'}</span></td>
                      <td>{d.driver || '-'}</td><td>{d.vehicle || '-'}</td>
                      <td>{d.scheduled_date || '-'}</td><td>{d.actual_date || '-'}</td>
                      <td className="value">{(d.total || 0).toFixed(3)}</td>
                      <td><span className="status-pill" style={{ backgroundColor: statusColor(d.status) }}>{d.status}</span></td>
                      <td>{d.status !== 'delivered' && <button className="complete-btn small" onClick={() => completeDelivery(d.id)}>Done</button>}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
export default DeliveryManager;