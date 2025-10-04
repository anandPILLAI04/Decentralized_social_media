
import React, { useRef, useState } from "react";
import { Box, Avatar, Typography, TextField, Button, Paper, Switch, FormControlLabel, IconButton } from "@mui/material";
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { createPostOnChain } from "../services/contractService";
import { createPost as createPostAPI } from "../services/apiService";
import contractAddresses from "../constants/contractAddresses.json";

const user = {
  name: "Alice",
  avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg"
};


const CreatePost = ({ onCreatePost, walletAddress, loading }) => {
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [mintNFT, setMintNFT] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef();

  // Set contract address in contractService
  if (contractAddresses.socialMedia && window && window.ethereum) {
    // Patch contract address in contractService if needed
    // (Alternatively, contractService can import this file directly)
  }

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
      setImageFile(e.target.files[0]);
    }
  };

  // Placeholder for image upload to IPFS (returns empty string for now)
  async function uploadImageToIPFS(file) {
    // TODO: Integrate with IPFS
    return "";
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      let mediaURI = "";
      if (imageFile) {
        mediaURI = await uploadImageToIPFS(imageFile);
      }
      if (mintNFT) {
        // Warn if no ETH
        if (!window.ethereum) {
          alert("MetaMask not found. Please install MetaMask to mint as NFT.");
          setSubmitting(false);
          return;
        }
        const provider = new window.ethereum.constructor(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const balance = accounts.length > 0 ? await window.ethereum.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] }) : '0x0';
        if (parseInt(balance, 16) === 0) {
          alert("You need ETH to mint as NFT. Posting as regular post instead.");
        } else {
          await createPostOnChain({ content, mediaURI, mintAsNFT: true, metadata: "" });
          if (onCreatePost) onCreatePost({ content, image: mediaURI, mintNFT: true });
          setContent(""); setImage(null); setImageFile(null); setMintNFT(false); setSubmitting(false);
          return;
        }
      }
      // Default: post off-chain (free)
      await createPostAPI({ content, mediaUrl: mediaURI, mintNFT: false });
      if (onCreatePost) onCreatePost({ content, image: mediaURI, mintNFT: false });
      setContent(""); setImage(null); setImageFile(null); setMintNFT(false);
    } catch (err) {
      alert("Failed to create post: " + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar src={user.avatarUrl} sx={{ width: 56, height: 56, fontWeight: 700 }} />
          <Typography variant="h6" fontWeight={700}>Create Post</Typography>
        </Box>
        <form onSubmit={handleSubmit}>
          <TextField
            label="What's happening?"
            multiline
            minRows={3}
            fullWidth
            variant="outlined"
            value={content}
            onChange={e => setContent(e.target.value)}
            sx={{ mb: 2 }}
            disabled={submitting || loading}
          />
          {image && (
            <Box mb={2}>
              <img src={image} alt="Preview" style={{ width: '100%', borderRadius: 10, maxHeight: 300, objectFit: 'cover', border: '1px solid #eee' }} />
            </Box>
          )}
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImageChange}
              disabled={submitting || loading}
            />
            <IconButton color="primary" onClick={() => fileInputRef.current.click()} disabled={submitting || loading}>
              <AddPhotoAlternateIcon />
            </IconButton>
            <FormControlLabel
              control={<Switch checked={mintNFT} onChange={e => setMintNFT(e.target.checked)} color="primary" disabled={submitting || loading} />}
              label="Mint as NFT"
            />
          </Box>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
            disabled={!content.trim() || submitting || loading}
            type="submit"
          >
            {submitting || loading ? "Posting..." : "Post"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default CreatePost;
