import React from "react";
import PostCard from "../components/PostCard";

const samplePosts = [
  {
    id: 1,
    author: "Alice",
    content: "Hello Web3! This is my first decentralized post.",
    likes: 5,
    comments: 2,
    isNFT: true,
    mediaUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 2,
    author: "Bob",
    content: "Decentralized FTW 🚀 Let's build censorship-resistant communities!",
    likes: 12,
    comments: 4,
    isNFT: false
  },
];

const Home = () => {
  return (
    <div style={{ maxWidth: 500, margin: '32px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Home Feed</h1>
      {samplePosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

export default Home;
