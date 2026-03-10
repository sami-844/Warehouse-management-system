import React, { useState, useEffect, useCallback } from 'react';
import SignatureCapture from './SignatureCapture';
import { driverAPI } from '../services/api';

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
      <div style={S.app}>
        <div style={S.header}>
          <button onClick={goBack} style={S.backBtn}>← Back</button>
          <span style={S.headerTitle}>Delivery #{d.delivery_number || d.id}</span>
        </div>

        <div style={S.card}>
          <div style={S.cardLabel}>Customer</div>
          <div style={S.cardTitle}>{d.customer_name}</div>
          {d.customer_phone && <a href={`tel:${d.customer_phone}`} style={S.phoneLink}>{d.customer_phone}</a>}
          <div style={S.address}>{d.delivery_address || d.address_line1 || ''}{d.area ? ` — ${d.area}` : ''}</div>
          {d.contact_person && <div style={S.meta}>Contact: {d.contact_person}</div>}
          {d.order_notes && <div style={{ ...S.meta, marginTop: 8, fontStyle: 'italic' }}>{d.order_notes}</div>}
        </div>

        {/* Items */}
        <div style={S.card}>
          <div style={S.cardLabel}>Items ({detailData?.items?.length || d.item_count || '?'})</div>
          {detailData?.items ? detailData.items.map((item, idx) => (
            <div key={idx} style={S.itemRow}>
              <div style={S.itemName}>{item.name}</div>
              <div style={S.itemQty}>{item.quantity} {item.unit_of_measure || 'pcs'}</div>
            </div>
          )) : <div style={S.meta}>Loading items...</div>}
        </div>

        {/* Completion Section */}
        {d.status !== 'delivered' ? (
          <div style={S.card}>
            <div style={{ ...S.cardLabel, color: '#0d7a3e' }}>Complete Delivery</div>

            {error && <div style={S.errMsg}>{error}</div>}
            {success && <div style={S.okMsg}>{success}</div>}

            <SignatureCapture label="Customer Signature *" onSave={setCustSignature} width={360} height={150} />
            <SignatureCapture label="Driver Signature" onSave={setDriverSig} width={360} height={150} />

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                style={S.textarea} placeholder="Any delivery notes..." rows={3} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={captureGPS} style={S.gpsBtn}>
                {gps ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : 'Capture GPS'}
              </button>
            </div>

            <button onClick={completeDelivery} disabled={completing || !custSignature}
              style={{ ...S.completeBtn, opacity: (custSignature && !completing) ? 1 : 0.5 }}>
              {completing ? 'Processing...' : 'Complete Delivery'}
            </button>
          </div>
        ) : (
          <div style={S.card}>
            <div style={{ textAlign: 'center', padding: 16, color: '#0d7a3e', fontSize: 18, fontWeight: 700 }}>
              Delivery Completed
            </div>
          </div>
        )}

        {onClose && <div style={{ padding: '0 16px 20px' }}><button onClick={onClose} style={S.closeBtn}>Exit Driver Mode</button></div>}
      </div>
    );
  }

  // ── Main List View ──
  return (
    <div style={S.app}>
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>Deliveries</div>
          <div style={S.headerSub}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button onClick={loadDeliveries} style={S.refreshBtn}>↺</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={S.statsRow}>
          <div style={S.statBox}>
            <div style={S.statNum}>{stats.total_deliveries}</div>
            <div style={S.statLabel}>Total</div>
          </div>
          <div style={{ ...S.statBox, borderColor: '#27ae60' }}>
            <div style={{ ...S.statNum, color: '#27ae60' }}>{stats.completed}</div>
            <div style={S.statLabel}>Done</div>
          </div>
          <div style={{ ...S.statBox, borderColor: '#e67e22' }}>
            <div style={{ ...S.statNum, color: '#e67e22' }}>{stats.pending}</div>
            <div style={S.statLabel}>Pending</div>
          </div>
          <div style={{ ...S.statBox, borderColor: '#3498db' }}>
            <div style={{ ...S.statNum, color: '#3498db' }}>{stats.completion_rate}%</div>
            <div style={S.statLabel}>Rate</div>
          </div>
        </div>
      )}

      {error && <div style={S.errMsg}>{error}</div>}
      {success && <div style={S.okMsg}>{success}</div>}

      {loading ? (
        <div style={S.center}>Loading deliveries...</div>
      ) : deliveries.length === 0 ? (
        <div style={S.center}>
          <div style={{ fontSize: 48 }}></div>
          <div style={{ color: '#888', marginTop: 8 }}>No deliveries today</div>
        </div>
      ) : (
        <div style={S.list}>
          {deliveries.map((d, idx) => (
            <div key={d.id} onClick={() => openDelivery(d)} style={{
              ...S.listItem,
              borderLeftColor: d.status === 'delivered' ? '#27ae60' : d.status === 'in_transit' ? '#3498db' : '#e67e22',
            }}>
              <div style={S.listSeq}>#{idx + 1}</div>
              <div style={S.listContent}>
                <div style={S.listName}>{d.customer_name}</div>
                <div style={S.listArea}>{d.area || d.city || d.delivery_address || ''}</div>
                <div style={S.listMeta}>
                  {d.item_count || '?'} items · {d.order_number}
                  {d.total_amount ? ` · OMR ${Number(d.total_amount).toFixed(3)}` : ''}
                </div>
              </div>
              <div style={{
                ...S.statusBadge,
                background: d.status === 'delivered' ? '#e8f8e8' : d.status === 'in_transit' ? '#e8f0f8' : '#fff3e0',
                color: d.status === 'delivered' ? '#27ae60' : d.status === 'in_transit' ? '#3498db' : '#e67e22',
              }}>
                {d.status === 'delivered' ? '' : d.status === 'in_transit' ? '' : ''}
                <span style={{ fontSize: 10 }}>{d.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <div style={{ padding: '16px' }}>
          <button onClick={onClose} style={S.closeBtn}>Exit Driver Mode</button>
        </div>
      )}
    </div>
  );
}

// ── Mobile-first styles ──
const S = {
  app: { maxWidth: 480, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', fontFamily: '-apple-system, system-ui, sans-serif' },
  header: { background: '#0d7a3e', color: '#fff', padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, zIndex: 10 },
  headerTitle: { fontSize: 20, fontWeight: 700 },
  headerSub: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  refreshBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
  backBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 16px' },
  statBox: { background: '#fff', borderRadius: 10, padding: '10px 0', textAlign: 'center', borderBottom: '3px solid #0d7a3e', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statNum: { fontSize: 22, fontWeight: 700, color: '#0d7a3e' },
  statLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { padding: '0 12px 16px' },
  listItem: { background: '#fff', borderRadius: 12, padding: '14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderLeft: '4px solid #e67e22', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  listSeq: { fontSize: 11, fontWeight: 700, color: '#888', minWidth: 24 },
  listContent: { flex: 1 },
  listName: { fontWeight: 700, fontSize: 15, marginBottom: 2 },
  listArea: { fontSize: 12, color: '#666' },
  listMeta: { fontSize: 11, color: '#999', marginTop: 3 },
  statusBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', borderRadius: 8, fontSize: 14 },
  card: { background: '#fff', margin: '12px 16px', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardLabel: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  phoneLink: { color: '#0d7a3e', textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginBottom: 4, fontSize: 14 },
  address: { fontSize: 13, color: '#555' },
  meta: { fontSize: 12, color: '#888' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
  itemName: { fontSize: 14, fontWeight: 500 },
  itemQty: { fontSize: 14, fontWeight: 700, color: '#0d7a3e' },
  label: { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: '#444' },
  textarea: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' },
  gpsBtn: { background: '#3498db', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 1 },
  completeBtn: { width: '100%', background: '#0d7a3e', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  closeBtn: { width: '100%', background: '#666', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  errMsg: { background: '#fce4e4', color: '#c0392b', padding: '10px 16px', margin: '8px 16px', borderRadius: 8, fontSize: 13 },
  okMsg: { background: '#e8f8e8', color: '#0d7a3e', padding: '10px 16px', margin: '8px 16px', borderRadius: 8, fontSize: 13 },
  center: { textAlign: 'center', padding: 40, color: '#888' },
};

export default DriverApp;
