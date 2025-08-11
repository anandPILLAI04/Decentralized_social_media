const express = require("express");
const router = express.Router();
const blockchainService = require("../services/blockchainService");

// In-memory storage for demo purposes (replace with database in production)
let proposals = [
  {
    id: 1,
    proposer: "0x1234...abcd",
    proposerName: "Alice",
    title: "Implement Community Moderation",
    description: "Proposal to implement community-driven content moderation system with voting mechanisms.",
    forVotes: 1500,
    againstVotes: 200,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    executed: false,
    canceled: false,
    status: "active"
  },
  {
    id: 2,
    proposer: "0x5678...ef12",
    proposerName: "Bob",
    title: "Add NFT Marketplace Integration",
    description: "Integrate NFT marketplace functionality to allow users to trade their social media NFTs.",
    forVotes: 800,
    againstVotes: 300,
    startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    executed: true,
    canceled: false,
    status: "executed"
  }
];

// Get all proposals
router.get("/proposals", async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let filteredProposals = proposals;
    if (status) {
      filteredProposals = proposals.filter(p => p.status === status);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedProposals = filteredProposals.slice(startIndex, endIndex);
    const totalProposals = filteredProposals.length;
    
    res.json({
      success: true,
      proposals: paginatedProposals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProposals / limit),
        totalProposals,
        hasNext: endIndex < totalProposals,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get proposal by ID
router.get("/proposals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = proposals.find(p => p.id === parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ success: false, error: "Proposal not found" });
    }
    
    res.json({ success: true, proposal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new proposal
router.post("/proposals", async (req, res) => {
  try {
    const { title, description, proposer, proposerName } = req.body;
    
    if (!title || !description || !proposer) {
      return res.status(400).json({ 
        success: false, 
        error: "Title, description, and proposer are required" 
      });
    }
    
    const newProposal = {
      id: Date.now(),
      proposer,
      proposerName: proposerName || proposer.slice(0, 6) + "..." + proposer.slice(-4),
      title,
      description,
      forVotes: 0,
      againstVotes: 0,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      executed: false,
      canceled: false,
      status: "active"
    };
    
    proposals.unshift(newProposal);
    
    res.status(201).json({ success: true, proposal: newProposal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vote on proposal
router.post("/proposals/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const { support, voter, votingPower } = req.body;
    
    if (!support || !voter) {
      return res.status(400).json({ 
        success: false, 
        error: "Support (1 for, 2 against) and voter are required" 
      });
    }
    
    if (support !== 1 && support !== 2) {
      return res.status(400).json({ 
        success: false, 
        error: "Support must be 1 (for) or 2 (against)" 
      });
    }
    
    const proposal = proposals.find(p => p.id === parseInt(id));
    if (!proposal) {
      return res.status(404).json({ success: false, error: "Proposal not found" });
    }
    
    if (proposal.status !== "active") {
      return res.status(400).json({ 
        success: false, 
        error: "Proposal is not active for voting" 
      });
    }
    
    if (new Date() > proposal.endTime) {
      return res.status(400).json({ 
        success: false, 
        error: "Voting period has ended" 
      });
    }
    
    // Check if user already voted
    if (!proposal.votes) proposal.votes = new Map();
    if (proposal.votes.has(voter)) {
      return res.status(400).json({ 
        success: false, 
        error: "User has already voted on this proposal" 
      });
    }
    
    // Record vote
    proposal.votes.set(voter, support);
    const power = votingPower || 100; // Default voting power
    
    if (support === 1) {
      proposal.forVotes += power;
    } else {
      proposal.againstVotes += power;
    }
    
    res.json({ 
      success: true, 
      message: "Vote recorded successfully",
      forVotes: proposal.forVotes,
      againstVotes: proposal.againstVotes
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute proposal
router.post("/proposals/:id/execute", async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = proposals.find(p => p.id === parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ success: false, error: "Proposal not found" });
    }
    
    if (proposal.executed) {
      return res.status(400).json({ 
        success: false, 
        error: "Proposal already executed" 
      });
    }
    
    if (proposal.canceled) {
      return res.status(400).json({ 
        success: false, 
        error: "Proposal was canceled" 
      });
    }
    
    if (new Date() < proposal.endTime) {
      return res.status(400).json({ 
        success: false, 
        error: "Voting period has not ended yet" 
      });
    }
    
    const totalVotes = proposal.forVotes + proposal.againstVotes;
    if (totalVotes < 1000) { // Minimum quorum
      return res.status(400).json({ 
        success: false, 
        error: "Quorum not reached" 
      });
    }
    
    if (proposal.forVotes <= proposal.againstVotes) {
      return res.status(400).json({ 
        success: false, 
        error: "Proposal did not pass" 
      });
    }
    
    proposal.executed = true;
    proposal.status = "executed";
    
    res.json({ 
      success: true, 
      message: "Proposal executed successfully",
      proposal 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel proposal
router.post("/proposals/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;
    const { canceler } = req.body;
    
    const proposal = proposals.find(p => p.id === parseInt(id));
    if (!proposal) {
      return res.status(404).json({ success: false, error: "Proposal not found" });
    }
    
    if (proposal.proposer !== canceler) {
      return res.status(403).json({ 
        success: false, 
        error: "Only the proposer can cancel the proposal" 
      });
    }
    
    if (proposal.executed || proposal.canceled) {
      return res.status(400).json({ 
        success: false, 
        error: "Proposal cannot be canceled" 
      });
    }
    
    proposal.canceled = true;
    proposal.status = "canceled";
    
    res.json({ 
      success: true, 
      message: "Proposal canceled successfully",
      proposal 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get voting statistics
router.get("/stats", async (req, res) => {
  try {
    const totalProposals = proposals.length;
    const activeProposals = proposals.filter(p => p.status === "active").length;
    const executedProposals = proposals.filter(p => p.status === "executed").length;
    const canceledProposals = proposals.filter(p => p.status === "canceled").length;
    
    const totalVotes = proposals.reduce((sum, p) => sum + p.forVotes + p.againstVotes, 0);
    const totalForVotes = proposals.reduce((sum, p) => sum + p.forVotes, 0);
    const totalAgainstVotes = proposals.reduce((sum, p) => sum + p.againstVotes, 0);
    
    res.json({
      success: true,
      stats: {
        totalProposals,
        activeProposals,
        executedProposals,
        canceledProposals,
        totalVotes,
        totalForVotes,
        totalAgainstVotes,
        participationRate: totalProposals > 0 ? (totalVotes / (totalProposals * 1000)) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
