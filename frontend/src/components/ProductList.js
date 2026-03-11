// Product List Component
import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';
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
    minimum_stock: 5,
    is_active: true,
    is_perishable: false,
    brand_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

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
      // Load avg costs
      try {
        const ac = await productAPI.getAll({ avg_costs: true });
        if (ac?.data?.costs) setAvgCosts(ac.data.costs);
        else {
          const acRes = await (await fetch('/api/products/avg-costs')).json();
          if (acRes?.costs) setAvgCosts(acRes.costs);
        }
      } catch (e) { /* avg costs optional */ }
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
      ['standard_cost', 'selling_price', 'tax_rate', 'weight', 'volume'].forEach(f => {
        cleanData[f] = (cleanData[f] === '' || cleanData[f] == null) ? null : parseFloat(cleanData[f]) || null;
      });
      if (editingProduct) {
        await productAPI.update(editingProduct.id, cleanData);
      } else {
        await productAPI.create(cleanData);
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Failed to save product: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEdit = (product) => {
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
      tax_rate: product.tax_rate,
      reorder_level: product.reorder_level,
      minimum_stock: product.minimum_stock,
      is_active: product.is_active,
      is_perishable: product.is_perishable,
      brand_id: product.brand_id || '',
    });
    setShowAddForm(true);
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
      minimum_stock: 5,
      is_active: true,
      is_perishable: false,
      brand_id: '',
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="product-list-container">
      <div className="page-header">
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">Manage your product catalog</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)} className="wms-btn-import">Import CSV</button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">{showAddForm ? 'Cancel' : 'Add Product'}</button>
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
        />
      )}

      {showAddForm && (
        <div className="product-form-container">
          <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-row">
              <div className="form-group">
                <label>SKU *</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingProduct}
                />
              </div>
              <div className="form-group">
                <label>Barcode</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Unit of Measure</label>
                <select
                  name="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={handleInputChange}
                >
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
                <select
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleInputChange}
                >
                  <option value="">No brand</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Cost (OMR)</label>
                <input
                  type="number"
                  step="0.001"
                  name="standard_cost"
                  value={formData.standard_cost}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Selling Price (OMR) *</label>
                <input
                  type="number"
                  step="0.001"
                  name="selling_price"
                  value={formData.selling_price}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  name="tax_rate"
                  value={formData.tax_rate}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Reorder Level</label>
                <input
                  type="number"
                  name="reorder_level"
                  value={formData.reorder_level}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Minimum Stock</label>
                <input
                  type="number"
                  name="minimum_stock"
                  value={formData.minimum_stock}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-checkboxes">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                />
                Active
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_perishable"
                  checked={formData.is_perishable}
                  onChange={handleInputChange}
                />
                Perishable
              </label>
            </div>

            <div className="form-buttons">
              <button type="submit" className="btn-primary">
                {editingProduct ? 'Update' : 'Create'} Product
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filters">
        <input
          type="text"
          placeholder="🔍 Search products..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
        <select
          value={selectedCategory}
          onChange={handleCategoryFilter}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="products-grid">
        {filteredProducts.map(product => (
          <div key={product.id} className="product-card">
            <div className="product-header-card">
              <h3>{product.name}</h3>
              {!product.is_active && <span className="badge-inactive">Inactive</span>}
            </div>
            <div className="product-details">
              <p><strong>SKU:</strong> {product.sku}</p>
              {product.barcode && <p><strong>Barcode:</strong> {product.barcode}</p>}
              <p><strong>Price:</strong> OMR {product.selling_price}</p>
              {avgCosts[product.id] && (
                <p><strong>Avg Cost:</strong> OMR {Number(avgCosts[product.id].avg_cost).toFixed(3)}</p>
              )}
              <p><strong>Unit:</strong> {product.unit_of_measure}</p>
              {product.brand_id && brands.length > 0 && (
                <p><strong>Brand:</strong> {brands.find(b => b.id === product.brand_id)?.name || '—'}</p>
              )}
              {product.stock_on_hand != null && (
                <p>
                  <strong>Stock:</strong>{' '}
                  <span className={`wms-stock-badge ${product.stock_on_hand <= 0 ? 'out' : product.stock_on_hand <= (product.reorder_level || 10) ? 'low' : 'ok'}`}>
                    {product.stock_on_hand <= 0 ? 'OUT' : product.stock_on_hand <= (product.reorder_level || 10) ? 'LOW' : 'OK'}
                  </span>
                  {' '}{product.stock_on_hand}
                </p>
              )}
              {product.description && <p className="description">{product.description}</p>}
            </div>
            <div className="product-actions">
              <button onClick={() => handleEdit(product)} className="btn-edit">
                Edit
              </button>
              <button onClick={() => handleDeleteClick(product)} className="btn-delete">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <EmptyState title="No products found" hint="Click '+ Add Product' or import from CSV to get started" />
      )}

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