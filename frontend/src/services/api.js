// API Service - Handles all backend communication
import axios from 'axios';

// Base URL for your backend API
const API_BASE_URL = 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  // Login user
  login: (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Get current user info
  getCurrentUser: () => api.get('/api/auth/me'),
  
  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
};

// Product APIs
export const productAPI = {
  // Get all products
  getAll: (params = {}) => api.get('/api/products', { params }),
  
  // Get single product
  getById: (id) => api.get(`/api/products/${id}`),
  
  // Create product
  create: (data) => api.post('/api/products', data),
  
  // Update product
  update: (id, data) => api.put(`/api/products/${id}`, data),
  
  // Delete product
  delete: (id) => api.delete(`/api/products/${id}`),
  
  // Search by barcode
  getByBarcode: (barcode) => api.get(`/api/products/barcode/${barcode}`),
};

// Category APIs
export const categoryAPI = {
  getAll: () => api.get('/api/categories'),
  create: (data) => api.post('/api/categories', data),
};

export default api;