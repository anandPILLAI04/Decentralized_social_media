import React, { useRef, useState } from "react";
import { Box, Avatar, Typography, TextField, Button, Paper, Switch, FormControlLabel, IconButton } from "@mui/material";
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const user = {
  name: "Alice",
  avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg"
};

const CreatePost = () => {
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [mintNFT, setMintNFT] = useState(false);
  const fileInputRef = useRef();

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar src={user.avatarUrl} sx={{ width: 56, height: 56, fontWeight: 700 }} />
          <Typography variant="h6" fontWeight={700}>Create Post</Typography>
        </Box>
        <TextField
          label="What's happening?"
          multiline
          minRows={3}
          fullWidth
          variant="outlined"
          value={content}
          onChange={e => setContent(e.target.value)}
          sx={{ mb: 2 }}
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
          />
          <IconButton color="primary" onClick={() => fileInputRef.current.click()}>
            <AddPhotoAlternateIcon />
          </IconButton>
          <FormControlLabel
            control={<Switch checked={mintNFT} onChange={e => setMintNFT(e.target.checked)} color="primary" />}
            label="Mint as NFT"
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
          disabled={!content.trim()}
        >
          Post
        </Button>
      </Paper>
    </Box>
  );
};

export default CreatePost;
