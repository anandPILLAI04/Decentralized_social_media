const express = require("express");
const router = express.Router();
const blockchainService = require("../services/blockchainService");

// In-memory storage for demo purposes (replace with database in production)
let posts = [
  {
    id: 1,
    author: "0x1234...abcd",
    content: "Hello Web3! This is my first decentralized post.",
    likes: 5,
    comments: 2,
    isNFT: true,
    mediaUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80",
    timestamp: new Date(),
    authorName: "Alice"
  },
  {
    id: 2,
    author: "0x5678...ef12",
    content: "Decentralized FTW 🚀 Let's build censorship-resistant communities!",
    likes: 12,
    comments: 4,
    isNFT: false,
    timestamp: new Date(),
    authorName: "Bob"
  }
];

// Get all posts
router.get("/posts", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedPosts = posts.slice(startIndex, endIndex);
    const totalPosts = posts.length;
    
    res.json({
      success: true,
      posts: paginatedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasNext: endIndex < totalPosts,
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
    const post = posts.find(p => p.id === parseInt(id));
    
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
    
    const newPost = {
      id: Date.now(),
      author,
      authorName: authorName || author.slice(0, 6) + "..." + author.slice(-4),
      content,
      likes: 0,
      comments: 0,
      isNFT: mintNFT || false,
      mediaUrl,
      timestamp: new Date()
    };
    
    posts.unshift(newPost);
    
    res.status(201).json({ success: true, post: newPost });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Like/unlike post
router.post("/posts/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userAddress } = req.body;
    
    const post = posts.find(p => p.id === parseInt(id));
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    // Simple like toggle (in production, use blockchain)
    if (!post.likedBy) post.likedBy = new Set();
    
    if (post.likedBy.has(userAddress)) {
      post.likedBy.delete(userAddress);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.add(userAddress);
      post.likes++;
    }
    
    res.json({ success: true, likes: post.likes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment to post
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author, authorName } = req.body;
    
    if (!content || !author) {
      return res.status(400).json({ 
        success: false, 
        error: "Comment content and author are required" 
      });
    }
    
    const post = posts.find(p => p.id === parseInt(id));
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    if (!post.commentsList) post.commentsList = [];
    
    const newComment = {
      id: Date.now(),
      content,
      author,
      authorName: authorName || author.slice(0, 6) + "..." + author.slice(-4),
      timestamp: new Date()
    };
    
    post.commentsList.push(newComment);
    post.comments++;
    
    res.status(201).json({ success: true, comment: newComment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comments for a post
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const post = posts.find(p => p.id === parseInt(id));
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    const comments = post.commentsList || [];
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedComments = comments.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      comments: paginatedComments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(comments.length / limit),
        totalComments: comments.length
      }
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
    
    const authorPosts = posts.filter(p => 
      p.author.toLowerCase() === address.toLowerCase()
    );
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedPosts = authorPosts.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      posts: paginatedPosts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(authorPosts.length / limit),
        totalPosts: authorPosts.length
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
    
    const searchResults = posts.filter(post =>
      post.content.toLowerCase().includes(q.toLowerCase()) ||
      post.authorName.toLowerCase().includes(q.toLowerCase())
    );
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedResults = searchResults.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      posts: paginatedResults,
      query: q,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(searchResults.length / limit),
        totalResults: searchResults.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
