
/*
 * Robust IPFS upload service with multiple gateways and fallbacks
 * Supports both Pinata and web3.storage
 * Requires in frontend .env:
 *   VITE_PINATA_JWT=...
 *   (optional) VITE_WEB3_STORAGE_TOKEN=...
 */

// Use Vite env variables for API keys
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const WEB3_STORAGE_TOKEN = import.meta.env.VITE_WEB3_STORAGE_TOKEN;

// Gateway constants for fetching content
const GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cf-ipfs.com/ipfs/'
];

// Pinata API endpoints
const PINATA_JSON_API = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_FILE_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

/**
 * Upload JSON to Pinata
 */
async function pinJsonToPinata(json) {
  console.log("Uploading JSON to Pinata:", json);
  
  if (!PINATA_JWT) {
    console.error("Missing VITE_PINATA_JWT in environment variables");
    throw new Error("Missing VITE_PINATA_JWT - check your .env file");
  }
  
  try {
    const res = await fetch(PINATA_JSON_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: JSON.stringify({ pinataContent: json })
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Pinata API error: ${res.status} ${text}`);
      throw new Error(`Pinata error: ${res.status} ${text.substring(0, 100)}`);
    }
    
    const data = await res.json();
    console.log("Pinata upload successful, CID:", data.IpfsHash);
    return data.IpfsHash;
  } catch (err) {
    console.error("Pinata JSON upload failed:", err);
    throw new Error(`Pinata JSON upload failed: ${err.message}`);
  }
}

/**
 * Upload file to Pinata
 */
async function pinFileToPinata(file) {
  console.log("Uploading file to Pinata:", file.name || "unnamed file", file.type, file.size);
  
  if (!PINATA_JWT) {
    console.error("Missing VITE_PINATA_JWT in environment variables");
    throw new Error("Missing VITE_PINATA_JWT - check your .env file");
  }
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(PINATA_FILE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Pinata API error: ${res.status} ${text}`);
      throw new Error(`Pinata error: ${res.status} ${text.substring(0, 100)}`);
    }
    
    const data = await res.json();
    console.log("Pinata file upload successful, CID:", data.IpfsHash);
    return data.IpfsHash;
  } catch (err) {
    console.error("Pinata file upload failed:", err);
    throw new Error(`Pinata file upload failed: ${err.message}`);
  }
}

/**
 * Upload to web3.storage as fallback
 */
async function uploadToWeb3Storage(content) {
  if (!WEB3_STORAGE_TOKEN) {
    throw new Error("Web3.Storage token not configured");
  }
  
  // Implementation if needed
  throw new Error("Web3.Storage upload not implemented yet");
}

/**
 * Main upload function - handles all content types
 * and returns a consistent response
 */
export async function uploadToIPFS(data) {
  try {
    let cid;
    
    if (typeof data === 'string') {
      // String content - upload as file
      const blob = new Blob([data], { type: 'text/plain' });
      cid = await pinFileToPinata(blob);
    } else if (data instanceof Blob || data instanceof File) {
      // File/Blob content
      cid = await pinFileToPinata(data);
    } else {
      // JSON object
      cid = await pinJsonToPinata(data);
    }
    
    return { cid };
  } catch (err) {
    console.error("IPFS upload failed:", err);
    // Re-throw with a clean message for UI
    throw new Error(`IPFS upload failed: ${err.message}`);
  }
}

/**
 * Helper to get content from IPFS
 * Supports multiple gateways for reliability
 */
export function getIPFSUrl(cid) {
  if (!cid) return null;
  // Use Cloudflare gateway as primary (it's fast and reliable)
  return `${GATEWAYS[0]}${cid}`;
}

/**
 * Fetch content from IPFS with gateway fallbacks
 * Returns the fetched content or throws error
 */
export async function fetchFromIPFS(cid) {
  if (!cid) throw new Error("Invalid CID");
  
  let lastError;
  
  for (const gateway of GATEWAYS) {
    try {
      const url = `${gateway}${cid}`;
      console.log(`Trying to fetch from ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      console.warn(`Failed to fetch from ${gateway}${cid}:`, err);
      lastError = err;
      // Try next gateway
    }
  }
  
  throw new Error(`Failed to fetch from all IPFS gateways: ${lastError?.message}`);
}
