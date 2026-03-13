// Product List Component
import React, { useState, useEffect } from 'react';
import { productAPI, categoryAPI, csvImportAPI, brandAPI } from '../services/api';
import CsvImportModal from './CsvImportModal';
import './ProductList.css';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [brands, setBrands] = useState([]);
  const [avgCosts, setAvgCosts] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [currentStock, setCurrentStock] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [tablePage, setTablePage] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'pieces',
    standard_cost: '',
    selling_price: '',
    tax_rate: 5.00,
    reorder_level: 10,
    minimum_stock: 0,
    maximum_stock: 0,
    is_active: true,
    is_perishable: false,
    brand_id: '',
    opening_qty: 0,
    opening_cost: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        productAPI.getAll(),
        categoryAPI.getAll(),
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      // Load brands
      try {
        const b = await brandAPI.list();
        setBrands((b?.brands || []).filter(br => br.status === 'active'));
      } catch (e) { /* brands optional */ }
      // Load avg costs (authenticated)
      try {
        const acRes = await productAPI.getAvgCosts();
        if (acRes?.costs) setAvgCosts(acRes.costs);
      } catch (e) { /* avg costs optional — 401 before login is fine */ }
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryFilter = (e) => {
    setSelectedCategory(e.target.value);
  };

  const catName = (id) => categories.find(c => c.id === id)?.name || '\u2014';

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === parseInt(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cleanData = { ...formData };
      ['category_id', 'default_supplier_id', 'brand_id'].forEach(f => {
        cleanData[f] = (cleanData[f] === '' || cleanData[f] == null) ? null : parseInt(cleanData[f]) || null;
      });
      ['standard_cost', 'selling_price', 'weight', 'volume'].forEach(f => {
        cleanData[f] = (cleanData[f] === '' || cleanData[f] == null) ? 0 : parseFloat(cleanData[f]) || 0;
      });
      // Never send null for these — always a number
      cleanData.tax_rate = parseFloat(cleanData.tax_rate) || 0;
      cleanData.reorder_level = parseInt(cleanData.reorder_level) || 0;
      cleanData.minimum_stock = parseInt(cleanData.minimum_stock) || 0;
      cleanData.maximum_stock = parseInt(cleanData.maximum_stock) || 0;
      if (editingProduct) {
        // Don't send opening fields on edit
        delete cleanData.opening_qty;
        delete cleanData.opening_cost;
        await productAPI.update(editingProduct.id, cleanData);
      } else {
        // Send opening_qty and opening_cost to backend — it handles the stock transaction
        cleanData.opening_qty = parseInt(cleanData.opening_qty) || 0;
        cleanData.opening_cost = parseFloat(cleanData.opening_cost) || 0;
        await productAPI.create(cleanData);
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Failed to save product: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEdit = async (product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      unit_of_measure: product.unit_of_measure,
      standard_cost: product.standard_cost || '',
      selling_price: product.selling_price || '',
      tax_rate: product.tax_rate ?? 0,
      reorder_level: product.reorder_level ?? 0,
      minimum_stock: product.minimum_stock ?? 0,
      maximum_stock: product.maximum_stock ?? 0,
      is_active: product.is_active,
      is_perishable: product.is_perishable,
      brand_id: product.brand_id || '',
      opening_qty: 0,
      opening_cost: '',
    });
    setShowAddForm(true);
    // Fetch current stock level for this product
    try {
      const stock = await productAPI.getStock(product.id);
      setCurrentStock(stock);
    } catch (e) {
      setCurrentStock(null);
    }
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await productAPI.delete(productToDelete.id, deleteReason);
      setShowDeleteModal(false);
      setProductToDelete(null);
      setDeleteReason('');
      await loadData();
    } catch (err) {
      console.error('Error deleting product:', err);
      setError('Failed to delete product');
      setShowDeleteModal(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category_id: '',
      unit_of_measure: 'pieces',
      standard_cost: '',
      selling_price: '',
      tax_rate: 5.00,
      reorder_level: 10,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: true,
      is_perishable: false,
      brand_id: '',
      opening_qty: 0,
      opening_cost: '',
    });
    setEditingProduct(null);
    setCurrentStock(null);
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalog</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowImport(true)}
            style={{ background: 'white', border: '1px solid #17A2B8', color: '#17A2B8', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Import CSV / Excel
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)}
            style={{ background: '#28A745', color: 'white', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            {showAddForm ? 'Cancel' : '+ Add Product'}
          </button>
        </div>
      </div>

      {importMessage && <div className="wms-import-message">{importMessage}</div>}
      {showImport && (
        <CsvImportModal
          type="products"
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            try {
              const res = await csvImportAPI.importProducts(rows);
              setImportMessage(`Imported ${res.created} products. Skipped: ${res.skipped}.${res.errors?.length ? ' Errors: ' + res.errors[0] : ''}`);
              setShowImport(false);
              loadData();
            } catch(e) { setImportMessage('Import failed: ' + (e.response?.data?.detail || e.message)); setShowImport(false); }
          }}
          onImportFile={async (file) => {
            try {
              const res = await csvImportAPI.importProductsFile(file);
              setImportMessage(`Imported ${res.created} products. Skipped: ${res.skipped}.${res.errors?.length ? ' Errors: ' + res.errors[0] : ''}`);
              setShowImport(false);
              loadData();
              return res;
            } catch(e) { setImportMessage('Import failed: ' + (e.response?.data?.detail || e.message)); setShowImport(false); throw e; }
          }}
        />
      )}

      {showAddForm && (
        <div className="product-form-container">
          <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-row">
              <div className="form-group">
                <label>SKU *</label>
                <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} required disabled={!!editingProduct} />
              </div>
              <div className="form-group">
                <label>Barcode</label>
                <input type="text" name="barcode" value={formData.barcode} onChange={handleInputChange} />
              </div>
            </div>
            <div className="form-group">
              <label>Product Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select name="category_id" value={formData.category_id} onChange={handleInputChange}>
                  <option value="">Select category</option>
                  {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Unit of Measure</label>
                <select name="unit_of_measure" value={formData.unit_of_measure} onChange={handleInputChange}>
                  <option value="pieces">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="liters">Liters</option>
                  <option value="boxes">Boxes</option>
                  <option value="bags">Bags</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Brand</label>
                <select name="brand_id" value={formData.brand_id} onChange={handleInputChange}>
                  <option value="">No brand</option>
                  {brands.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cost (OMR)</label>
                <input type="number" step="0.001" name="standard_cost" value={formData.standard_cost} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Selling Price (OMR) *</label>
                <input type="number" step="0.001" name="selling_price" value={formData.selling_price} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Tax Rate (%)</label>
                <input type="number" step="0.01" name="tax_rate" value={formData.tax_rate} onChange={handleInputChange} />
              </div>
            </div>
            {editingProduct && currentStock ? (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Current Stock on Hand</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0369a1' }}>{currentStock.quantity_on_hand}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Reserved</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{currentStock.quantity_reserved}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Available</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#15803d' }}>{currentStock.quantity_available}</div>
                </div>
                {currentStock.average_cost > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Avg Cost</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2332' }}>OMR {Number(currentStock.average_cost).toFixed(3)}</div>
                  </div>
                )}
              </div>
            ) : null}
            <div className="form-row">
              {!editingProduct && (
                <>
                  <div className="form-group">
                    <label>Opening Quantity</label>
                    <input type="number" name="opening_qty" value={formData.opening_qty} onChange={handleInputChange} min="0" step="1" placeholder="0" />
                    <small style={{color:'#718096',fontSize:11}}>Initial stock quantity</small>
                  </div>
                  <div className="form-group">
                    <label>Opening Cost (OMR)</label>
                    <input type="number" name="opening_cost" value={formData.opening_cost} onChange={handleInputChange} min="0" step="0.001" placeholder="0.000" />
                    <small style={{color:'#718096',fontSize:11}}>Cost per unit for opening stock</small>
                  </div>
                </>
              )}
              <div className="form-group">
                <label>Minimum Stock</label>
                <input type="number" name="minimum_stock" value={formData.minimum_stock} onChange={handleInputChange} min="0" step="1" />
              </div>
              <div className="form-group">
                <label>Maximum Stock</label>
                <input type="number" name="maximum_stock" value={formData.maximum_stock} onChange={handleInputChange} min="0" step="1" placeholder="0" />
              </div>
              <div className="form-group">
                <label>Reorder Level</label>
                <input type="number" name="reorder_level" value={formData.reorder_level} onChange={handleInputChange} min="0" step="1" />
              </div>
            </div>
            <div className="form-checkboxes">
              <label className="checkbox-label"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} /> Active</label>
              <label className="checkbox-label"><input type="checkbox" name="is_perishable" checked={formData.is_perishable} onChange={handleInputChange} /> Perishable</label>
            </div>
            <div className="form-buttons">
              <button type="submit" className="btn-primary">{editingProduct ? 'Update' : 'Create'} Product</button>
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span>Show</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setTablePage(1); }}
            style={{ border: '1px solid #DEE2E6', borderRadius: 4, padding: '4px 8px', fontSize: 13 }}>
            {[10, 25, 50, 100].map(n => (<option key={n} value={n}>{n}</option>))}
          </select>
          <span>entries</span>
        </div>
        <div style={{ flex: 1 }} />
        <select value={selectedCategory} onChange={handleCategoryFilter}
          style={{ border: '1px solid #DEE2E6', borderRadius: 6, padding: '8px 14px', fontSize: 13, minWidth: 160 }}>
          <option value="">All Categories</option>
          {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
        </select>
        <input type="text" placeholder="Search products..." value={searchTerm} onChange={handleSearch}
          style={{ border: '1px solid #DEE2E6', borderRadius: 6, padding: '8px 14px', fontSize: 13, width: 240 }} />
      </div>

      {error && (
        <div style={{ background: '#F8D7DA', color: '#721C24', border: '1px solid #F5C6CB', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Products Table */}
      <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1A3A5C', color: 'white' }}>
              <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>ITEM CODE / SKU</th>
              <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>PRODUCT NAME</th>
              <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>CATEGORY</th>
              <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>UNIT</th>
              <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>STOCK</th>
              <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>SELL PRICE (OMR)</th>
              <th style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>COST (OMR)</th>
              <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>STATUS</th>
              <th style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 600, fontSize: 12 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: '#6C757D' }}>
                  <div style={{ fontWeight: 600 }}>No products found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Add products or import from CSV / Excel</div>
                </td>
              </tr>
            ) : (
              filteredProducts
                .slice((tablePage - 1) * pageSize, tablePage * pageSize)
                .map((product, index) => {
                  const stock = product.stock_on_hand ?? 0;
                  const stockColor = stock <= 0 ? '#DC3545'
                    : stock <= (product.reorder_level || 5) ? '#FFC107' : '#28A745';
                  return (
                    <tr key={product.id}
                      style={{ borderBottom: '1px solid #F0F0F0', background: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                      onMouseLeave={e => (e.currentTarget.style.background = index % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ color: '#17A2B8', fontWeight: 600, fontSize: 13 }}>{product.sku || '\u2014'}</span>
                        {product.barcode && <div style={{ fontSize: 11, color: '#ADB5BD', marginTop: 2 }}>{product.barcode}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>{product.name}</div>
                        {product.description && (
                          <div style={{ fontSize: 11, color: '#6C757D', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6C757D', fontSize: 13 }}>{catName(product.category_id)}</td>
                      <td style={{ padding: '10px 14px', color: '#6C757D', fontSize: 13 }}>{product.unit_of_measure || 'pcs'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: stockColor }}>{stock.toLocaleString()}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>
                        {parseFloat(product.selling_price || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6C757D', fontSize: 13 }}>
                        {avgCosts[product.id]
                          ? Number(avgCosts[product.id].avg_cost).toFixed(3)
                          : parseFloat(product.standard_cost || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          background: product.is_active ? '#D4EDDA' : '#F8D7DA',
                          color: product.is_active ? '#155724' : '#721C24',
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600
                        }}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => handleEdit(product)}
                            style={{ background: '#17A2B8', color: 'white', border: 'none', borderRadius: 4, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Edit
                          </button>
                          <button onClick={() => handleDeleteClick(product)}
                            style={{ background: '#DC3545', color: 'white', border: 'none', borderRadius: 4, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {filteredProducts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #F0F0F0', fontSize: 13, color: '#6C757D', background: '#FAFAFA' }}>
            <span>
              Showing {Math.min((tablePage - 1) * pageSize + 1, filteredProducts.length)} to {Math.min(tablePage * pageSize, filteredProducts.length)} of {filteredProducts.length} entries
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                style={{ padding: '5px 14px', borderRadius: 4, fontSize: 13, border: '1px solid #DEE2E6', cursor: 'pointer', background: tablePage === 1 ? '#F8F9FA' : 'white', color: tablePage === 1 ? '#ADB5BD' : '#1A3A5C' }}>
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - tablePage) <= 2)
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] < page - 1 && <span style={{ padding: '5px 4px', color: '#ADB5BD' }}>...</span>}
                    <button onClick={() => setTablePage(page)}
                      style={{ padding: '5px 12px', borderRadius: 4, fontSize: 13, border: '1px solid #DEE2E6', cursor: 'pointer', background: tablePage === page ? '#1A3A5C' : 'white', color: tablePage === page ? 'white' : '#1A3A5C', fontWeight: tablePage === page ? 600 : 400 }}>
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              <button onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={tablePage === totalPages}
                style={{ padding: '5px 14px', borderRadius: 4, fontSize: 13, border: '1px solid #DEE2E6', cursor: 'pointer', background: 'white', color: '#1A3A5C' }}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && productToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#dc2626' }}>Delete Product</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
              Are you sure you want to delete <strong>{productToDelete.name}</strong> ({productToDelete.sku})?
              This item will be moved to the Deleted Items archive.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1a2332', marginBottom: 4, display: 'block' }}>
                Reason for deletion
              </label>
              <textarea
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g. Discontinued, duplicate entry, wrong product..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmDelete}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductList;