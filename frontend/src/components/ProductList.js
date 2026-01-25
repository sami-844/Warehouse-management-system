// Product List Component
import React, { useState, useEffect } from 'react';
import { productAPI, categoryAPI } from '../services/api';
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
      if (editingProduct) {
        await productAPI.update(editingProduct.id, formData);
      } else {
        await productAPI.create(formData);
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product: ' + (err.response?.data?.detail || err.message));
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
    });
    setShowAddForm(true);
  };

  const handleDelete = async (product) => {
    if (window.confirm(`Delete ${product.name}?`)) {
      try {
        await productAPI.delete(product.id);
        await loadData();
      } catch (err) {
        console.error('Error deleting product:', err);
        alert('Failed to delete product');
      }
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
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="product-list-container">
      <div className="product-header">
        <h2>📦 Products</h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
        >
          {showAddForm ? 'Cancel' : '➕ Add Product'}
        </button>
      </div>

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
              <p><strong>Unit:</strong> {product.unit_of_measure}</p>
              {product.description && <p className="description">{product.description}</p>}
            </div>
            <div className="product-actions">
              <button onClick={() => handleEdit(product)} className="btn-edit">
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(product)} className="btn-delete">
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="no-products">
          <p>No products found</p>
        </div>
      )}
    </div>
  );
}

export default ProductList;