
import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Avatar, Typography, TextField, Button, Paper, Switch,
  FormControlLabel, IconButton, Alert, Snackbar, CircularProgress,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import { createPostOnChain } from "../services/contractService";
import {
  createPost as createPostAPI,
  uploadFileToIPFS,
  uploadJSONToIPFS,
  getUserProfile
} from "../services/apiService";
import { getUserProfile as getSafeUserProfile } from '../utils/safeStorage';
import { getIPFSUrl } from "../services/ipfsService";
import contractAddresses from "../constants/contractAddresses.json";
import ImageCropModal from "../components/ImageCropModal";

const CreatePost = ({ onCreatePost, walletAddress, loading }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [mintNFT, setMintNFT] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef();
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState(null);

  // Suspension/Ban dialog state
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [suspensionMessage, setSuspensionMessage] = useState("");
  const [suspensionDetails, setSuspensionDetails] = useState(null);

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, [walletAddress]);

  const loadUserProfile = async () => {
    if (!walletAddress) return;
    
    try {
      const profileRes = await getUserProfile(walletAddress);
      if (profileRes && profileRes.user) {
        setUser(profileRes.user);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      // Fallback to localStorage
      const savedProfile = getSafeUserProfile();
      if (savedProfile) {
        setUser(savedProfile);
      }
    }
  };

  const handleCloseSnackbar = () => {
    setError(null);
    setSuccess(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    // File size validation (10MB limit for original, will be compressed after crop)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Please select an image under 10MB");
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please select an image file");
      return;
    }
    
    // Read file and open crop modal
    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImageSrc(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle crop complete
  const handleCropComplete = (croppedFile) => {
    setImageFile(croppedFile);
    setImage(URL.createObjectURL(croppedFile));
    setShowCropModal(false);
    setSuccess(false); // Clear any previous success messages
  };

  // Upload image to IPFS and return CID
  async function uploadImageToIPFS(file) {
    if (!file) return "";
    setUploadProgress(25);
    try {
      console.log('📤 Starting image upload:', file.name, file.type, file.size);
      const response = await uploadFileToIPFS(file);
      console.log('📦 Upload response:', response);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to upload image");
      }
      
      console.log('✅ Image uploaded successfully! CID:', response.ipfsHash);
      setUploadProgress(50);
      return response.ipfsHash;
    } catch (err) {
      console.error("❌ Error uploading image to IPFS:", err);
      throw new Error(`Image upload failed: ${err.message}`);
    }
  }

  // Upload post content to IPFS and return CID
  async function uploadContentToIPFS(content) {
    try {
      setUploadProgress(75);
      const response = await uploadJSONToIPFS({ 
        content,
        timestamp: new Date().toISOString(),
        type: "post"
      });
      
      if (!response.success) {
        throw new Error(response.error || "Failed to upload content");
      }
      
      setUploadProgress(100);
      return response.ipfsHash;
    } catch (err) {
      console.error("Error uploading content to IPFS:", err);
      throw new Error(`Content upload failed: ${err.message}`);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Please enter some content");
      return;
    }
    
    setError(null);
    setSubmitting(true);
    setUploadProgress(0);
    
    try {
      // Make sure user is connected with wallet
      if (!walletAddress) {
        throw new Error("Please connect your wallet to create a post");
      }
      
      setUploadProgress(10);
      
      // 1. Upload image to IPFS first (if any)
      let mediaCID = "";
      let mediaUrl = "";
      if (imageFile) {
        console.log("📤 Uploading image to IPFS...");
        mediaCID = await uploadImageToIPFS(imageFile);
        mediaUrl = mediaCID; // Store the CID
        console.log("✅ Image uploaded:", mediaCID);
      }
      
      setUploadProgress(40);
      
      // 2. Optionally upload content to IPFS for NFT posts
      let contentCID = "";
      if (mintNFT) {
        console.log("📤 Uploading content to IPFS for NFT...");
        contentCID = await uploadContentToIPFS(content);
        console.log("✅ Content uploaded:", contentCID);
      }
      
      setUploadProgress(60);
      
      // 3. Store on blockchain if minting as NFT
      if (mintNFT) {
        if (!window.ethereum) {
          throw new Error("MetaMask not found. Please install MetaMask to mint as NFT.");
        }
        
        // Check network first
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const chainIdNum = parseInt(chainId, 16);
          
          if (chainIdNum !== 80002) {
            console.log(`Wrong network detected: ${chainIdNum}. Requesting switch to Amoy...`);
            
            // Try to switch network automatically
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x13882' }], // 80002 in hex
              });
              console.log("✅ Switched to Amoy network");
            } catch (switchError) {
              // If network not added, try to add it
              if (switchError.code === 4902) {
                try {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x13882',
                      chainName: 'Polygon Amoy Testnet',
                      nativeCurrency: {
                        name: 'POL',
                        symbol: 'POL',
                        decimals: 18
                      },
                      rpcUrls: ['https://rpc-amoy.polygon.technology'],
                      blockExplorerUrls: ['https://amoy.polygonscan.com']
                    }]
                  });
                  console.log("✅ Added and switched to Amoy network");
                } catch (addError) {
                  throw new Error(`Failed to add Polygon Amoy network. Please add it manually in MetaMask.`);
                }
              } else if (switchError.code === 4001) {
                throw new Error(`Please approve the network switch in MetaMask to continue.`);
              } else {
                throw new Error(`⚠️ Wrong Network!\n\nYou're on Chain ID ${chainIdNum}.\nPlease switch MetaMask to Polygon Amoy (Chain ID: 80002)`);
              }
            }
          }
        } catch (networkError) {
          if (networkError.message.includes('Wrong Network') || networkError.message.includes('approve') || networkError.message.includes('add')) {
            throw networkError;
          }
          console.warn("Could not check network:", networkError);
        }
        
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) {
          throw new Error("Please connect your wallet to mint as NFT");
        }
        
        try {
          const balance = await window.ethereum.request({ 
            method: 'eth_getBalance', 
            params: [accounts[0], 'latest'] 
          });
          
          if (parseInt(balance, 16) === 0) {
            throw new Error("You need MATIC tokens to mint as NFT. Please get some from a faucet.");
          }
        } catch (balanceError) {
          console.warn("Could not check balance:", balanceError);
          // Continue anyway - let the transaction fail if insufficient funds
        }
      } // Close the if (mintNFT) network/balance checks block

      setUploadProgress(75);

      // 3. Mint as NFT on blockchain if requested
      let nftTransactionHash = null; // Declare outside if block so it's accessible later

      if (mintNFT) {
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            const mintResult = await createPostOnChain({
              content: contentCID,
              mediaURI: mediaCID,
              mintAsNFT: true,
              metadata: ""
            });
            console.log("✅ NFT minted successfully");
            nftTransactionHash = mintResult.transactionHash;
            console.log("📦 Transaction hash captured:", nftTransactionHash);
            break; // Success! Exit retry loop
          } catch (blockchainError) {
            console.error(`⚠️ Blockchain minting attempt ${retryCount + 1} failed:`, blockchainError);

            // Check if it's a circuit breaker error
            const isCircuitBreaker = blockchainError.message?.includes('circuit breaker') ||
                                     blockchainError.message?.includes('Execution prevented');

            if (isCircuitBreaker && retryCount < maxRetries) {
              retryCount++;
              console.log(`⏳ Waiting 3 seconds before retry ${retryCount}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
              continue; // Retry
            }

            // Final error after retries or non-circuit-breaker error
            if (isCircuitBreaker) {
              throw new Error("⚠️ MetaMask RPC is overloaded. SOLUTIONS:\n\n1️⃣ Uncheck 'Mint as NFT' and post normally (you can mint later)\n2️⃣ Update MetaMask RPC: Use Alchemy endpoint instead of public RPC\n3️⃣ Wait 60 seconds and try again\n\nYour content is already uploaded to IPFS! ✅");
            }

            // Re-throw other errors
            throw blockchainError;
          }
        }
      }
      
      setUploadProgress(80);

      // 4. Store through regular API (always, even for NFT posts)
      console.log("💾 Saving post to database...");
      const response = await createPostAPI({
        content: content, // Store original content for searchability
        ipfsHash: contentCID || "", // Legacy field
        mediaCID: mediaCID || "", // IPFS CID for media file
        mediaUrl: mediaUrl || "", // Legacy/fallback
        mintNFT: mintNFT,
        transactionHash: nftTransactionHash || "", // Include NFT transaction hash
        author: walletAddress,
        authorName: user?.username || user?.displayName || ""
      });
      
      if (!response.success) {
        throw new Error(response.error || "Failed to create post");
      }
      
      console.log("✅ Post created successfully:", response.post);
      setUploadProgress(100);
      
      // Success! Reset form and notify
      setContent(""); 
      setImage(null); 
      setImageFile(null); 
      setMintNFT(false);
      setSuccess(true);
      
      // Notify parent component to reload posts
      if (onCreatePost) {
        onCreatePost(response.post);
      }
      
      // Navigate to home page after 2 seconds
      setTimeout(() => {
        navigate('/home');
      }, 2000);
      
    } catch (err) {
      console.error("❌ Post creation error:", err);

      // Extract detailed error message from backend response
      let errorMessage = err.message;
      let errorCode = null;
      let restrictionDetails = null;

      if (err.responseData?.error) {
        errorCode = err.responseData.error;
        errorMessage = err.responseData.userFriendlyMessage || err.responseData.error;
        restrictionDetails = err.responseData.restriction;
      }

      // Check if this is a suspension/ban error
      if (errorCode === 'ACCOUNT_SUSPENDED' || errorCode === 'ACCOUNT_BANNED') {
        setSuspensionDetails(restrictionDetails);
        setSuspensionMessage(errorMessage);
        setSuspensionDialogOpen(true);
      } else {
        // Regular error - show in alert
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // Get user display info
  const displayName = user?.displayName || user?.username || "User";
  const avatarUrl = user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`;  

  return (
    <Box maxWidth={600} mx="auto" mt={4} px={2}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'grey.200' }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Avatar 
            src={avatarUrl} 
            sx={{ 
              width: 56, 
              height: 56, 
              fontWeight: 700,
              border: '2px solid',
              borderColor: 'primary.light'
            }} 
          >
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={700}>Create Post</Typography>
            <Typography variant="body2" color="text.secondary">
              Share your thoughts on the decentralized web
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="What's happening?"
            placeholder="Share your thoughts..."
            multiline
            minRows={4}
            maxRows={12}
            fullWidth
            variant="outlined"
            value={content}
            onChange={e => setContent(e.target.value)}
            sx={{ mb: 3 }}
            disabled={submitting || loading}
            helperText={`${content.length}/500 characters`}
            inputProps={{ maxLength: 500 }}
          />
          
          {image && (
            <Box mb={3} position="relative">
              <Box
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '2px solid',
                  borderColor: 'grey.200',
                  position: 'relative'
                }}
              >
                <img 
                  src={image} 
                  alt="Preview" 
                  style={{ 
                    width: '100%', 
                    maxHeight: 400, 
                    objectFit: 'cover',
                    display: 'block'
                  }} 
                />
                <IconButton 
                  size="small" 
                  sx={{ 
                    position: 'absolute', 
                    top: 12, 
                    right: 12, 
                    bgcolor: 'rgba(0,0,0,0.7)', 
                    color: 'white',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' }
                  }}
                  onClick={() => {
                    setImage(null);
                    setImageFile(null);
                  }}
                  disabled={submitting || loading}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
          
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            mb={3}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default'
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleImageChange}
                disabled={submitting || loading}
              />
              <IconButton 
                color="primary" 
                onClick={() => fileInputRef.current.click()} 
                disabled={submitting || loading}
                sx={{ bgcolor: 'primary.50' }}
              >
                <AddPhotoAlternateIcon />
              </IconButton>
              <Typography variant="body2" color="text.secondary">
                Add image
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center">
              <FormControlLabel
                control={
                  <Switch 
                    checked={mintNFT} 
                    onChange={e => setMintNFT(e.target.checked)} 
                    color="primary" 
                    disabled={submitting || loading} 
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Typography variant="body2" fontWeight={500}>Mint as NFT</Typography>
                    <Tooltip 
                      title="Minting as NFT requires ETH tokens and creates permanent, verifiable content on the blockchain. Your post becomes a unique digital asset."
                      arrow
                      placement="top"
                    >
                      <InfoIcon fontSize="small" color="action" sx={{ opacity: 0.6 }} />
                    </Tooltip>
                  </Box>
                }
              />
            </Box>
          </Box>
          
          {/* Progress indicator during submission */}
          {(submitting || loading) && uploadProgress > 0 && (
            <Box mb={3}>
              <Typography variant="caption" color="text.secondary" mb={1} display="block" fontWeight={500}>
                {uploadProgress < 30 ? "Preparing upload..." :
                uploadProgress < 50 ? "Uploading to IPFS..." : 
                uploadProgress < 70 ? mintNFT ? "Minting NFT..." : "Saving post..." : 
                uploadProgress < 90 ? "Almost done..." :
                "Post created! 🎉"}
              </Typography>
              <Box sx={{ 
                width: '100%', 
                bgcolor: 'grey.100', 
                borderRadius: 1, 
                overflow: 'hidden',
                height: 8
              }}>
                <Box
                  sx={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    bgcolor: uploadProgress === 100 ? 'success.main' : 'primary.main',
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                    boxShadow: uploadProgress === 100 ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none'
                  }}
                />
              </Box>
            </Box>
          )}
          
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            sx={{ 
              borderRadius: 3, 
              fontWeight: 700, 
              textTransform: 'none', 
              py: 1.2,
              position: 'relative'
            }}
            disabled={!content.trim() || submitting || loading}
            type="submit"
          >
            {(submitting || loading) ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={20} color="inherit" />
                <span>Posting...</span>
              </Box>
            ) : "Post"}
          </Button>
        </form>
      </Paper>
      
      {/* Success notification */}
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="success" 
          sx={{ 
            width: '100%',
            borderRadius: 2,
            boxShadow: 3
          }}
        >
          {mintNFT ? '🎉 NFT post created successfully! Redirecting...' : '✅ Post created successfully! Redirecting...'}
        </Alert>
      </Snackbar>
      
      {/* Error notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="error" 
          sx={{ 
            width: '100%',
            borderRadius: 2,
            boxShadow: 3
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* Image Crop Modal */}
      <ImageCropModal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        imageSrc={originalImageSrc}
        onCropComplete={handleCropComplete}
        aspectRatioPreset="free"
        title="Crop Post Image"
      />

      {/* Suspension/Ban Dialog */}
      <Dialog
        open={suspensionDialogOpen}
        onClose={() => setSuspensionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.3rem', pb: 1 }}>
          {suspensionDetails?.level === 'permanent_ban' ? '🚫 Account Permanently Banned' : suspensionDetails?.level === 'temp_ban' ? '⏸️ Account Temporarily Suspended' : '🚫 Access Denied'}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
            {suspensionMessage}
          </Typography>

          {suspensionDetails?.hoursRemaining && (
            <Box sx={{
              bgcolor: 'warning.lighter',
              p: 2,
              borderRadius: 1,
              border: '2px solid',
              borderColor: 'warning.main',
              mb: 2
            }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>⏱️ Suspension Duration:</strong>
              </Typography>
              <Typography variant="body2">
                Your account will be available again in approximately <strong>{suspensionDetails.hoursRemaining} hours</strong>
              </Typography>
            </Box>
          )}

          {suspensionDetails?.level === 'permanent_ban' && (
            <>
          <Box sx={{
            bgcolor: 'error.lighter',
            p: 2.5,
            borderRadius: 1,
            border: '2px solid',
            borderColor: 'error.main',
            mb: 2
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'error.main' }}>
              ✉️ How to Appeal:
            </Typography>
            <Box component="ol" sx={{ pl: 2, mb: 0 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Email:</strong> crib@gmail.com
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Subject:</strong> Account Ban Appeal
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Include in your email:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                <Typography variant="body2">Your wallet address</Typography>
                <Typography variant="body2">Your username</Typography>
                <Typography variant="body2">Why you believe this ban was made in error</Typography>
                <Typography variant="body2">Any supporting evidence or context</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{
            bgcolor: 'info.lighter',
            p: 2,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'info.main'
          }}>
            <Typography variant="body2">
              ℹ️ <strong>Appeal Deadline:</strong> 30 days from ban date
            </Typography>
          </Box>
            </>
          )}

          {suspensionDetails?.level === 'temp_ban' && (
            <Box sx={{
              bgcolor: 'info.lighter',
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.main'
            }}>
              <Typography variant="body2">
                <strong>ℹ️ Your suspension is temporary.</strong> You'll be able to post and comment again once the suspension period ends.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSuspensionDialogOpen(false)} variant="contained">
            Okay, I Understand
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreatePost;
