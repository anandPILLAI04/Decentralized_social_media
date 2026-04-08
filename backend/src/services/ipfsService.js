const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');

/**
 * Service for interacting with IPFS through Pinata API
 */
class IPFSService {
  constructor() {
    this.pinataJwt = process.env.PINATA_JWT;
    this.pinataApiKey = process.env.PINATA_API_KEY;
    this.pinataApiSecret = process.env.PINATA_API_SECRET;
    this.pinataEndpoint = 'https://api.pinata.cloud';
    this.uploadTimeout = 30000; // 30-second timeout for Pinata API calls
    this.gateways = [
      'https://gateway.pinata.cloud/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];
    
    // Check if we have valid credentials
    this.isConfigured = Boolean(this.pinataJwt || (this.pinataApiKey && this.pinataApiSecret));
    
    if (!this.isConfigured) {
      logger.warn('⚠️  Pinata IPFS credentials not configured. Evidence upload will be disabled.');
    }
  }

  /**
   * Upload JSON content to IPFS via Pinata
   * @param {Object} jsonBody - JSON content to upload
   * @returns {Promise<string>} CID of uploaded content
   */
  async uploadJSON(jsonBody) {
    if (!this.isConfigured) {
      throw new Error('IPFS upload service not configured. Please check Pinata credentials.');
    }
    
    try {
      const headers = {};
      
      if (this.pinataJwt) {
        headers['Authorization'] = `Bearer ${this.pinataJwt}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataApiSecret;
      }
      
      const response = await axios.post(
        `${this.pinataEndpoint}/pinning/pinJSONToIPFS`,
        jsonBody,
        {
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          timeout: this.uploadTimeout
        }
      );
      
      return response.data.IpfsHash;
    } catch (error) {
      logger.error('Error uploading JSON to IPFS:', error);
      
      if (error.response?.status === 401) {
        throw new Error('IPFS upload service credentials are invalid or expired.');
      }
      
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Upload a file to IPFS via Pinata
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {String} fileName - Name of the file
   * @returns {Promise<string>} CID of uploaded file
   */
  async uploadFile(fileBuffer, fileName) {
    if (!this.isConfigured) {
      throw new Error('IPFS upload service not configured. Please check Pinata credentials.');
    }
    
    try {
      const formData = new FormData();
      
      formData.append('file', fileBuffer, {
        filename: fileName
      });

      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          source: 'Crib Platform'
        }
      });
      formData.append('pinataMetadata', metadata);

      const headers = {
        ...formData.getHeaders()
      };
      
      if (this.pinataJwt) {
        headers['Authorization'] = `Bearer ${this.pinataJwt}`;
      } else {
        headers['pinata_api_key'] = this.pinataApiKey;
        headers['pinata_secret_api_key'] = this.pinataApiSecret;
      }

      const response = await axios.post(
        `${this.pinataEndpoint}/pinning/pinFileToIPFS`,
        formData,
        {
          maxBodyLength: Infinity,
          headers,
          timeout: this.uploadTimeout
        }
      );

      return response.data.IpfsHash;
    } catch (error) {
      logger.error('Error uploading file to IPFS:', error);
      
      if (error.response?.status === 401) {
        throw new Error('IPFS upload service credentials are invalid or expired.');
      }
      
      throw new Error(`IPFS file upload failed: ${error.message}`);
    }
  }

  /**
   * Get IPFS URL from CID with fallback gateways
   * @param {String} cid - IPFS CID
   * @returns {Array<String>} Array of gateway URLs
   */
  getIpfsUrls(cid) {
    if (!cid) return [];
    return this.gateways.map(gateway => `${gateway}${cid}`);
  }

  /**
   * Fetch content from IPFS with gateway fallbacks
   * @param {String} cid - IPFS CID
   * @returns {Promise<Object>} Retrieved content
   */
  async fetchFromIPFS(cid) {
    const urls = this.getIpfsUrls(cid);
    
    // Try each gateway until success or all fail
    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
      } catch (error) {
        logger.info(`Failed to fetch from ${url}. Trying next gateway...`);
      }
    }
    
    throw new Error(`Failed to fetch content from IPFS: ${cid}`);
  }

  /**
   * Create and upload complete post content to IPFS
   * @param {Object} postData - Complete post data
   * @returns {Promise<string>} CID of uploaded post
   */
  async uploadPostContent(postData) {
    const postJSON = {
      content: postData.content || '',
      mediaCID: postData.mediaCID || '',
      authorId: postData.authorId,
      authorName: postData.authorName || '',
      authorAvatar: postData.authorAvatar || '',
      timestamp: postData.timestamp || new Date().toISOString(),
      isNFT: postData.isNFT || false,
      nftTokenId: postData.nftTokenId || null,
      transactionHash: postData.transactionHash || null,
      metadata: {
        version: '1.0',
        platform: 'Crib',
        contentType: 'social-post'
      }
    };

    return await this.uploadJSON(postJSON);
  }

  /**
   * Create OpenSea-compatible NFT metadata and upload to IPFS
   * @param {Object} nftData - NFT metadata
   * @returns {Promise<string>} CID of uploaded metadata
   */
  async uploadNFTMetadata(nftData) {
    const metadata = {
      name: nftData.name || `Crib Post #${nftData.tokenId || 'Unknown'}`,
      description: nftData.description || nftData.content || 'A post from Crib decentralized social media',
      image: nftData.imageUrl || '', // Full IPFS URL
      external_url: `https://crib.app/post/${nftData.postId || ''}`,
      attributes: [
        {
          trait_type: 'Author',
          value: nftData.authorName || nftData.authorId
        },
        {
          trait_type: 'Platform',
          value: 'Crib'
        },
        {
          trait_type: 'Created',
          value: nftData.timestamp || new Date().toISOString(),
          display_type: 'date'
        },
        {
          trait_type: 'Has Media',
          value: !!nftData.imageUrl ? 'Yes' : 'No'
        },
        ...(nftData.customAttributes || [])
      ],
      properties: {
        contentCID: nftData.contentCID,
        authorId: nftData.authorId,
        chainId: 80002 // Polygon Amoy
      }
    };

    return await this.uploadJSON(metadata);
  }
}

module.exports = new IPFSService();
