#!/bin/bash
# Production deployment script
# Usage: ./deploy.sh

set -e

echo "Starting FutureMe deployment..."

# Load environment variables
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '^#' | xargs)
else
  echo ".env.production not found. Create it from .env.production.example"
  exit 1
fi

# Validate environment
echo "Validating environment configuration..."
if [ -z "$JWT_SECRET" ]; then
  echo "JWT_SECRET not set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install --prod

# Build
echo "Building application..."
pnpm run build

# Run type checking
echo "Type checking..."
pnpm run typecheck

# Run tests (if available)
if [ -f "pnpm run test" ]; then
  echo "Running tests..."
  pnpm run test
fi

# Create directories
mkdir -p ./logs
mkdir -p ./data

# Stop existing services (if using systemd)
if command -v systemctl &> /dev/null; then
  echo "Stopping existing services..."
  sudo systemctl stop futureme-backend || true
  sudo systemctl stop futureme-frontend || true
fi

# Deploy backend
echo "Deploying backend..."
if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
  docker-compose up -d backend
else
  sudo systemctl start futureme-backend
fi

# Deploy frontend
echo "Deploying frontend..."
if [ "$DEPLOYMENT_METHOD" = "docker" ]; then
  docker-compose up -d frontend
else
  # Copy to web root
  sudo cp -r apps/frontend/dist/* /var/www/html/
  sudo systemctl start futureme-frontend
fi

# Health checks
echo "Running health checks..."
sleep 5

# Check backend
if ! curl -s http://localhost:3001/health > /dev/null; then
  echo "Backend health check failed, but continuing..."
fi

# Check frontend
if ! curl -s http://localhost/ > /dev/null; then
  echo "Frontend health check failed, but continuing..."
fi

echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Verify services are running: sudo systemctl status futureme-backend"
echo "  2. Check logs: sudo journalctl -u futureme-backend -f"
echo "  3. Test the application: https://yourdomain.com"
echo ""
echo "For more info, see: DEPLOYMENT.md"
