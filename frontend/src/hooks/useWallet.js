
import { useState } from "react";
import { ethers } from "ethers";

export default function useWallet() {
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setError(null);
    setConnecting(true);
    try {
      if (!window.ethereum) {
        setError("MetaMask is not installed. Please install it to continue.");
        setConnecting(false);
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
    } catch (err) {
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  };

  return { address, connect, error, connecting };
}
