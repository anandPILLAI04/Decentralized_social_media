require("@nomicfoundation/hardhat-toolbox");

require('dotenv').config();

module.exports = {
  solidity: "0.8.21",
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
