# 🚀 Decentralized Social Media Platform

A modern, Web3-native social media platform that combines the best of traditional social networking with blockchain technology, NFT minting, and decentralized governance.

## ✨ Features

### 🌐 **Social Media Core**
- **Post Creation**: Create and share text and media posts
- **NFT Minting**: Turn your posts into unique NFTs on the blockchain
- **Like & Comment**: Engage with community content
- **User Profiles**: Personalized user experience with wallet integration
- **Media Support**: Image uploads and IPFS integration

### 🏛️ **Decentralized Governance**
- **DAO Structure**: Community-driven decision making
- **Proposal System**: Create and vote on platform improvements
- **Voting Mechanisms**: Transparent voting with on-chain verification
- **Governance Tokens**: Stake-based voting power

### 🔒 **Web3 Integration**
- **Wallet Connection**: MetaMask and other Web3 wallet support
- **Smart Contracts**: Ethereum-based social media contracts
- **Content Ownership**: True ownership of your digital content
- **Censorship Resistance**: Decentralized content storage

### 🛡️ **Content Moderation**
- **AI-Powered**: Machine learning content analysis
- **Community Feedback**: User-driven moderation system
- **Transparent Rules**: Clear guidelines and enforcement
- **Appeal Process**: Fair content review system

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Blockchain    │
│   (React)       │◄──►│   (Node.js)     │◄──►│  (Solidity)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IPFS Storage  │    │   AI Moderation │    │   Governance    │
│   (Decentralized)│   │   (Python)      │    │   (DAO)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MetaMask or other Web3 wallet
- Git

### 🎯 **One-Command Setup (Recommended)**
```bash
git clone <repository-url>
cd decentralized-social-media
npm run setup
```

This will automatically:
- Install all dependencies
- Compile smart contracts
- Start local blockchain
- Deploy contracts
- Set up everything needed

### 🔧 **Manual Setup (Alternative)**

#### 1. Clone & Install
```bash
git clone <repository-url>
cd decentralized-social-media
npm run install:all
```

#### 2. Compile Smart Contracts
```bash
cd blockchain
npm run compile
```

#### 3. Start Local Blockchain
```bash
npm run node
```
This starts a local Hardhat node on `http://localhost:8545`

#### 4. Deploy Smart Contracts
```bash
# In a new terminal
npm run deploy:contracts
```

#### 5. Start Backend
```bash
# In a new terminal
cd backend
npm run dev
```
Backend runs on `http://localhost:4000`

#### 6. Start Frontend
```bash
# In a new terminal
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`

### 🚀 **Run Everything Together**
```bash
# From root directory (after setup)
npm run dev
```

## 🛠️ Development

### Project Structure
```
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── hooks/          # Custom React hooks
│   │   └── styles/         # CSS and styling
│   └── package.json
├── backend/                  # Node.js backend API
│   ├── src/
│   │   ├── api/            # API routes
│   │   ├── services/       # Business logic
│   │   └── ai/             # AI moderation
│   └── package.json
├── blockchain/               # Smart contracts
│   ├── contracts/           # Solidity contracts
│   ├── scripts/             # Deployment scripts
│   └── test/                # Contract tests
└── shared/                   # Shared utilities
    └── constants/           # Contract addresses
```

### Smart Contracts

#### SocialMediaNFT.sol
- ERC-721 NFT contract for social media posts
- Post creation, liking, and metadata management
- On-chain content verification

#### Governance.sol
- DAO governance system
- Proposal creation and voting
- Stake-based voting power

#### Moderation.sol
- Content feedback system
- Community moderation events
- Transparent content scoring

### API Endpoints

#### Social Media
- `GET /api/social/posts` - Get all posts
- `POST /api/social/posts` - Create new post
- `POST /api/social/posts/:id/like` - Like/unlike post
- `POST /api/social/posts/:id/comments` - Add comment

#### Governance
- `GET /api/governance/proposals` - Get all proposals
- `POST /api/governance/proposals` - Create proposal
- `POST /api/governance/proposals/:id/vote` - Vote on proposal

#### Blockchain
- `GET /api/blockchain/status` - Contract status
- `GET /api/blockchain/posts/:id` - Get post from blockchain

## 🎨 UI/UX Features

- **Modern Design**: Material-UI based interface
- **Responsive Layout**: Mobile-first design approach
- **Dark/Light Theme**: User preference support
- **Smooth Animations**: Enhanced user experience
- **Accessibility**: WCAG compliant components

## 🔧 Configuration

### Environment Variables
```bash
# Backend
PORT=4000
ETHEREUM_RPC_URL=http://localhost:8545

# Frontend
VITE_API_BASE_URL=http://localhost:4000/api
VITE_CONTRACT_ADDRESSES_PATH=../shared/constants/contractAddresses.json
```

### Contract Configuration
```json
{
  "socialMedia": "0x...",
  "governance": "0x...",
  "moderation": "0x...",
  "network": "localhost"
}
```

## 🧪 Testing

### Smart Contracts
```bash
cd blockchain
npm run test
```

### Frontend
```bash
cd frontend
npm run test
```

### Backend
```bash
cd backend
npm run test
```

## 📦 Deployment

### Smart Contracts
```bash
# Deploy to testnet
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network mainnet
```

### Frontend
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting service
```

### Backend
```bash
cd backend
npm run build
# Deploy to your cloud provider
```

## 🚨 Troubleshooting

### Common Issues
- **Contracts not working**: Run `npm run setup`
- **Backend won't start**: Check if port 4000 is free
- **Frontend errors**: Clear browser cache and refresh
- **Blockchain issues**: Restart with `npm run stop:blockchain`

### Quick Fixes
```bash
# Complete reset
npm run setup

# Stop blockchain
npm run stop:blockchain

# Reinstall dependencies
npm run install:all
```

📖 **Full troubleshooting guide**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs/](docs/) folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 🗺️ Roadmap

### Phase 1 (Current) ✅
- [x] Basic social media functionality
- [x] Smart contract foundation
- [x] Web3 wallet integration
- [x] Basic governance system
- [x] One-command setup

### Phase 2 (Next) 🚧
- [ ] Advanced content moderation
- [ ] IPFS integration
- [ ] Mobile app
- [ ] Advanced governance features

### Phase 3 (Future) 🔮
- [ ] Cross-chain support
- [ ] Advanced AI features
- [ ] Marketplace integration
- [ ] DAO tokenomics

## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Material-UI for the beautiful component library
- Hardhat for the development framework
- Ethers.js for blockchain interactions

---

**Built with ❤️ for the decentralized future**

## 🎯 **Getting Started Checklist**

- [ ] Run `npm run setup` (automates everything below)
- [ ] Install dependencies
- [ ] Compile smart contracts
- [ ] Start local blockchain
- [ ] Deploy contracts
- [ ] Start backend server
- [ ] Start frontend app
- [ ] Connect MetaMask wallet
- [ ] Create your first post! 🚀
