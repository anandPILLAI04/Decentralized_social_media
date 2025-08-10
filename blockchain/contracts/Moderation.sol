// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract Moderation {
    event Feedback(address indexed user, uint256 indexed contentId, uint8 score);

    function submitFeedback(uint256 contentId, uint8 score) external {
        emit Feedback(msg.sender, contentId, score);
    }
}
