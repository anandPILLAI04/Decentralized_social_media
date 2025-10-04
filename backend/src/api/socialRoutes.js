const { uploadToIPFS } = require('../../../shared/helpers/ipfsUpload');
const multer = require('multer');
const upload = multer();
// Upload file to IPFS (Pinata)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const ipfsHash = await uploadToIPFS(req.file.buffer, req.file.originalname);
    res.json({ success: true, ipfsHash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");

// Get all posts (paginated)
router.get("/posts", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const totalPosts = await Post.countDocuments();
    const posts = await Post.find().sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasNext: skip + posts.length < totalPosts,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get post by ID
router.get("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new post
router.post("/posts", async (req, res) => {
  try {
    const { content, mediaUrl, mintNFT, author, authorName } = req.body;
    if (!content || !author) {
      return res.status(400).json({ 
        success: false, 
        error: "Content and author are required" 
      });
    }
    const post = new Post({
      authorId: author,
      content,
      mediaUrl,
      isNFT: mintNFT || false,
      authorName: authorName || author.slice(0, 6) + "..." + author.slice(-4),
    });
    await post.save();
    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Like/unlike post
router.post("/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    // For demo: just increment likesCount (no user tracking)
    post.likesCount = (post.likesCount || 0) + 1;
    await post.save();
    res.json({ success: true, likes: post.likesCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment to post (for now, just increment commentCount)
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    post.commentCount = (post.commentCount || 0) + 1;
    await post.save();
    res.status(201).json({ success: true, commentCount: post.commentCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comments for a post (not implemented, returns count only)
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    res.json({
      success: true,
      commentCount: post.commentCount || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get posts by author
router.get("/posts/author/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const totalPosts = await Post.countDocuments({ authorId: address });
    const posts = await Post.find({ authorId: address }).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
    res.json({
      success: true,
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search posts
router.get("/search", async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        error: "Search query is required" 
      });
    }
    const skip = (page - 1) * limit;
    const query = {
      $or: [
        { content: { $regex: q, $options: 'i' } },
        { authorName: { $regex: q, $options: 'i' } }
      ]
    };
    const totalResults = await Post.countDocuments(query);
    const posts = await Post.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
    res.json({
      success: true,
      posts,
      query: q,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResults / limit),
        totalResults
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
