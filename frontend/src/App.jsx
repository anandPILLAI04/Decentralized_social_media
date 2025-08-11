import React, { useState, useEffect } from "react";
import useWallet from "./hooks/useWallet";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Governance from "./pages/Governance";
import Auth from "./pages/Auth";

function App() {
  // Wallet and profile states
  const wallet = useWallet();
  const [googleProfile, setGoogleProfile] = useState(null);
  const [manualProfile, setManualProfile] = useState(null);
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: "0x1234...abcd",
      content: "Hello Web3! This is my first decentralized post.",
      likes: 5,
      comments: 2,
      isNFT: true,
      mediaUrl:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80"
    },
    {
      id: 2,
      author: "0x5678...ef12",
      content:
        "Decentralized FTW 🚀 Let's build censorship-resistant communities!",
      likes: 12,
      comments: 4,
      isNFT: false
    }
  ]);

  const location = useLocation();

  // Simulate persistent auth (replace with real logic later)
  useEffect(() => {
    const registered = localStorage.getItem("registered");
    if (wallet.address && !registered) {
      localStorage.setItem("registered", "true");
    }
  }, [wallet.address]);

  const isRegistered =
    wallet.address || localStorage.getItem("registered") === "true";

  // Redirect to /auth if not registered
  if (!isRegistered && location.pathname !== "/auth") {
    return <Navigate to="/auth" replace />;
  }

  // Auth page component
  function AuthPage() {
    return (
      <Auth
        onWalletConnect={wallet.connect}
        onGoogleSignIn={() =>
          setGoogleProfile({
            name: "Alice G.",
            imageUrl: "https://randomuser.me/api/portraits/women/45.jpg"
          })
        }
        onManualSignUp={setManualProfile}
        walletConnected={!!wallet.address}
        googleProfile={googleProfile}
      />
    );
  }

  // Handle new post creation
  function handleCreatePost({ content, image, mintNFT }) {
    const newPost = {
      id: Date.now(),
      author: wallet.address
        ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
        : "Anonymous",
      content,
      likes: 0,
      comments: 0,
      isNFT: mintNFT,
      mediaUrl: image || undefined
    };
    setPosts([newPost, ...posts]);
  }

  return (
    <>
      <NavBar
        walletAddress={wallet.address}
        onWalletConnect={wallet.connect}
        connecting={wallet.connecting}
      />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Home posts={posts} />} />
        <Route
          path="/profile"
          element={<Profile posts={posts} walletAddress={wallet.address} />}
        />
        <Route
          path="/create"
          element={
            <CreatePost
              onCreatePost={handleCreatePost}
              walletAddress={wallet.address}
            />
          }
        />
        <Route path="/governance" element={<Governance />} />
      </Routes>
    </>
  );
}

export default App;
