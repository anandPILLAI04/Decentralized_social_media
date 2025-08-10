#!/usr/bin/env bash
set -e

# ------------------------------------------------------------------
# Scaffold script for decentralized_social_media project
# Run this from inside your existing decentralized_social_media folder.
# WARNING: This WILL create files and may overwrite existing files.
# ------------------------------------------------------------------

ROOT="$(pwd)"
echo "Scaffolding project in: $ROOT"
echo "If you want to abort, Ctrl-C now (5s)..."
sleep 5

# Create directories
mkdir -p frontend/public frontend/src/assets frontend/src/components frontend/src/pages frontend/src/hooks frontend/src/context frontend/src/services frontend/src/utils frontend/src/styles
mkdir -p blockchain/contracts blockchain/scripts blockchain/test
mkdir -p backend/src/api backend/src/ai backend/src/services backend/src/models backend/src/config
mkdir -p shared/constants shared/types shared/helpers
mkdir -p docs

# ---------- ROOT files ----------
cat > .env.example <<'EOF'
# Example environment variables
INFURA_API_KEY=
PRIVATE_KEY=
MONGODB_URI=
IPFS_PROJECT_ID=
IPFS_PROJECT_SECRET=
BACKEND_URL=http://localhost:4000
RPC_URL=http://127.0.0.1:8545
EOF

cat > README.md <<'EOF'
# Decentralized Social Media (scaffold)

This repository is a scaffold for a decentralized social-media project:
- Frontend: Vite + React
- Blockchain: Hardhat + Solidity (example contracts)
- Backend: Express (Node) + Python AI stubs
- IPFS for storage, Ethers/Hardhat for contract interaction

See docs/ for more.
EOF

cat > LICENSE <<'EOF'
MIT License
Copyright (c) $(date +%Y)
Permission is hereby granted...
EOF

# ---------- docs ----------
cat > docs/README.md <<'EOF'
Docs placeholder. Add architecture diagrams, API docs, and onboarding guides here.
EOF

# ---------- SHARED ----------
cat > shared/constants/contractAddresses.json <<'EOF'
{}
EOF

# ---------- FRONTEND ----------
cat > frontend/package.json <<'EOF'
{
  "name": "decentralized-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "ethers": "^6.8.0",
    "axios": "^1.6.8",
    "ipfs-http-client": "^60.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
EOF

cat > frontend/vite.config.js <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
})
EOF

cat > frontend/public/index.html <<'EOF'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>Decentralized Social Media</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > frontend/src/main.jsx <<'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

cat > frontend/src/App.jsx <<'EOF'
import React from "react";
import Home from "./pages/Home";

export default function App() {
  return <Home />;
}
EOF

cat > frontend/src/pages/Home.jsx <<'EOF'
import React from "react";
import PostCard from "../components/PostCard";

export default function Home() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Decentralized Social Media — Home</h1>
      <PostCard />
    </main>
  );
}
EOF

cat > frontend/src/components/PostCard.jsx <<'EOF'
import React from "react";

export default function PostCard() {
  return (
    <article style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
      <h2>Example Post</h2>
      <p>This is a placeholder post. Replace with real data from the blockchain/IPFS.</p>
    </article>
  );
}
EOF

cat > frontend/src/hooks/useWallet.js <<'EOF'
/**
 * Placeholder wallet hook
 * Implement with ethers.js / wagmi / web3modal as you build the app.
 */
export default function useWallet() {
  return { connected: false, address: null };
}
EOF

cat > frontend/src/services/ipfsService.js <<'EOF'
/**
 * Minimal placeholder for IPFS upload using ipfs-http-client
 * Replace with real implementation and auth.
 */
export async function uploadToIPFS(blobOrBuffer) {
  console.log("stub: uploadToIPFS called", blobOrBuffer);
  return { cid: "QmStubCid" };
}
EOF

cat > frontend/src/styles/index.css <<'EOF'
/* Minimal styles placeholder */
body { font-family: system-ui, -apple-system, Roboto, "Segoe UI", Arial; margin: 0; }
EOF

# ---------- BLOCKCHAIN ----------
cat > blockchain/package.json <<'EOF'
{
  "name": "decentralized-blockchain",
  "version": "0.1.0",
  "devDependencies": {
    "hardhat": "^2.20.0",
    "@nomicfoundation/hardhat-toolbox": "^2.0.0",
    "@openzeppelin/contracts": "^5.0.1"
  },
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "node": "hardhat node",
    "deploy:localhost": "hardhat run scripts/deploy.js --network localhost"
  }
}
EOF

cat > blockchain/hardhat.config.js <<'EOF'
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.21",
  networks: {
    localhost: { url: "http://127.0.0.1:8545" }
  }
};
EOF

cat > blockchain/contracts/SocialMediaNFT.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SocialMediaNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("SocialMediaNFT", "SMNFT") {}

    function mint(address to, string memory tokenURI) external onlyOwner returns (uint256) {
        uint256 tokenId = ++nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }

    function _setTokenURI(uint256 tokenId, string memory tokenURI) internal {
        _tokenURIs[tokenId] = tokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}
EOF

cat > blockchain/contracts/Governance.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// Very small governance placeholder - replace with full DAO pattern
contract Governance {
    // implement proposals / voting
}
EOF

cat > blockchain/contracts/Moderation.sol <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract Moderation {
    event Feedback(address indexed user, uint256 indexed contentId, uint8 score);

    function submitFeedback(uint256 contentId, uint8 score) external {
        emit Feedback(msg.sender, contentId, score);
    }
}
EOF

cat > blockchain/scripts/deploy.js <<'EOF'
/**
 * Simple deploy script for SocialMediaNFT
 * Start a local node with: npx hardhat node
 * Then in another terminal run: npx hardhat run scripts/deploy.js --network localhost
 */
async function main() {
  const hre = require("hardhat");
  const SocialMediaNFT = await hre.ethers.getContractFactory("SocialMediaNFT");
  const nft = await SocialMediaNFT.deploy();
  await nft.deployed();
  console.log("SocialMediaNFT deployed to:", nft.address);
}

main().catch(err => { console.error(err); process.exit(1); });
EOF

# ---------- BACKEND ----------
cat > backend/package.json <<'EOF'
{
  "name": "decentralized-backend",
  "version": "0.1.0",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.8"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF

cat > backend/src/app.js <<'EOF'
const express = require("express");
const cors = require("cors");
const moderationRoutes = require("./api/moderationRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/moderation", moderationRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
EOF

cat > backend/src/api/moderationRoutes.js <<'EOF'
const express = require("express");
const router = express.Router();

/**
 * POST /api/moderation/analyze
 * body: { text: "some content" }
 * returns: { ok: true, score: 0.12, flags: [] }
 */
router.post("/analyze", async (req, res) => {
  const { text } = req.body || {};
  // Placeholder: in production call Python AI service or internal model
  const score = text && text.length > 200 ? 0.9 : 0.1;
  res.json({ ok: true, score, flags: [] });
});

module.exports = router;
EOF

cat > backend/src/services/blockchainService.js <<'EOF'
/**
 * Placeholder blockchain service (use ethers.js in real implementation)
 */
module.exports = {
  async getContractAddress(name) {
    return null;
  }
}
EOF

cat > backend/src/ai/feedbackFilter.py <<'EOF'
# Minimal Python stub for AI moderation.
# Create and activate a virtualenv, then pip install your ML libs.
def analyze(text):
    # Replace with actual ML model call
    score = 0.9 if text and len(text) > 200 else 0.1
    flags = []
    return {"score": score, "flags": flags}

if __name__ == "__main__":
    import sys, json
    text = sys.argv[1] if len(sys.argv) > 1 else ""
    print(json.dumps(analyze(text)))
EOF

cat > backend/requirements.txt <<'EOF'
# Add your Python AI dependencies here, for example:
# transformers==4.39.0
# torch==2.2.0
# tensorflow==2.15.0
EOF

# ---------- finish ----------
echo "Scaffold complete. Files created."
echo "Next: follow the step-by-step instructions in the terminal output or README to install dependencies and run local services."

