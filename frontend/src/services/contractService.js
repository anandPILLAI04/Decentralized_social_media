import { ethers } from "ethers";
import contractAddresses from "../constants/contractAddresses.json";
import contractABI from "../constants/contractABI.json";

// Network configuration
const NETWORKS = {
  137: 'Polygon Mainnet',
  80001: 'Mumbai Testnet',
  80002: 'Amoy Testnet'
};

// Default to Amoy if available or fallback to Mumbai
const getDefaultContractAddress = () => {
  if (contractAddresses.amoy) return contractAddresses.amoy;
  if (contractAddresses.mumbai) return contractAddresses.mumbai;
  return contractAddresses.socialMedia || contractAddresses.localhost;
};

// Use the appropriate contract address based on the current network
const getContractAddress = async (provider) => {
  try {
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    
    // Convert BigInt to Number for comparison
    const chainIdNum = Number(chainId);
    
    // Log which network we're connected to
    console.log(`Connected to network: ${NETWORKS[chainIdNum] || 'Unknown'} (${chainIdNum})`);
    
    // Check if we have chain-specific addresses (new format with chainId as key)
    if (contractAddresses[chainIdNum]) {
      console.log(`Using contract addresses for chain ${chainIdNum}:`, contractAddresses[chainIdNum]);
      return contractAddresses[chainIdNum].SocialMediaNFT;
    }
    
    // Also try string version (JSON keys are strings)
    if (contractAddresses[String(chainIdNum)]) {
      console.log(`Using contract addresses for chain ${chainIdNum}:`, contractAddresses[String(chainIdNum)]);
      return contractAddresses[String(chainIdNum)].SocialMediaNFT;
    }
    
    // Fallback to old format
    if (chainIdNum === 80002 && contractAddresses.amoy) {
      console.log("Using Amoy contract:", contractAddresses.amoy);
      return contractAddresses.amoy;
    } else if (chainIdNum === 80001 && contractAddresses.mumbai) {
      console.log("Using Mumbai contract:", contractAddresses.mumbai);
      return contractAddresses.mumbai;
    } else if (chainIdNum === 31337 || chainIdNum === 1337) {
      console.log("Using localhost contract:", contractAddresses.localhost);
      return contractAddresses.localhost;
    }
    
    // If we're on Amoy (80002), log a warning - the JSON file should have the address
    if (chainIdNum === 80002) {
      console.error("⚠️ Contract address for Amoy (80002) not found in contractAddresses.json. Please redeploy.");
    }
    
    // Fallback to default address (should rarely happen)
    const defaultAddress = getDefaultContractAddress();
    console.log("⚠️ Using default contract address:", defaultAddress);
    return defaultAddress;
  } catch (err) {
    console.error("Error getting network:", err);
    return getDefaultContractAddress();
  }
};

/**
 * Helper to get provider, signer and contract
 */
async function getContract(requireSigner = false) {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask to interact with the blockchain.");
  }
  
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Get the appropriate contract address for the current network
    const contractAddress = await getContractAddress(provider);
    
    if (!contractAddress) {
      throw new Error("Contract address not found. Please deploy the contract first.");
    }
    
    if (requireSigner) {
      const signer = await provider.getSigner();
      return {
        contract: new ethers.Contract(contractAddress, contractABI.abi, signer),
        provider,
        signer
      };
    } else {
      return {
        contract: new ethers.Contract(contractAddress, contractABI.abi, provider),
        provider
      };
    }
  } catch (err) {
    console.error("Error getting contract:", err);
    throw new Error(`Blockchain connection error: ${err.message}`);
  }
}

/**
 * Create a post on the blockchain
 */
export async function createPostOnChain({ content, mediaURI = "", mintAsNFT = false, metadata = "" }) {
  try {
    console.log("Creating post on blockchain:", { content, mediaURI, mintAsNFT, metadata });
    const { contract, provider } = await getContract(true);

    // Estimate gas for the transaction
    const gasEstimate = await contract.createPost.estimateGas(
      content,
      mediaURI,
      mintAsNFT,
      metadata
    );

    console.log(`Gas estimate for createPost: ${gasEstimate}`);

    // Add 20% buffer to gas estimate
    const gasLimit = Math.ceil(Number(gasEstimate) * 1.2);

    // Get current gas prices from the network
    const feeData = await provider.getFeeData();
    console.log("Fee data from network:", feeData);

    // Set minimum gas prices for Polygon Amoy (25 Gwei priority fee)
    const minPriorityFee = ethers.parseUnits("25", "gwei");
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?
      feeData.maxPriorityFeePerGas > minPriorityFee ? feeData.maxPriorityFeePerGas : minPriorityFee
      : minPriorityFee;

    const maxFeePerGas = feeData.maxFeePerGas ?
      feeData.maxFeePerGas > maxPriorityFeePerGas ? feeData.maxFeePerGas : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei")
      : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei");

    console.log(`Using gas prices - Priority: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} Gwei, Max: ${ethers.formatUnits(maxFeePerGas, "gwei")} Gwei`);

    // Submit transaction with proper gas settings
    const tx = await contract.createPost(
      content,
      mediaURI,
      mintAsNFT,
      metadata,
      {
        gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas
      }
    );

    console.log("Transaction submitted:", tx.hash);

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);

    // Get updated post count
    const postCount = await contract.getPostCount();
    console.log("New post count:", postCount);

    return {
      postId: postCount, // Post IDs start at 1 and getPostCount() returns _nextTokenId - 1, which is the ID of the just-created post
      transactionHash: receipt.hash
    };
  } catch (err) {
    console.error("Error creating post on chain:", err);

    // Provide more helpful error messages
    if (err.message.includes("insufficient funds")) {
      throw new Error("You need more MATIC tokens to pay for gas. Visit a faucet to get free tokens.");
    } else if (err.message.includes("user rejected")) {
      throw new Error("Transaction was rejected in your wallet.");
    } else if (err.message.includes("contract not deployed")) {
      throw new Error("Contract not found at this address. Make sure you're on the correct network.");
    }
    
    throw new Error(`Blockchain error: ${err.message}`);
  }
}

/**
 * Fetch a post from the blockchain
 */
export async function fetchPost(postId) {
  try {
    console.log("Fetching post from blockchain:", postId);
    const { contract } = await getContract();
    
    const post = await contract.getPost(postId);
    console.log("Post retrieved:", post);
    
    // Format the post data
    return {
      id: postId,
      author: post.author,
      content: post.content,
      mediaUrl: post.mediaURI,
      timestamp: Number(post.timestamp) * 1000, // Convert to milliseconds
      isNFT: post.isNFT,
      likes: Number(post.likes),
      comments: 0, // Comments not implemented in contract yet
    };
  } catch (err) {
    console.error("Error fetching post:", err);
    throw new Error(`Failed to fetch post: ${err.message}`);
  }
}

/**
 * Fetch all posts from the blockchain
 */
export async function fetchAllPosts() {
  try {
    const { contract } = await getContract();
    
    // Try to get post count
    let postCount;
    try {
      postCount = await contract.getPostCount();
      console.log("Total posts:", postCount);
    } catch (err) {
      // If getPostCount fails (contract not deployed or no posts), return empty array
      console.warn("Could not get post count:", err.message);
      if (err.message.includes("could not decode result data")) {
        console.log("Contract appears to be not deployed or has no data. Returning empty array.");
        return [];
      }
      throw err;
    }
    
    // If no posts, return empty array
    if (postCount === 0n || postCount === 0) {
      console.log("No posts on blockchain yet");
      return [];
    }
    
    const posts = [];
    // Fetch all posts (limited to 50 to avoid excessive requests)
    // Post IDs start at 1 (not 0)
    const count = Math.min(Number(postCount), 50);

    for (let i = 1; i <= count; i++) {
      try {
        const post = await fetchPost(i);
        posts.push(post);
      } catch (err) {
        console.error(`Error fetching post ${i}:`, err);
      }
    }
    
    return posts.reverse(); // Most recent first
  } catch (err) {
    console.error("Error fetching all posts:", err);
    throw new Error(`Failed to fetch posts: ${err.message}`);
  }
}

/**
 * Get the total number of posts
 */
export async function fetchPostCount() {
  try {
    const { contract } = await getContract();
    const count = await contract.getPostCount();
    return Number(count);
  } catch (err) {
    console.error("Error fetching post count:", err);
    throw new Error(`Failed to get post count: ${err.message}`);
  }
}

/**
 * Like a post on the blockchain
 */
export async function likePost(postId) {
  try {
    const { contract, provider } = await getContract(true);

    // Estimate gas
    const gasEstimate = await contract.likePost.estimateGas(postId);
    const gasLimit = Math.ceil(Number(gasEstimate) * 1.2);

    // Get current gas prices from the network
    const feeData = await provider.getFeeData();

    // Set minimum gas prices for Polygon Amoy (25 Gwei priority fee)
    const minPriorityFee = ethers.parseUnits("25", "gwei");
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?
      feeData.maxPriorityFeePerGas > minPriorityFee ? feeData.maxPriorityFeePerGas : minPriorityFee
      : minPriorityFee;

    const maxFeePerGas = feeData.maxFeePerGas ?
      feeData.maxFeePerGas > maxPriorityFeePerGas ? feeData.maxFeePerGas : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei")
      : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei");

    const tx = await contract.likePost(postId, {
      gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas
    });
    const receipt = await tx.wait();
    return receipt;
  } catch (err) {
    console.error("Error liking post:", err);
    throw new Error(`Failed to like post: ${err.message}`);
  }
}

/**
 * Mint a post as an NFT
 */
export async function mintPostAsNFT(postId, metadata = "") {
  try {
    console.log("Minting post as NFT:", { postId, metadata });
    const { contract, signer, provider } = await getContract(true);

    // Get user address
    const userAddress = await signer.getAddress();
    console.log("Minting from address:", userAddress);

    // Estimate gas for the transaction (ethers v6 pattern)
    const gasEstimate = await contract.mintPost.estimateGas(postId, metadata);
    console.log(`Gas estimate for mintPost: ${gasEstimate}`);

    // Add 20% buffer to gas estimate
    const gasLimit = Math.ceil(Number(gasEstimate) * 1.2);

    // Get current gas prices from the network
    const feeData = await provider.getFeeData();

    // Set minimum gas prices for Polygon Amoy (25 Gwei priority fee)
    const minPriorityFee = ethers.parseUnits("25", "gwei");
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?
      feeData.maxPriorityFeePerGas > minPriorityFee ? feeData.maxPriorityFeePerGas : minPriorityFee
      : minPriorityFee;

    const maxFeePerGas = feeData.maxFeePerGas ?
      feeData.maxFeePerGas > maxPriorityFeePerGas ? feeData.maxFeePerGas : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei")
      : maxPriorityFeePerGas + ethers.parseUnits("25", "gwei");

    // Submit transaction with gas limit and pricing
    const tx = await contract.mintPost(postId, metadata, {
      gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas
    });
    console.log("Minting transaction submitted:", tx.hash);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log("Minting transaction confirmed:", receipt);
    
    // Extract token ID from event logs (ethers v6: use receipt.logs + parseLog)
    let tokenId = null;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsed && (parsed.name === 'PostMinted' || parsed.name === 'Transfer')) {
            tokenId = parsed.args.tokenId || parsed.args[2]; // Transfer event has tokenId as 3rd arg
            console.log("NFT Token ID:", tokenId?.toString());
            break;
          }
        } catch (e) {
          // Log belongs to a different contract/interface, skip
        }
      }
    }
    
    return {
      success: true,
      tokenId: tokenId ? tokenId.toString() : null,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    };
  } catch (err) {
    console.error("Error minting post as NFT:", err);
    
    // Provide more helpful error messages
    if (err.message.includes("insufficient funds")) {
      throw new Error("You need more MATIC tokens to pay for gas fees.");
    } else if (err.message.includes("user rejected")) {
      throw new Error("Transaction was cancelled in your wallet.");
    } else if (err.message.includes("already minted")) {
      throw new Error("This post has already been minted as an NFT.");
    } else if (err.message.includes("not the author")) {
      throw new Error("Only the post author can mint it as an NFT.");
    }
    
    throw new Error(`NFT minting failed: ${err.message}`);
  }
}

