const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
const User = require('../src/models/User');
const Post = require('../src/models/Post');

// MongoDB connection
const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/decentralized_social';
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    return false;
  }
};

// Sample users data
const users = [
  {
    walletAddress: '0x1234567890123456789012345678901234567890',
    username: 'alice',
    avatar: 'https://i.pravatar.cc/150?img=1',
    bio: 'Web3 enthusiast and developer',
    email: 'alice@example.com'
  },
  {
    walletAddress: '0x2345678901234567890123456789012345678901',
    username: 'bob',
    avatar: 'https://i.pravatar.cc/150?img=3',
    bio: 'Blockchain entrepreneur',
    email: 'bob@example.com'
  },
  {
    walletAddress: '0x3456789012345678901234567890123456789012',
    username: 'charlie',
    avatar: 'https://i.pravatar.cc/150?img=7',
    bio: 'Crypto artist and NFT collector',
    email: 'charlie@example.com'
  }
];

// Sample posts data
const generatePosts = (users) => {
  return [
    {
      authorId: users[0].walletAddress,
      content: 'Just deployed my first smart contract on Polygon! #Web3 #Blockchain',
      ipfsHash: 'QmZVR4wchP3xQguvqg3Qn5YgBV7YVK6rz5JZkqV7ToaYxM',
      authorName: users[0].username,
      timestamp: new Date(),
      likesCount: 5,
      commentCount: 2,
      isNFT: false
    },
    {
      authorId: users[1].walletAddress,
      content: 'Check out my latest NFT collection on OpenSea',
      mediaUrl: 'https://picsum.photos/id/1/500/300',
      ipfsHash: 'QmZVR4wchP3xQguvqg3Qn5YgBV7YVK6rz5JZkqV7ToaYxN',
      authorName: users[1].username,
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      likesCount: 12,
      commentCount: 3,
      isNFT: true,
      nftTokenId: '1'
    },
    {
      authorId: users[2].walletAddress,
      content: 'Learning about IPFS and decentralized storage today',
      ipfsHash: 'QmZVR4wchP3xQguvqg3Qn5YgBV7YVK6rz5JZkqV7ToaYxO',
      authorName: users[2].username,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      likesCount: 8,
      commentCount: 1,
      isNFT: false
    },
    {
      authorId: users[0].walletAddress,
      content: 'Decentralization is the future of the internet',
      ipfsHash: 'QmZVR4wchP3xQguvqg3Qn5YgBV7YVK6rz5JZkqV7ToaYxP',
      authorName: users[0].username,
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      likesCount: 15,
      commentCount: 5,
      isNFT: false
    }
  ];
};

// Seed database
const seedDB = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Post.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Insert users
    const createdUsers = await User.insertMany(users);
    console.log(`👤 Inserted ${createdUsers.length} users`);

    // Insert posts
    const posts = generatePosts(users);
    const createdPosts = await Post.insertMany(posts);
    console.log(`📝 Inserted ${createdPosts.length} posts`);

    console.log('✅ Database seeded successfully!');
    return { users: createdUsers, posts: createdPosts };
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    // Connect to MongoDB
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // Seed database
    await seedDB();

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
    
    console.log('✨ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

// Run script
main();
