/**
 * Deploy script for all contracts
 * 
 * USAGE:
 * - Local: npx hardhat run scripts/deploy.js --network localhost
 * - Amoy: npx hardhat run scripts/deploy.js --network amoy
 */
async function main() {
  const hre = require("hardhat");
  const fs = require("fs");
  const path = require("path");
  
  console.log("🚀 Starting deployment...");
  console.log("📡 Network:", hre.network.name);
  console.log("⛓️  Chain ID:", hre.network.config.chainId || "unknown");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Deploy SocialMediaNFT contract
  console.log("📝 Deploying SocialMediaNFT contract...");
  const SocialMediaNFT = await hre.ethers.getContractFactory("SocialMediaNFT");
  const socialMediaNFT = await SocialMediaNFT.deploy();
  await socialMediaNFT.waitForDeployment();
  const socialMediaAddress = await socialMediaNFT.getAddress();
  console.log("SocialMediaNFT deployed to:", socialMediaAddress);

  // Deploy Governance contract
  console.log("\nDeploying Governance contract...");
  const Governance = await hre.ethers.getContractFactory("Governance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("Governance deployed to:", governanceAddress);

  // Deploy Moderation contract
  console.log("\nDeploying Moderation contract...");
  const Moderation = await hre.ethers.getContractFactory("Moderation");
  const moderation = await Moderation.deploy();
  await moderation.waitForDeployment();
  const moderationAddress = await moderation.getAddress();
  console.log("Moderation deployed to:", moderationAddress);
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Update contract addresses file for backend/frontend
  const chainId = hre.network.config.chainId || 31337;
  
  // Read existing addresses
  const sharedPath = path.join(__dirname, "../../shared/constants/contractAddresses.json");
  const frontendPath = path.join(__dirname, "../../frontend/src/constants/contractAddresses.json");
  
  let existingAddresses = {};
  if (fs.existsSync(sharedPath)) {
    existingAddresses = JSON.parse(fs.readFileSync(sharedPath, "utf8"));
  }
  
  // Update with new deployment
  existingAddresses[chainId] = {
    SocialMediaNFT: socialMediaAddress,
    Governance: governanceAddress,
    Moderation: moderationAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };
  
  // Save to both locations
  fs.writeFileSync(sharedPath, JSON.stringify(existingAddresses, null, 2));
  fs.writeFileSync(frontendPath, JSON.stringify(existingAddresses, null, 2));
  
  console.log("📄 Contract addresses saved!");
  console.log("   - Shared:", sharedPath);
  console.log("   - Frontend:", frontendPath);
  
  console.log("\n🎉 All contracts deployed successfully!");
  console.log("\n📋 Deployment Summary:");
  console.log("━".repeat(50));
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", chainId);
  console.log("\nContract Addresses:");
  console.log("  SocialMediaNFT:", socialMediaAddress);
  console.log("  Governance:    ", governanceAddress);
  console.log("  Moderation:    ", moderationAddress);
  console.log("━".repeat(50));
  
  // Network-specific instructions
  if (hre.network.name === "amoy") {
    console.log("\n🔍 View on Polygonscan:");
    console.log(`  https://amoy.polygonscan.com/address/${socialMediaAddress}`);
    console.log(`  https://amoy.polygonscan.com/address/${governanceAddress}`);
    console.log(`  https://amoy.polygonscan.com/address/${moderationAddress}`);
  }
  
  console.log("\n💡 Next Steps:");
  console.log("1. ✅ Contract addresses automatically updated in frontend");
  console.log("2. 🔄 Restart your frontend dev server");
  console.log("3. 🦊 Switch MetaMask to", hre.network.name, "network");
  console.log("4. 🎨 Test minting an NFT from your app");
  console.log("5. 🗳️  Create a governance proposal");
}

main().catch(err => { 
  console.error("❌ Deployment failed:", err); 
  process.exit(1); 
});
