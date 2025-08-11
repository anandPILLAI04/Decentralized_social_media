const express = require("express");
const router = express.Router();
const blockchainService = require("../services/blockchainService");

// Get blockchain service status
router.get("/status", async (req, res) => {
  try {
    const status = await blockchainService.getContractStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get contract addresses
router.get("/addresses", async (req, res) => {
  try {
    const addresses = await blockchainService.getContractAddresses();
    if (Object.keys(addresses).length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "No contract addresses found. Please deploy contracts first.",
        instructions: [
          "1. cd blockchain && npm run compile",
          "2. npm run deploy:contracts",
          "3. Restart the backend server"
        ]
      });
    }
    res.json({ success: true, addresses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get post from blockchain
router.get("/posts/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await blockchainService.getPost(postId);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

// Get post count
router.get("/posts/count", async (req, res) => {
  try {
    const count = await blockchainService.getPostCount();
    res.json({ success: true, count: count.toString() });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

// Get posts by author
router.get("/posts/author/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const posts = await blockchainService.getPostsByAuthor(address, parseInt(limit), parseInt(offset));
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

// Get governance proposal
router.get("/governance/proposals/:proposalId", async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await blockchainService.getProposal(proposalId);
    res.json({ success: true, proposal });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

// Get proposal count
router.get("/governance/proposals/count", async (req, res) => {
  try {
    const count = await blockchainService.getProposalCount();
    res.json({ success: true, count: count.toString() });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

// Get voting power
router.get("/governance/voting-power/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const power = await blockchainService.getVotingPower(address);
    res.json({ success: true, power: power.toString() });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Make sure contracts are compiled and deployed"
    });
  }
});

module.exports = router;
