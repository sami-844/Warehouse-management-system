import React, { useState, useEffect, useCallback } from 'react';
import SignatureCapture from './SignatureCapture';
import { driverAPI } from '../services/api';
import './DriverApp.css';

/**
 * DriverApp — Dedicated mobile-first view for delivery drivers.
 * Accessible at /driver route. Shows today's deliveries, allows
 * completion with signature capture and GPS location.
 */
function DriverApp({ user, onClose }) {
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Completion form
  const [custSignature, setCustSignature] = useState('');
  const [driverSig, setDriverSig] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState(null);

  const driverName = user?.full_name || user?.username || '';

  const loadDeliveries = useCallback(() => {
    setLoading(true);
    Promise.all([
      driverAPI.myDeliveries(driverName),
      driverAPI.stats(driverName),
    ]).then(([delRes, statsRes]) => {
      setDeliveries(delRes.deliveries || []);
      setStats(statsRes);
      setLoading(false);
    }).catch(e => {
      setError('Failed to load deliveries');
      setLoading(false);
    });
  }, [driverName]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  const openDelivery = (d) => {
    setSelectedDelivery(d);
    setSuccess(''); setError('');
    driverAPI.deliveryDetail(d.id)
      .then(data => setDetailData(data))
      .catch(() => setError('Failed to load delivery details'));
  };

  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setError('GPS unavailable — delivery will still be recorded'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const completeDelivery = () => {
    if (!selectedDelivery) return;
    if (!custSignature) { setError('Customer signature required'); return; }

    setCompleting(true); setError('');
    driverAPI.completeDelivery(selectedDelivery.id, {
      customer_signature: custSignature,
      driver_signature: driverSig,
      notes: notes,
      latitude: gps?.lat || null,
      longitude: gps?.lng || null,
    }).then(() => {
      setSuccess('Delivery completed!');
      setCompleting(false);
      setCustSignature(''); setDriverSig(''); setNotes(''); setGps(null);
      setSelectedDelivery(null); setDetailData(null);
      loadDeliveries();
    }).catch(e => {
      setError(e.response?.data?.detail || 'Failed to complete delivery');
      setCompleting(false);
    });
  };

  const goBack = () => {
    setSelectedDelivery(null); setDetailData(null);
    setCustSignature(''); setDriverSig(''); setNotes('');
  };

  // ── Delivery Detail / Completion View ──
  if (selectedDelivery) {
    const d = selectedDelivery;
    return (
      <div className="driver-app">
        <div className="driver-header">
          <button onClick={goBack} className="driver-back-btn">Back</button>
          <span className="driver-header-title">Delivery #{d.delivery_number || d.id}</span>
        </div>

        <div className="driver-card">
          <div className="driver-card-label">Customer</div>
          <div className="driver-card-title">{d.customer_name}</div>
          {d.customer_phone && <a href={`tel:${d.customer_phone}`} className="driver-phone-link">{d.customer_phone}</a>}
          <div className="driver-address">{d.delivery_address || d.address_line1 || ''}{d.area ? ` — ${d.area}` : ''}</div>
          {d.contact_person && <div className="driver-meta">Contact: {d.contact_person}</div>}
          {d.order_notes && <div className="driver-meta" style={{ marginTop: 8, fontStyle: 'italic' }}>{d.order_notes}</div>}
        </div>

        {/* Items */}
        <div className="driver-card">
          <div className="driver-card-label">Items ({detailData?.items?.length || d.item_count || '?'})</div>
          {detailData?.items ? detailData.items.map((item, idx) => (
            <div key={idx} className="driver-item-row">
              <div className="driver-item-name">{item.name}</div>
              <div className="driver-item-qty">{item.quantity} {item.unit_of_measure || 'pcs'}</div>
            </div>
          )) : <div className="driver-meta">Loading items...</div>}
        </div>

        {/* Completion Section */}
        {d.status !== 'delivered' ? (
          <div className="driver-card">
            <div className="driver-card-label" style={{ color: '#0d7a3e' }}>Complete Delivery</div>

            {error && <div className="driver-msg-error">{error}</div>}
            {success && <div className="driver-msg-success">{success}</div>}

            <SignatureCapture label="Customer Signature *" onSave={setCustSignature} width={360} height={150} />
            <SignatureCapture label="Driver Signature" onSave={setDriverSig} width={360} height={150} />

            <div style={{ marginBottom: 12 }}>
              <label className="driver-label">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="driver-textarea" placeholder="Any delivery notes..." rows={3} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={captureGPS} className="driver-gps-btn">
                {gps ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Capture GPS'}
              </button>
            </div>

            <button onClick={completeDelivery} disabled={completing || !custSignature}
              className="driver-complete-btn">
              {completing ? 'Processing...' : 'Complete Delivery'}
            </button>
          </div>
        ) : (
          <div className="driver-card">
            <div style={{ textAlign: 'center', padding: 16, color: '#0d7a3e', fontSize: 18, fontWeight: 700 }}>
              Delivery Completed
            </div>
          </div>
        )}

        {onClose && <div style={{ padding: '0 16px 20px' }}><button onClick={onClose} className="driver-close-btn">Exit Driver Mode</button></div>}
      </div>
    );
  }

  // ── Main List View ──
  return (
    <div className="driver-app">
      <div className="driver-header">
        <div>
          <div className="driver-header-title">Deliveries</div>
          <div className="driver-header-sub">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button onClick={loadDeliveries} className="driver-refresh-btn">&#8635;</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="driver-stats">
          <div className="driver-stat-box">
            <div className="driver-stat-num">{stats.total_deliveries}</div>
            <div className="driver-stat-label">Total</div>
          </div>
          <div className="driver-stat-box" style={{ borderBottomColor: '#27ae60' }}>
            <div className="driver-stat-num" style={{ color: '#27ae60' }}>{stats.completed}</div>
            <div className="driver-stat-label">Done</div>
          </div>
          <div className="driver-stat-box" style={{ borderBottomColor: '#e67e22' }}>
            <div className="driver-stat-num" style={{ color: '#e67e22' }}>{stats.pending}</div>
            <div className="driver-stat-label">Pending</div>
          </div>
          <div className="driver-stat-box" style={{ borderBottomColor: '#3498db' }}>
            <div className="driver-stat-num" style={{ color: '#3498db' }}>{stats.completion_rate}%</div>
            <div className="driver-stat-label">Rate</div>
          </div>
        </div>
      )}

      {error && <div className="driver-msg-error">{error}</div>}
      {success && <div className="driver-msg-success">{success}</div>}

      {loading ? (
        <div className="driver-center">Loading deliveries...</div>
      ) : deliveries.length === 0 ? (
        <div className="driver-center">
          <div style={{ color: '#888', marginTop: 8 }}>No deliveries today</div>
        </div>
      ) : (
        <div className="driver-list">
          {deliveries.map((d, idx) => (
            <div key={d.id} onClick={() => openDelivery(d)} className="driver-list-item" style={{
              borderLeftColor: d.status === 'delivered' ? '#27ae60' : d.status === 'in_transit' ? '#3498db' : '#e67e22',
            }}>
              <div className="driver-list-seq">#{idx + 1}</div>
              <div className="driver-list-content">
                <div className="driver-list-name">{d.customer_name}</div>
                <div className="driver-list-area">{d.area || d.city || d.delivery_address || ''}</div>
                <div className="driver-list-meta">
                  {d.item_count || '?'} items · {d.order_number}
                  {d.total_amount ? ` · OMR ${Number(d.total_amount).toFixed(3)}` : ''}
                </div>
              </div>
              <div className="driver-status-badge" style={{
                background: d.status === 'delivered' ? '#e8f8e8' : d.status === 'in_transit' ? '#e8f0f8' : '#fff3e0',
                color: d.status === 'delivered' ? '#27ae60' : d.status === 'in_transit' ? '#3498db' : '#e67e22',
              }}>
                <span style={{ fontSize: 10 }}>{d.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <div style={{ padding: '16px' }}>
          <button onClick={onClose} className="driver-close-btn">Exit Driver Mode</button>
        </div>
      )}
    </div>
  );
}

export default DriverApp;
