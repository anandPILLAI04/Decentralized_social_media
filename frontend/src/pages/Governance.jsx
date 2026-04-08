import React from "react";
import CommunityDashboard from "../components/CommunityDashboard";

const Governance = ({ walletAddress }) => {
  return (
    <CommunityDashboard walletAddress={walletAddress} />
  );
};

export default Governance;