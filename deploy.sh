#!/bin/bash
set -e

echo "=== AutoApply Deploy ==="

# Install Node if needed
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install PostgreSQL if needed
if ! command -v psql &> /dev/null; then
  sudo apt-get install -y postgresql postgresql-contrib
  sudo service postgresql start
  sudo -u postgres createdb autoapply 2>/dev/null || true
  sudo -u postgres psql -c "CREATE USER autoapply WITH PASSWORD 'autoapply123';" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE autoapply TO autoapply;" 2>/dev/null || true
fi

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Edit .env with your settings before running again"
  exit 1
fi

# Build backend
echo "Building backend..."
cd backend
npm install --silent
npx @nestjs/cli build 2>/dev/null
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..

# Start backend in background
echo "Starting backend..."
pkill -f "node dist/main" 2>/dev/null || true
cd backend
source ../.env
DB_USER=$DB_USER DB_PASSWORD=$DB_PASSWORD DB_NAME=$DB_NAME DB_HOST=${DB_HOST:-localhost} JWT_SECRET=$JWT_SECRET PORT=${PORT:-3000} nohup node dist/main.js > /tmp/autoapply-backend.log 2>&1 &
cd ..

# Serve frontend with a simple static server
echo "Starting frontend..."
pkill -f "serve.*frontend" 2>/dev/null || true
npx serve frontend/dist -p ${FRONTEND_PORT:-80} &

echo ""
echo "✅ AutoApply is running!"
echo "   Frontend: http://localhost:${FRONTEND_PORT:-80}"
echo "   Backend:  http://localhost:${PORT:-3000}"
echo "   Logs:     tail -f /tmp/autoapply-backend.log"
