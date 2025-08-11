#!/bin/bash

echo "🚀 Setting up Decentralized Social Media Platform..."
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Compile smart contracts
echo "🔨 Compiling smart contracts..."
cd blockchain
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Failed to compile contracts"
    exit 1
fi

echo "✅ Smart contracts compiled successfully"

# Start local blockchain node
echo "🌐 Starting local blockchain node..."
echo "   This will run in the background. You can stop it with: pkill -f 'hardhat node'"
nohup npm run node > ../blockchain-node.log 2>&1 &

# Wait for blockchain to start
echo "⏳ Waiting for blockchain to start..."
sleep 5

# Deploy contracts
echo "🚀 Deploying smart contracts..."
npm run deploy:localhost

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy contracts"
    echo "   Check blockchain-node.log for details"
    exit 1
fi

echo "✅ Smart contracts deployed successfully"

# Go back to root
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo "================================"
echo ""
echo "📋 Next steps:"
echo "1. Start the backend: npm run dev:backend"
echo "2. Start the frontend: npm run dev:frontend"
echo "3. Or run everything together: npm run dev"
echo ""
echo "🌐 Your platform will be available at:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:4000"
echo "   Blockchain: http://localhost:8545"
echo ""
echo "💡 To stop the blockchain node: pkill -f 'hardhat node'"
echo "📄 Check blockchain-node.log for blockchain details"
echo ""
echo "Happy building! 🚀"
