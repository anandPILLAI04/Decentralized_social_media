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
