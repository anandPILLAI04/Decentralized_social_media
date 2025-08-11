// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Governance is Ownable {
    uint256 private _nextProposalId = 1;
    
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
        mapping(address => bool) hasVoted;
        mapping(address => uint8) votes; // 1 = for, 2 = against
    }
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public votingPower;
    
    uint256 public proposalThreshold = 1000 * 10**18; // 1000 tokens
    uint256 public votingPeriod = 3 days;
    uint256 public quorum = 10000 * 10**18; // 10000 tokens
    
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event Voted(uint256 indexed proposalId, address indexed voter, uint8 support);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    
    constructor() Ownable(msg.sender) {}
    
    modifier onlyProposer(uint256 proposalId) {
        require(proposals[proposalId].proposer == msg.sender, "Governance: caller is not the proposer");
        _;
    }
    
    modifier onlyActiveProposal(uint256 proposalId) {
        require(proposals[proposalId].id != 0, "Governance: proposal does not exist");
        require(!proposals[proposalId].executed, "Governance: proposal already executed");
        require(!proposals[proposalId].canceled, "Governance: proposal already canceled");
        require(block.timestamp < proposals[proposalId].endTime, "Governance: proposal already ended");
        _;
    }
    
    function createProposal(string memory title, string memory description) external returns (uint256) {
        require(votingPower[msg.sender] >= proposalThreshold, "Governance: proposer votes below proposal threshold");
        
        uint256 newProposalId = _nextProposalId;
        _nextProposalId++;
        
        Proposal storage newProposal = proposals[newProposalId];
        newProposal.id = newProposalId;
        newProposal.proposer = msg.sender;
        newProposal.title = title;
        newProposal.description = description;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + votingPeriod;
        
        emit ProposalCreated(newProposalId, msg.sender, title);
        return newProposalId;
    }
    
    function vote(uint256 proposalId, uint8 support) external onlyActiveProposal(proposalId) {
        require(support == 1 || support == 2, "Governance: invalid value for enum Vote");
        require(!proposals[proposalId].hasVoted[msg.sender], "Governance: already voted");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = support;
        
        if (support == 1) {
            proposal.forVotes += votingPower[msg.sender];
        } else {
            proposal.againstVotes += votingPower[msg.sender];
        }
        
        emit Voted(proposalId, msg.sender, support);
    }
    
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Governance: proposal does not exist");
        require(!proposal.executed, "Governance: proposal already executed");
        require(block.timestamp >= proposal.endTime, "Governance: proposal not yet ended");
        require(proposal.forVotes + proposal.againstVotes >= quorum, "Governance: quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Governance: proposal not passed");
        
        proposal.executed = true;
        
        emit ProposalExecuted(proposalId);
    }
    
    function cancelProposal(uint256 proposalId) external onlyProposer(proposalId) onlyActiveProposal(proposalId) {
        proposals[proposalId].canceled = true;
        emit ProposalCanceled(proposalId);
    }
    
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        string memory title,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.canceled
        );
    }
    
    function getProposalCount() external view returns (uint256) {
        return _nextProposalId - 1;
    }
    
    function setVotingPower(address user, uint256 power) external onlyOwner {
        votingPower[user] = power;
    }
    
    function setProposalThreshold(uint256 threshold) external onlyOwner {
        proposalThreshold = threshold;
    }
    
    function setVotingPeriod(uint256 period) external onlyOwner {
        votingPeriod = period;
    }
    
    function setQuorum(uint256 newQuorum) external onlyOwner {
        quorum = newQuorum;
    }
}
