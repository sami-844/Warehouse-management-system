// Navigation Component
import React from 'react';
import './Navigation.css';

function Navigation({ currentPage, onNavigate }) {
  return (
    <nav className="navigation">
      <button
        className={currentPage === 'dashboard' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onNavigate('dashboard')}
      >
        📊 Dashboard
      </button>
      <button
        className={currentPage === 'products' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onNavigate('products')}
      >
        📦 Products
      </button>
      <button
        className={currentPage === 'inventory' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onNavigate('inventory')}
        disabled
      >
        📋 Inventory
      </button>
      <button
        className={currentPage === 'orders' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => onNavigate('orders')}
        disabled
      >
        🚚 Orders
      </button>
    </nav>
  );
}

export default Navigation;