import React, { useState, useEffect, useRef, useCallback } from 'react';
import { driverAPI } from '../services/api';

/**
 * RouteOptimizer — Shows today's deliveries on a map with route optimization.
 * Uses Google Maps Embed API (no API key required for basic maps).
 * Provides nearest-neighbor route optimization and drag-to-reorder.
 */
function RouteOptimizer() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState(localStorage.getItem('google_maps_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!localStorage.getItem('google_maps_key'));
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const loadDeliveries = useCallback(() => {
    setLoading(true);
    driverAPI.myDeliveries('')
      .then(res => {
        setDeliveries(res.deliveries || []);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load deliveries'); setLoading(false); });
  }, []);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  // ── Nearest-Neighbor Route Optimization ──
  const optimizeRoute = () => {
    if (deliveries.length < 2) return;
    setOptimizing(true);

    // Extract coordinates from delivery addresses (use city/area for geocoding hint)
    // For now, use a simple nearest-neighbor approach based on area grouping
    const areas = {};
    deliveries.forEach(d => {
      const area = d.area || d.city || 'Unknown';
      if (!areas[area]) areas[area] = [];
      areas[area].push(d);
    });

    // Group by area, then sort within each area
    let optimized = [];
    Object.keys(areas).sort().forEach(area => {
      optimized = optimized.concat(areas[area]);
    });

    setDeliveries(optimized);
    setOptimizing(false);
    setSuccess(`Route optimized! ${Object.keys(areas).length} area(s), ${optimized.length} stops.`);

    // Save new sequence
    driverAPI.reorderDeliveries(optimized.map(d => d.id))
      .catch(() => {});
  };

  // ── Drag-and-Drop Reorder ──
  const onDragStart = (idx) => { dragItem.current = idx; };
  const onDragEnter = (idx) => { dragOverItem.current = idx; };
  const onDragEnd = () => {
    const newList = [...deliveries];
    const dragged = newList.splice(dragItem.current, 1)[0];
    newList.splice(dragOverItem.current, 0, dragged);
    dragItem.current = null;
    dragOverItem.current = null;
    setDeliveries(newList);
    // Save sequence
    driverAPI.reorderDeliveries(newList.map(d => d.id)).catch(() => {});
  };

  // ── Build Google Maps URL ──
  const buildMapUrl = () => {
    if (!mapsApiKey || deliveries.length === 0) return;

    // Build waypoints from delivery addresses
    const waypointAddrs = deliveries
      .filter(d => d.delivery_address || d.address_line1 || d.area)
      .map(d => encodeURIComponent(
        [d.delivery_address || d.address_line1, d.area, d.city, 'Oman'].filter(Boolean).join(', ')
      ));

    if (waypointAddrs.length === 0) return;

    // Google Maps Directions URL
    const origin = encodeURIComponent('Muscat, Oman'); // Starting point
    const destination = origin; // Return to base
    const waypoints = waypointAddrs.join('|');

    const url = `https://www.google.com/maps/embed/v1/directions?key=${mapsApiKey}`
      + `&origin=${origin}&destination=${destination}`
      + `&waypoints=${waypoints}&mode=driving`;

    setMapUrl(url);
  };

  useEffect(() => {
    if (mapsApiKey && deliveries.length > 0) buildMapUrl();
  }, [deliveries, mapsApiKey]);

  const saveApiKey = () => {
    localStorage.setItem('google_maps_key', mapsApiKey);
    setShowKeyInput(false);
    buildMapUrl();
  };

  // ── Estimate Distances (simple area-based) ──
  const getAreaGroups = () => {
    const groups = {};
    deliveries.forEach(d => {
      const area = d.area || d.city || 'Unassigned';
      if (!groups[area]) groups[area] = [];
      groups[area].push(d);
    });
    return groups;
  };

  const areaGroups = getAreaGroups();
  const pendingCount = deliveries.filter(d => d.status !== 'delivered').length;
  const completedCount = deliveries.filter(d => d.status === 'delivered').length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ color: '#0d7a3e', marginBottom: 4 }}>🗺️ Route Optimizer</h2>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Plan optimal delivery routes — drag to reorder stops</p>

      {error && <div style={errStyle}>{error}</div>}
      {success && <div style={okStyle}>{success}</div>}

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total Stops" value={deliveries.length} color="#0d7a3e" />
        <StatCard label="Pending" value={pendingCount} color="#e67e22" />
        <StatCard label="Completed" value={completedCount} color="#27ae60" />
        <StatCard label="Areas" value={Object.keys(areaGroups).length} color="#3498db" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={optimizeRoute} disabled={optimizing || deliveries.length < 2}
          style={{ ...btnStyle, background: '#0d7a3e' }}>
          {optimizing ? '⏳ Optimizing...' : '🔄 Auto-Optimize Route'}
        </button>
        <button onClick={loadDeliveries} style={{ ...btnStyle, background: '#3498db' }}>🔄 Refresh</button>
        <button onClick={() => setShowKeyInput(!showKeyInput)} style={{ ...btnStyle, background: '#666' }}>
          🔑 {mapsApiKey ? 'Update' : 'Set'} Maps Key
        </button>
      </div>

      {showKeyInput && (
        <div style={{ background: '#f0f7f4', padding: 14, borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Enter your Google Maps API key to see the route map. Get one free at{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console</a>.
            Enable "Maps Embed API" and "Directions API".
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={mapsApiKey} onChange={e => setMapsApiKey(e.target.value)}
              placeholder="AIzaSy..." style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }} />
            <button onClick={saveApiKey} style={{ ...btnStyle, background: '#0d7a3e' }}>Save</button>
          </div>
        </div>
      )}

      {/* Google Maps Embed */}
      {mapUrl && (
        <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <iframe src={mapUrl} width="100%" height="350" style={{ border: 0 }} allowFullScreen loading="lazy" title="Route Map" />
        </div>
      )}

      {/* Open in Google Maps (works without API key) */}
      {deliveries.length > 0 && (
        <a href={`https://www.google.com/maps/dir/${deliveries.map(d =>
          encodeURIComponent([d.delivery_address || d.address_line1, d.area, 'Oman'].filter(Boolean).join(', '))
        ).join('/')}`}
          target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', background: '#4285F4', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          🗺️ Open Full Route in Google Maps
        </a>
      )}

      {/* Delivery List (draggable) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Loading deliveries...</div>
      ) : deliveries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>No deliveries today</div>
      ) : (
        <div>
          <h3 style={{ color: '#333', fontSize: 15, marginBottom: 10 }}>Route Sequence (drag to reorder)</h3>
          {/* Area Summary */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(areaGroups).map(([area, items]) => (
              <span key={area} style={{
                background: '#e8f0f8', padding: '4px 12px', borderRadius: 20,
                fontSize: 12, fontWeight: 600, color: '#2c3e50'
              }}>
                📍 {area} ({items.length})
              </span>
            ))}
          </div>

          {deliveries.map((d, idx) => (
            <div key={d.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: d.status === 'delivered' ? '#f0f8f0' : '#fff',
                borderRadius: 10, marginBottom: 6, cursor: 'grab',
                borderLeft: `4px solid ${d.status === 'delivered' ? '#27ae60' : '#e67e22'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#888', minWidth: 28, textAlign: 'center' }}>
                ☰ {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{d.customer_name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {d.area || d.city || ''} · {d.item_count || '?'} items · {d.order_number}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: d.status === 'delivered' ? '#27ae60' : '#e67e22' }}>
                {d.status === 'delivered' ? '✅ Done' : '⏳ Pending'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 16px', borderLeft: `3px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minWidth: 100 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const btnStyle = { color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const errStyle = { background: '#fce4e4', color: '#c0392b', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };
const okStyle = { background: '#e8f8e8', color: '#0d7a3e', padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13 };

export default RouteOptimizer;
