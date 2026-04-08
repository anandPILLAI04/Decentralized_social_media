#!/bin/bash

# ╔══════════════════════════════════════════════════════════╗
# ║  Crib Social Media — One-Command Setup                  ║
# ╚══════════════════════════════════════════════════════════╝

echo "🚀 Setting up Decentralized Social Media..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
pretty_print() {
  echo -e "${GREEN}✓${NC} $1"
}

error_print() {
  echo -e "${RED}✗${NC} $1"
}

warning_print() {
  echo -e "${YELLOW}!${NC} $1"
}

# Check for Node.js
if ! command -v node &> /dev/null; then
  error_print "Node.js is not installed. Please install Node.js 18+ first."
  exit 1
fi
pretty_print "Node.js v$(node -v) found"

# Check for MongoDB
if ! command -v mongod &> /dev/null; then
  warning_print "MongoDB not found in PATH"
  warning_print "MongoDB should be running on localhost:27017"
  warning_print "Start MongoDB with: mongod (or brew services start mongodb-community)"
fi

# Install root dependencies
pretty_print "Installing root dependencies..."
npm install --silent 2> /dev/null || npm install

# Install backend dependencies
pretty_print "Installing backend dependencies..."
cd backend
npm install --silent 2> /dev/null || npm install
cd ..

# Install frontend dependencies
pretty_print "Installing frontend dependencies..."
cd frontend
npm install --silent 2> /dev/null || npm install
cd ..

# Install blockchain dependencies
pretty_print "Installing blockchain dependencies..."
cd blockchain
npm install --silent 2> /dev/null || npm install
cd ..

# Create backend .env if doesn't exist
if [ ! -f backend/.env ]; then
  pretty_print "Creating backend/.env (development defaults)"
  cp backend/.env.example backend/.env
  # Uncomment AI moderation for demo
  sed -i.bak 's/# AI_MODERATION_ENABLED=true/AI_MODERATION_ENABLED=false/' backend/.env
  rm -f backend/.env.bak
fi

# Create frontend .env if doesn't exist
if [ ! -f frontend/.env ]; then
  pretty_print "Creating frontend/.env (development defaults)"
  cp frontend/.env.example frontend/.env
fi

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure MongoDB is running:"
echo "      ${YELLOW}mongod${NC} (in another terminal)"
echo ""
echo "   2. Start development environment:"
echo "      ${YELLOW}npm run dev${NC}"
echo ""
echo "   3. Access the app:"
echo "      http://localhost:5173"
echo ""
echo "📚 Documentation:"
echo "   - Deployment guide: docs/DEPLOYMENT-GUIDE.md"
echo "   - API reference: docs/API-REFERENCE.md"
echo "   - Troubleshooting: docs/TROUBLECHOOTING.md"
echo ""
