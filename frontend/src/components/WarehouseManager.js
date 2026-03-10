import React, { useState, useEffect } from 'react';
import { warehouseAPI } from '../services/api';
import './WarehouseManager.css';
import { Warehouse } from 'lucide-react';

function WarehouseManager() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', location_type: 'zone', parent_id: '', address_line1: '', city: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [whDetail, setWhDetail] = useState(null);

  useEffect(() => { loadWarehouses(); }, []);

  const loadWarehouses = async () => { setLoading(true); try { setWarehouses(await warehouseAPI.list()); } catch(e) { console.error(e); } finally { setLoading(false); } };

  const handleCreate = async (e) => {
    e.preventDefault(); setMessage({ text: '', type: '' });
    try {
      const data = { ...formData }; if (!data.parent_id) delete data.parent_id; else data.parent_id = parseInt(data.parent_id);
      await warehouseAPI.create(data);
      setMessage({ text: 'Warehouse created!', type: 'success' }); setShowForm(false);
      setFormData({ code: '', name: '', location_type: 'zone', parent_id: '', address_line1: '', city: '' }); loadWarehouses();
    } catch(e) { setMessage({ text: `${e.response?.data?.detail || e.message}`, type: 'error' }); }
  };

  const viewWarehouse = async (id) => {
    try { const data = await warehouseAPI.getById(id); setWhDetail(data); setSelectedWarehouse(id); }
    catch(e) { console.error(e); }
  };

  const mainWarehouses = warehouses.filter(w => w.location_type === 'main' || !w.parent_id);
  const getZones = (parentId) => warehouses.filter(w => w.parent_id === parentId);

  return (
    <div className="warehouse-manager-container">
      <div className="page-header"><div className="header-content"><div className="header-icon wh"><Warehouse size={20} /></div><div><h1>Warehouse Locations</h1><p>Manage zones, aisles, and storage areas</p></div></div>
        <button className="action-btn primary" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ Cancel' : '+ Add Location'}</button>
      </div>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="wh-form-card">
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group"><label>Code *</label><input type="text" value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value}))} required placeholder="WH-ZONE-D" /></div>
              <div className="form-group"><label>Name *</label><input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required placeholder="Zone D - Snacks" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Type</label>
                <select value={formData.location_type} onChange={e => setFormData(p => ({...p, location_type: e.target.value}))}><option value="main">Main Warehouse</option><option value="zone">Zone</option><option value="aisle">Aisle</option><option value="shelf">Shelf</option></select>
              </div>
              <div className="form-group"><label>Parent Location</label>
                <select value={formData.parent_id} onChange={e => setFormData(p => ({...p, parent_id: e.target.value}))}><option value="">None (Top Level)</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Address</label><input type="text" value={formData.address_line1} onChange={e => setFormData(p => ({...p, address_line1: e.target.value}))} placeholder="Industrial Area" /></div>
              <div className="form-group"><label>City</label><input type="text" value={formData.city} onChange={e => setFormData(p => ({...p, city: e.target.value}))} placeholder="Muscat" /></div>
            </div>
            <button type="submit" className="submit-btn">Create Location</button>
          </form>
        </div>
      )}

      {loading ? <div className="loading-state">Loading...</div> : (
        <div className="warehouse-layout">
          <div className="warehouse-tree">
            {mainWarehouses.map(wh => (
              <div key={wh.id} className={`wh-node main ${selectedWarehouse === wh.id ? 'selected' : ''}`}>
                <div className="wh-node-header" onClick={() => viewWarehouse(wh.id)}>
                  <div className="wh-icon"></div>
                  <div className="wh-info"><div className="wh-name">{wh.name}</div><div className="wh-code">{wh.code}</div></div>
                  <div className="wh-stats"><span>{wh.product_count} products</span><span>{wh.total_units} units</span><span>{wh.total_value} OMR</span></div>
                </div>
                {getZones(wh.id).length > 0 && (
                  <div className="wh-children">
                    {getZones(wh.id).map(zone => (
                      <div key={zone.id} className={`wh-node zone ${selectedWarehouse === zone.id ? 'selected' : ''}`} onClick={() => viewWarehouse(zone.id)}>
                        <div className="wh-node-header">
                          <div className="wh-icon"></div>
                          <div className="wh-info"><div className="wh-name">{zone.name}</div><div className="wh-code">{zone.code}</div></div>
                          <div className="wh-stats"><span>{zone.product_count} products</span><span>{zone.total_units} units</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {whDetail && (
            <div className="warehouse-detail">
              <h3>{whDetail.name}</h3>
              <p className="detail-code">{whDetail.code} — {whDetail.location_type}</p>
              {whDetail.address_line1 && <p>{whDetail.address_line1}, {whDetail.city}</p>}
              {whDetail.products && whDetail.products.length > 0 ? (
                <table className="detail-table">
                  <thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Unit</th></tr></thead>
                  <tbody>{whDetail.products.map((p, i) => <tr key={i}><td>{p.product_name}</td><td>{p.sku}</td><td>{p.quantity}</td><td>{p.unit}</td></tr>)}</tbody>
                </table>
              ) : <p className="no-data">No products in this location</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default WarehouseManager;
