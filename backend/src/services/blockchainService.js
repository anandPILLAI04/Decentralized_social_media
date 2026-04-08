const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class BlockchainService {
    constructor() {
        this.provider = null;
        this.socialMediaContract = null;
        this.governanceContract = null;
        this.moderationContract = null;
        this.contractAddresses = {};
        this.contractABIs = {};
        this.isInitialized = false;

        this._initPromise = this.initializeContracts();
    }

    /**
     * Wait for initialization to complete before using the service.
     * Safe to call multiple times — resolves immediately if already init'd.
     */
    async ready() {
        await this._initPromise;
        return this.isInitialized;
    }
    
    async initializeContracts() {
        try {
            // Load contract addresses
            const addressesPath = path.join(__dirname, '../../../shared/constants/contractAddresses.json');
            if (fs.existsSync(addressesPath)) {
                this.contractAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
            } else {
                logger.info('⚠️  Contract addresses file not found. Run "npm run deploy:contracts" first.');
                this.contractAddresses = {};
            }
            
            // Try to load contract ABIs (they may not exist yet)
            try {
                this.contractABIs.socialMedia = require('../../../blockchain/artifacts/contracts/SocialMediaNFT.sol/SocialMediaNFT.json').abi;
            } catch (error) {
                logger.info('⚠️  SocialMediaNFT contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.socialMedia = null;
            }
            
            try {
                this.contractABIs.governance = require('../../../blockchain/artifacts/contracts/Governance.sol/Governance.json').abi;
            } catch (error) {
                logger.info('⚠️  Governance contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.governance = null;
            }
            
            try {
                this.contractABIs.moderation = require('../../../blockchain/artifacts/contracts/Moderation.sol/Moderation.json').abi;
            } catch (error) {
                logger.info('⚠️  Moderation contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.moderation = null;
            }
            
            // Initialize provider (for read operations)
            this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');

            // Resolve addresses from the nested network-keyed JSON structure.
            // The JSON uses { "80002": { "SocialMediaNFT": "0x...", ... } }
            // We need to extract the addresses regardless of the network key.
            const networkKey = process.env.CHAIN_ID || Object.keys(this.contractAddresses).find(k => typeof this.contractAddresses[k] === 'object');
            const networkAddresses = networkKey ? this.contractAddresses[networkKey] : this.contractAddresses;

            const socialMediaAddr = networkAddresses?.SocialMediaNFT || networkAddresses?.socialMedia;
            const governanceAddr = networkAddresses?.Governance || networkAddresses?.governance;
            const moderationAddr = networkAddresses?.Moderation || networkAddresses?.moderation;

            // Initialize contracts only if ABIs and addresses are available
            if (socialMediaAddr && this.contractABIs.socialMedia) {
                this.socialMediaContract = new ethers.Contract(
                    socialMediaAddr,
                    this.contractABIs.socialMedia,
                    this.provider
                );
                logger.info('✅ SocialMediaNFT contract initialized at', socialMediaAddr);
            }

            if (governanceAddr && this.contractABIs.governance) {
                this.governanceContract = new ethers.Contract(
                    governanceAddr,
                    this.contractABIs.governance,
                    this.provider
                );
                logger.info('✅ Governance contract initialized at', governanceAddr);
            }

            if (moderationAddr && this.contractABIs.moderation) {
                this.moderationContract = new ethers.Contract(
                    moderationAddr,
                    this.contractABIs.moderation,
                    this.provider
                );
                logger.info('✅ Moderation contract initialized at', moderationAddr);
            }
            
            this.isInitialized = true;
            logger.info('🚀 Blockchain service initialized successfully');
            
            // Provide helpful instructions if contracts aren't ready
            if (!this.socialMediaContract && !this.governanceContract && !this.moderationContract) {
                logger.info('\n📋 To complete setup, run these commands:');
                logger.info('1. cd blockchain && npm run compile');
                logger.info('2. npm run deploy:contracts');
                logger.info('3. Restart the backend server\n');
            }
            
        } catch (error) {
            logger.error('❌ Failed to initialize blockchain service:', error.message);
            this.isInitialized = false;
        }
    }
    
    // Social Media Contract Methods
    async getPost(postId) {
        try {
            if (!this.socialMediaContract) {
                throw new Error('Social media contract not initialized. Please compile and deploy contracts first.');
            }
            
            const post = await this.socialMediaContract.getPost(postId);
            return {
                id: post.id.toString(),
                author: post.author,
                content: post.content,
                mediaURI: post.mediaURI,
                likes: post.likes.toString(),
                comments: post.comments.toString(),
                timestamp: new Date(parseInt(post.timestamp) * 1000),
                isNFT: post.isNFT,
                metadata: post.metadata
            };
        } catch (error) {
            logger.error(`Error getting post ${postId}:`, error);
            throw error;
        }
    }
    
    async getPostCount() {
        try {
            if (!this.socialMediaContract) {
                throw new Error('Social media contract not initialized. Please compile and deploy contracts first.');
            }
            
            return await this.socialMediaContract.getPostCount();
        } catch (error) {
            logger.error('Error getting post count:', error);
            throw error;
        }
    }
    
    async getPostsByAuthor(author, limit = 10, offset = 0) {
        try {
            if (!this.socialMediaContract) {
                throw new Error('Social media contract not initialized. Please compile and deploy contracts first.');
            }
            
            const posts = await this.socialMediaContract.getPostsByAuthor(author, limit, offset);
            return posts.map(post => ({
                id: post.id.toString(),
                author: post.author,
                content: post.content,
                mediaURI: post.mediaURI,
                likes: post.likes.toString(),
                comments: post.comments.toString(),
                timestamp: new Date(parseInt(post.timestamp) * 1000),
                isNFT: post.isNFT,
                metadata: post.metadata
            }));
        } catch (error) {
            logger.error(`Error getting posts by author ${author}:`, error);
            throw error;
        }
    }
    
    // Governance Contract Methods
    async getProposal(proposalId) {
        try {
            if (!this.governanceContract) {
                throw new Error('Governance contract not initialized. Please compile and deploy contracts first.');
            }
            
            const proposal = await this.governanceContract.getProposal(proposalId);
            return {
                id: proposal.id.toString(),
                proposer: proposal.proposer,
                title: proposal.title,
                description: proposal.description,
                forVotes: proposal.forVotes.toString(),
                againstVotes: proposal.againstVotes.toString(),
                startTime: new Date(parseInt(proposal.startTime) * 1000),
                endTime: new Date(parseInt(proposal.endTime) * 1000),
                executed: proposal.executed,
                canceled: proposal.canceled
            };
        } catch (error) {
            logger.error(`Error getting proposal ${proposalId}:`, error);
            throw error;
        }
    }
    
    async getProposalCount() {
        try {
            if (!this.governanceContract) {
                throw new Error('Governance contract not initialized. Please compile and deploy contracts first.');
            }
            
            return await this.governanceContract.getProposalCount();
        } catch (error) {
            logger.error('Error getting proposal count:', error);
            throw error;
        }
    }
    
    async getVotingPower(address) {
        try {
            if (!this.governanceContract) {
                throw new Error('Governance contract not initialized. Please compile and deploy contracts first.');
            }
            
            return await this.governanceContract.votingPower(address);
        } catch (error) {
            logger.error(`Error getting voting power for ${address}:`, error);
            throw error;
        }
    }
    
    // Moderation Contract Methods
    async submitFeedback(contentId, score, userAddress) {
        try {
            if (!this.moderationContract) {
                throw new Error('Moderation contract not initialized. Please compile and deploy contracts first.');
            }
            
            // This would require a signer for write operations
            // For now, we'll just log the feedback
            logger.info(`Feedback submitted: Content ${contentId}, Score ${score}, User ${userAddress}`);
            
            return { success: true, message: 'Feedback submitted successfully' };
        } catch (error) {
            logger.error('Error submitting feedback:', error);
            throw error;
        }
    }
    
    // Utility Methods
    async getContractAddresses() {
        return this.contractAddresses;
    }
    
    async getContractStatus() {
        return {
            socialMedia: !!this.socialMediaContract,
            governance: !!this.governanceContract,
            moderation: !!this.moderationContract,
            provider: !!this.provider,
            isInitialized: this.isInitialized,
            hasAddresses: Object.keys(this.contractAddresses).length > 0,
            hasABIs: Object.values(this.contractABIs).some(abi => abi !== null)
        };
    }
    
    // Event Listeners
    async listenToPostEvents() {
        if (!this.socialMediaContract) return;
        
        this.socialMediaContract.on('PostCreated', (postId, author, content, isNFT) => {
            logger.info(`New post created: ID ${postId}, Author ${author}, NFT: ${isNFT}`);
        });
        
        this.socialMediaContract.on('PostLiked', (postId, liker) => {
            logger.info(`Post ${postId} liked by ${liker}`);
        });
        
        this.socialMediaContract.on('PostUnliked', (postId, unliker) => {
            logger.info(`Post ${postId} unliked by ${unliker}`);
        });
    }
    
    async listenToGovernanceEvents() {
        if (!this.governanceContract) return;
        
        this.governanceContract.on('ProposalCreated', (proposalId, proposer, title) => {
            logger.info(`New proposal: ID ${proposalId}, Title: ${title}, Proposer: ${proposer}`);
        });
        
        this.governanceContract.on('Voted', (proposalId, voter, support) => {
            const voteType = support === 1 ? 'FOR' : 'AGAINST';
            logger.info(`Vote on proposal ${proposalId}: ${voter} voted ${voteType}`);
        });
    }
}

module.exports = new BlockchainService();
