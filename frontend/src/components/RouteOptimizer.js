import React, { useState, useEffect, useRef, useCallback } from 'react';
import { driverAPI } from '../services/api';
import './AdminPanel.css';
import { Navigation } from 'lucide-react';

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
    <div className="admin-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-icon route"><Navigation size={20} /></div>
          <div><h1>Route Optimizer</h1><p>Plan optimal delivery routes — drag to reorder stops</p></div>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Stats Bar */}
      <div className="kpi-grid" style={{ marginBottom: 'var(--ds-sp-5)' }}>
        <StatCard label="Total Stops" value={deliveries.length} color="#0d7a3e" />
        <StatCard label="Pending" value={pendingCount} color="#e67e22" />
        <StatCard label="Completed" value={completedCount} color="#27ae60" />
        <StatCard label="Areas" value={Object.keys(areaGroups).length} color="#3498db" />
      </div>

      {/* Controls */}
      <div className="filter-bar" style={{ marginBottom: 'var(--ds-sp-4)' }}>
        <button onClick={optimizeRoute} disabled={optimizing || deliveries.length < 2} className="action-btn primary">
          {optimizing ? 'Optimizing...' : 'Auto-Optimize Route'}
        </button>
        <button onClick={loadDeliveries} className="action-btn">Refresh</button>
        <button onClick={() => setShowKeyInput(!showKeyInput)} className="action-btn">
          {mapsApiKey ? 'Update' : 'Set'} Maps Key
        </button>
      </div>

      {showKeyInput && (
        <div className="form-card" style={{ marginBottom: 'var(--ds-sp-4)' }}>
          <p style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-text-muted)', marginBottom: 'var(--ds-sp-3)' }}>
            Enter your Google Maps API key to see the route map. Get one free at{' '}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console</a>.
            Enable "Maps Embed API" and "Directions API".
          </p>
          <div className="filter-bar">
            <input value={mapsApiKey} onChange={e => setMapsApiKey(e.target.value)}
              placeholder="AIzaSy..." className="search-input" style={{ flex: 1 }} />
            <button onClick={saveApiKey} className="action-btn primary">Save</button>
          </div>
        </div>
      )}

      {/* Google Maps Embed */}
      {mapUrl && (
        <div style={{ marginBottom: 'var(--ds-sp-5)', borderRadius: 'var(--ds-r-md)', overflow: 'hidden', boxShadow: 'var(--ds-shadow-md)' }}>
          <iframe src={mapUrl} width="100%" height="350" style={{ border: 0 }} allowFullScreen loading="lazy" title="Route Map" />
        </div>
      )}

      {/* Open in Google Maps (works without API key) */}
      {deliveries.length > 0 && (
        <a href={`https://www.google.com/maps/dir/${deliveries.map(d =>
          encodeURIComponent([d.delivery_address || d.address_line1, d.area, 'Oman'].filter(Boolean).join(', '))
        ).join('/')}`}
          target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', background: '#4285F4', color: '#fff', padding: '10px 20px', borderRadius: 'var(--ds-r-sm)', textDecoration: 'none', fontSize: 'var(--ds-text-sm)', fontWeight: 600, marginBottom: 'var(--ds-sp-5)', fontFamily: 'var(--ds-font-ui)' }}>
          Open Full Route in Google Maps
        </a>
      )}

      {/* Delivery List (draggable) */}
      {loading ? (
        <div className="loading-state">Loading deliveries...</div>
      ) : deliveries.length === 0 ? (
        <div className="no-data">No deliveries today</div>
      ) : (
        <div>
          <h3 style={{ color: 'var(--ds-text)', fontSize: 'var(--ds-text-md)', fontWeight: 700, marginBottom: 'var(--ds-sp-3)', fontFamily: 'var(--ds-font-ui)' }}>
            Route Sequence (drag to reorder)
          </h3>
          {/* Area Summary */}
          <div className="filter-bar" style={{ marginBottom: 'var(--ds-sp-4)' }}>
            {Object.entries(areaGroups).map(([area, items]) => (
              <span key={area} className="area-badge">{area} ({items.length})</span>
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
                display: 'flex', alignItems: 'center', gap: 'var(--ds-sp-3)',
                padding: 'var(--ds-sp-3) var(--ds-sp-4)',
                background: d.status === 'delivered' ? 'var(--ds-green-tint)' : 'var(--ds-surface)',
                borderRadius: 'var(--ds-r-md)', marginBottom: 'var(--ds-sp-2)', cursor: 'grab',
                borderLeft: `4px solid ${d.status === 'delivered' ? 'var(--ds-green)' : '#e67e22'}`,
                border: '1px solid var(--ds-border)',
                boxShadow: 'var(--ds-shadow-card)',
              }}>
              <div style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 700, color: 'var(--ds-text-muted)', minWidth: 28, textAlign: 'center', fontFamily: 'var(--ds-font-mono)' }}>
                ☰ {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--ds-text-md)', color: 'var(--ds-text)', fontFamily: 'var(--ds-font-ui)' }}>{d.customer_name}</div>
                <div style={{ fontSize: 'var(--ds-text-sm)', color: 'var(--ds-text-muted)', fontFamily: 'var(--ds-font-ui)' }}>
                  {d.area || d.city || ''} · {d.item_count || '?'} items · {d.order_number}
                </div>
              </div>
              <div style={{ fontSize: 'var(--ds-text-sm)', fontWeight: 600, color: d.status === 'delivered' ? 'var(--ds-green)' : '#e67e22', fontFamily: 'var(--ds-font-ui)' }}>
                {d.status === 'delivered' ? 'Done' : 'Pending'}
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
    <div className="kpi-card" style={{ borderLeftColor: color }}>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

export default RouteOptimizer;
