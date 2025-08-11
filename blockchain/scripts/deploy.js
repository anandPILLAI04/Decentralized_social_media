/**
 * Deploy script for all contracts
 * Start a local node with: npx hardhat node
 * Then in another terminal run: npx hardhat run scripts/deploy.js --network localhost
 */
async function main() {
  const hre = require("hardhat");
  
  console.log("🚀 Starting deployment...");
  
  // Deploy SocialMediaNFT contract
  console.log("📝 Deploying SocialMediaNFT contract...");
  const SocialMediaNFT = await hre.ethers.getContractFactory("SocialMediaNFT");
  const socialMediaNFT = await SocialMediaNFT.deploy();
  await socialMediaNFT.deployed();
  const socialMediaAddress = socialMediaNFT.address;
  console.log("✅ SocialMediaNFT deployed to:", socialMediaAddress);
  
  // Deploy Governance contract
  console.log("🗳️ Deploying Governance contract...");
  const Governance = await hre.ethers.getContractFactory("Governance");
  const governance = await Governance.deploy();
  await governance.deployed();
  const governanceAddress = governance.address;
  console.log("✅ Governance deployed to:", governanceAddress);
  
  // Deploy Moderation contract
  console.log("🛡️ Deploying Moderation contract...");
  const Moderation = await hre.ethers.getContractFactory("Moderation");
  const moderation = await Moderation.deploy();
  await moderation.deployed();
  const moderationAddress = moderation.address;
  console.log("✅ Moderation deployed to:", moderationAddress);
  
  // Update contract addresses file
  const fs = require("fs");
  const path = require("path");
  
  const addressesPath = path.join(__dirname, "../../shared/constants/contractAddresses.json");
  const addresses = {
    socialMedia: socialMediaAddress,
    governance: governanceAddress,
    moderation: moderationAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("📄 Contract addresses saved to:", addressesPath);
  
  console.log("\n🎉 All contracts deployed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("SocialMediaNFT:", socialMediaAddress);
  console.log("Governance:", governanceAddress);
  console.log("Moderation:", moderationAddress);
  console.log("\n💡 Next steps:");
  console.log("1. Update your frontend with these contract addresses");
  console.log("2. Set voting power for governance participants");
  console.log("3. Test the contracts with sample data");
}

main().catch(err => { 
  console.error("❌ Deployment failed:", err); 
  process.exit(1); 
});
