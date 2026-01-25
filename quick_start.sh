#!/bin/bash
# Quick Start Script for Warehouse Management System

echo "🏭 Warehouse Management System - Quick Start"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Please run this script from the warehouse_system directory"
    exit 1
fi

# Go to backend directory
cd backend

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file to configure your settings"
    echo ""
fi

# Check if requirements are installed
echo "📦 Checking Python dependencies..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📥 Installing Python packages..."
    pip install -r requirements.txt --break-system-packages
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""

# Initialize database
echo "🔨 Initializing database..."
if [ -f "warehouse.db" ]; then
    echo "⚠️  Database already exists. Skipping initialization."
    echo "   To reinitialize, delete warehouse.db and run again."
else
    python init_db.py
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the server:"
echo "  cd backend"
echo "  python main.py"
echo ""
echo "Then visit:"
echo "  📚 API Docs: http://localhost:8000/api/docs"
echo "  ❤️  Health: http://localhost:8000/api/health"
echo ""
echo "Login with:"
echo "  👤 Username: admin"
echo "  🔑 Password: admin123"
echo ""
