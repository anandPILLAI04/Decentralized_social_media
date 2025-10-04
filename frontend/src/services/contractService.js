import { ethers } from "ethers";

import contractAddresses from "../constants/contractAddresses.json";
const CONTRACT_ADDRESS = contractAddresses.socialMedia;
const ABI = [
  "function createPost(string content, string mediaURI, bool mintAsNFT, string metadata) external returns (uint256)",
  "function getPost(uint256 postId) external view returns (tuple(uint256 id, address author, string content, string mediaURI, uint256 likes, uint256 comments, uint256 timestamp, bool isNFT, string metadata))",
  "function getPostCount() external view returns (uint256)"
];

export async function createPostOnChain({ content, mediaURI = "", mintAsNFT = false, metadata = "" }) {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  const tx = await contract.createPost(content, mediaURI, mintAsNFT, metadata);
  const receipt = await tx.wait();
  // For simplicity, refetch post count
  return await contract.getPostCount();
}

export async function fetchPost(postId) {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  return contract.getPost(postId);
}

export async function fetchPostCount() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  return contract.getPostCount();
}
