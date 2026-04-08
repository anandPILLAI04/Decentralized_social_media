
import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { getWalletAddress, getRegistrationStatus, getUserProfile, clearAppStorage, setItem } from '../utils/safeStorage';

export default function useWallet() {
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const connectingRef = useRef(false); // Synchronous guard to prevent race conditions

  // Check for existing wallet connection on mount
  useEffect(() => {
    checkExistingConnection();
    setupEventListeners();
    
    return () => {
      // Cleanup event listeners
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Check if user was previously connected
  const checkExistingConnection = async () => {
    try {
      const savedAddress = getWalletAddress();
      const isRegistered = getRegistrationStatus();
      const userProfile = getUserProfile();
      
      if (!savedAddress || !isRegistered || !userProfile) {
        console.log('🔓 No previous session found');
        return;
      }

      if (!window.ethereum) {
        console.log('⚠️ MetaMask not installed');
        clearSession();
        return;
      }

      // Check if MetaMask still has this account
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []); // No prompt, just check
      
      if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
        console.log('✅ Restored previous wallet connection:', accounts[0]);
        console.log('✅ User session maintained - staying logged in');
        setAddress(accounts[0]);
      } else {
        console.log('⚠️ Previous wallet not found in MetaMask, clearing session');
        clearSession();
      }
    } catch (err) {
      console.error('Error checking existing connection:', err);
      // Don't clear session on error - might just be temporary network issue
      console.log('⚠️ Error checking connection, but keeping session for now');
    }
  };

  // Setup MetaMask event listeners
  const setupEventListeners = () => {
    if (!window.ethereum) return;

    // Handle account changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    
    // Handle chain changes
    window.ethereum.on('chainChanged', handleChainChanged);
  };

  // Handle account changes (user switches account in MetaMask)
  const handleAccountsChanged = (accounts) => {
    console.log('🔄 Account changed:', accounts);
    if (accounts.length === 0) {
      // User disconnected wallet in MetaMask
      console.log('🔓 User disconnected wallet in MetaMask');
      disconnect();
      window.location.href = '/';
    } else if (address && accounts[0].toLowerCase() !== address.toLowerCase()) {
      // User switched to different account - force re-login
      console.log('🔄 Account switched, forcing re-login');
      disconnect();
      window.location.href = '/auth';
    }
  };

  // Handle chain changes (user switches network)
  const handleChainChanged = () => {
    console.log('🔄 Network changed, reloading page');
    window.location.reload();
  };

  // Connect wallet (prompts MetaMask)
  const connect = async () => {
    // Prevent duplicate connection requests using ref (synchronous check)
    if (connectingRef.current) {
      console.log('⏳ Connection already in progress, ignoring duplicate request');
      return;
    }
    
    // Set both ref (synchronous) and state (for UI)
    connectingRef.current = true;
    setError(null);
    setConnecting(true);
    
    try {
      if (!window.ethereum) {
        const errorMsg = "MetaMask is not installed. Please install it to continue.";
        setError(errorMsg);
        connectingRef.current = false;
        setConnecting(false);
        throw new Error(errorMsg);
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const walletAddress = accounts[0];
      
      console.log('✅ Wallet connected:', walletAddress);
      setAddress(walletAddress);
      
      // Save to localStorage for persistence (but user still needs to login)
      setItem('walletAddress', walletAddress);
      
      connectingRef.current = false;
      setConnecting(false);
      return walletAddress;
    } catch (err) {
      const errorMsg = err.message || "Failed to connect wallet.";
      console.error('❌ Wallet connection error:', errorMsg);
      setError(errorMsg);
      connectingRef.current = false;
      setConnecting(false);
      throw err;
    }
  };

  // Disconnect wallet and clear session
  const disconnect = () => {
    console.log('🔓 Disconnecting wallet');
    setAddress(null);
    clearSession();
  };

  // Sign a message with the wallet
  const signMessage = async (message, connectedAddress = null) => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      // Use provided address (from connect()) or fall back to state
      const addressToUse = connectedAddress || address;
      if (!addressToUse) {
        throw new Error("Wallet not connected");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      console.log('✅ Message signed successfully');
      return signature;
    } catch (err) {
      console.error('❌ Error signing message:', err);
      throw err;
    }
  };

  // Clear all session data
  const clearSession = () => {
    clearAppStorage();
    console.log('🧹 Session cleared');
  };

  return {
    address,
    connect,
    disconnect,
    signMessage,
    error,
    connecting
  };
}
