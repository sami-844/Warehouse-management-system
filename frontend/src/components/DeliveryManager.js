import LoadingSpinner from './LoadingSpinner';
import React, { useState, useEffect } from 'react';
import { salesAPI, messagingAPI } from '../services/api';
import './Sales.css';
import { Truck, Camera, MapPin } from 'lucide-react';

function DeliveryManager() {
  const [todayData, setTodayData] = useState(null);
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [podModal, setPodModal] = useState(null);
  const [podLoading, setPodLoading] = useState(false);

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

  const sendDeliveryMsg = async (d) => {
    try {
      const res = await messagingAPI.sendDeliveryNotification(d.id);
      setMessage({ text: `Dispatch notification sent: ${res.message_preview || 'Queued'}`, type: 'success' });
    } catch(e) { setMessage({ text: e.response?.data?.detail || 'Failed to send notification', type: 'error' }); }
  };

  const viewPOD = async (deliveryId) => {
    setPodLoading(true);
    try {
      const pod = await salesAPI.getDeliveryPOD(deliveryId);
      setPodModal(pod);
    } catch { setMessage({ text: 'Failed to load POD', type: 'error' }); }
    finally { setPodLoading(false); }
  };

  const statusIcon = () => '';
  const statusColor = (s) => ({ scheduled: '#2563eb', in_transit: '#d97706', delivered: '#16a34a', cancelled: '#dc2626' }[s] || '#6b7280');

  return (
    <div className="sales-container">
      <div className="page-header"><div className="header-content"><div className="header-icon delivery"><Truck size={20} /></div><div><h1>Deliveries</h1><p>Daily delivery schedule and tracking</p></div></div></div>

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
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {d.status !== 'delivered' && (
                          <button className="complete-btn" onClick={() => completeDelivery(d.id)}>Mark Delivered</button>
                        )}
                        <button onClick={() => sendDeliveryMsg(d)} style={{ padding: '5px 10px', fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer' }}>Notify</button>
                      </div>
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
          {loading ? <LoadingSpinner /> : (
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
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {d.status !== 'delivered' && <button className="complete-btn small" onClick={() => completeDelivery(d.id)}>Done</button>}
                        {d.status === 'delivered' && (
                          <button onClick={() => viewPOD(d.id)} style={{
                            padding: '3px 8px', fontSize: 11, background: '#eff6ff', color: '#1d4ed8',
                            border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}><Camera size={11} /> POD</button>
                        )}
                        <button onClick={() => sendDeliveryMsg(d)} style={{ padding: '3px 8px', fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer' }}>Notify</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* POD Modal */}
      {podLoading && <LoadingSpinner text="Loading POD..." />}
      {podModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setPodModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, minWidth: 400, maxWidth: '90vw', maxHeight: '85vh',
            overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Proof of Delivery</h3>
              <button onClick={() => setPodModal(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280',
              }}>X</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Delivery Info */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150, background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Delivered</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{podModal.actual_delivery_date || '-'}</div>
                </div>
                {podModal.pod_captured_at && (
                  <div style={{ flex: 1, minWidth: 150, background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>POD Captured</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{podModal.pod_captured_at}</div>
                  </div>
                )}
              </div>

              {/* GPS Location */}
              {podModal.delivery_latitude && podModal.delivery_longitude && (
                <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} /> GPS Location
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${podModal.delivery_latitude},${podModal.delivery_longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'underline', fontFamily: 'var(--ds-font-mono)' }}
                  >
                    {podModal.delivery_latitude.toFixed(6)}, {podModal.delivery_longitude.toFixed(6)}
                  </a>
                </div>
              )}

              {/* POD Photo */}
              {podModal.pod_photo_base64 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
                    Delivery Photo
                  </div>
                  <img src={podModal.pod_photo_base64} alt="POD"
                    style={{ width: '100%', maxHeight: 350, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>
              )}

              {/* Signature */}
              {podModal.signature_image && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
                    Customer Signature
                  </div>
                  <img src={podModal.signature_image} alt="Signature"
                    style={{ maxWidth: 300, height: 100, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }} />
                </div>
              )}

              {/* Notes */}
              {podModal.delivery_notes && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Notes</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{podModal.delivery_notes}</div>
                </div>
              )}

              {!podModal.pod_photo_base64 && !podModal.signature_image && !podModal.delivery_latitude && (
                <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                  No proof of delivery data captured for this delivery
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default DeliveryManager;