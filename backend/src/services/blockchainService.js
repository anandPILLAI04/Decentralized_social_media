const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class BlockchainService {
    constructor() {
        this.provider = null;
        this.socialMediaContract = null;
        this.governanceContract = null;
        this.moderationContract = null;
        this.contractAddresses = {};
        this.contractABIs = {};
        this.isInitialized = false;
        
        this.initializeContracts();
    }
    
    async initializeContracts() {
        try {
            // Load contract addresses
            const addressesPath = path.join(__dirname, '../../../shared/constants/contractAddresses.json');
            if (fs.existsSync(addressesPath)) {
                this.contractAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
            } else {
                console.log('⚠️  Contract addresses file not found. Run "npm run deploy:contracts" first.');
                this.contractAddresses = {};
            }
            
            // Try to load contract ABIs (they may not exist yet)
            try {
                this.contractABIs.socialMedia = require('../../../blockchain/artifacts/contracts/SocialMediaNFT.sol/SocialMediaNFT.json').abi;
            } catch (error) {
                console.log('⚠️  SocialMediaNFT contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.socialMedia = null;
            }
            
            try {
                this.contractABIs.governance = require('../../../blockchain/artifacts/contracts/Governance.sol/Governance.json').abi;
            } catch (error) {
                console.log('⚠️  Governance contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.governance = null;
            }
            
            try {
                this.contractABIs.moderation = require('../../../blockchain/artifacts/contracts/Moderation.sol/Moderation.json').abi;
            } catch (error) {
                console.log('⚠️  Moderation contract not compiled yet. Run "npm run compile:contracts" first.');
                this.contractABIs.moderation = null;
            }
            
            // Initialize provider (for read operations)
            this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'http://localhost:8545');
            
            // Initialize contracts only if ABIs and addresses are available
            if (this.contractAddresses.socialMedia && this.contractABIs.socialMedia) {
                this.socialMediaContract = new ethers.Contract(
                    this.contractAddresses.socialMedia,
                    this.contractABIs.socialMedia,
                    this.provider
                );
                console.log('✅ SocialMediaNFT contract initialized');
            }
            
            if (this.contractAddresses.governance && this.contractABIs.governance) {
                this.governanceContract = new ethers.Contract(
                    this.contractAddresses.governance,
                    this.contractABIs.governance,
                    this.provider
                );
                console.log('✅ Governance contract initialized');
            }
            
            if (this.contractAddresses.moderation && this.contractABIs.moderation) {
                this.moderationContract = new ethers.Contract(
                    this.contractAddresses.moderation,
                    this.contractABIs.moderation,
                    this.provider
                );
                console.log('✅ Moderation contract initialized');
            }
            
            this.isInitialized = true;
            console.log('🚀 Blockchain service initialized successfully');
            
            // Provide helpful instructions if contracts aren't ready
            if (!this.socialMediaContract && !this.governanceContract && !this.moderationContract) {
                console.log('\n📋 To complete setup, run these commands:');
                console.log('1. cd blockchain && npm run compile');
                console.log('2. npm run deploy:contracts');
                console.log('3. Restart the backend server\n');
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize blockchain service:', error.message);
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
            console.error(`Error getting post ${postId}:`, error);
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
            console.error('Error getting post count:', error);
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
            console.error(`Error getting posts by author ${author}:`, error);
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
            console.error(`Error getting proposal ${proposalId}:`, error);
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
            console.error('Error getting proposal count:', error);
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
            console.error(`Error getting voting power for ${address}:`, error);
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
            console.log(`Feedback submitted: Content ${contentId}, Score ${score}, User ${userAddress}`);
            
            return { success: true, message: 'Feedback submitted successfully' };
        } catch (error) {
            console.error('Error submitting feedback:', error);
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
            console.log(`New post created: ID ${postId}, Author ${author}, NFT: ${isNFT}`);
        });
        
        this.socialMediaContract.on('PostLiked', (postId, liker) => {
            console.log(`Post ${postId} liked by ${liker}`);
        });
        
        this.socialMediaContract.on('PostUnliked', (postId, unliker) => {
            console.log(`Post ${postId} unliked by ${unliker}`);
        });
    }
    
    async listenToGovernanceEvents() {
        if (!this.governanceContract) return;
        
        this.governanceContract.on('ProposalCreated', (proposalId, proposer, title) => {
            console.log(`New proposal: ID ${proposalId}, Title: ${title}, Proposer: ${proposer}`);
        });
        
        this.governanceContract.on('Voted', (proposalId, voter, support) => {
            const voteType = support === 1 ? 'FOR' : 'AGAINST';
            console.log(`Vote on proposal ${proposalId}: ${voter} voted ${voteType}`);
        });
    }
}

module.exports = new BlockchainService();
