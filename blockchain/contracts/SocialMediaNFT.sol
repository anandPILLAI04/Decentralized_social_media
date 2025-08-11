// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract SocialMediaNFT is ERC721, Ownable {
    uint256 private _nextTokenId = 1;
    
    struct Post {
        uint256 id;
        address author;
        string content;
        string mediaURI;
        uint256 likes;
        uint256 comments;
        uint256 timestamp;
        bool isNFT;
        string metadata;
    }
    
    mapping(uint256 => Post) public posts;
    mapping(uint256 => mapping(address => bool)) public likedBy;
    mapping(uint256 => address[]) public postLikers;
    
    event PostCreated(uint256 indexed postId, address indexed author, string content, bool isNFT);
    event PostLiked(uint256 indexed postId, address indexed liker);
    event PostUnliked(uint256 indexed postId, address indexed unliker);
    
    constructor() ERC721("SocialMediaPost", "SMP") Ownable(msg.sender) {}
    
    function createPost(string memory content, string memory mediaURI, bool mintAsNFT, string memory metadata) external returns (uint256) {
        uint256 newPostId = _nextTokenId;
        _nextTokenId++;
        
        posts[newPostId] = Post({
            id: newPostId,
            author: msg.sender,
            content: content,
            mediaURI: mediaURI,
            likes: 0,
            comments: 0,
            timestamp: block.timestamp,
            isNFT: mintAsNFT,
            metadata: metadata
        });
        
        if (mintAsNFT) {
            _safeMint(msg.sender, newPostId);
        }
        
        emit PostCreated(newPostId, msg.sender, content, mintAsNFT);
        return newPostId;
    }
    
    function likePost(uint256 postId) external {
        require(posts[postId].id != 0, "Post does not exist");
        require(!likedBy[postId][msg.sender], "Already liked");
        
        posts[postId].likes++;
        likedBy[postId][msg.sender] = true;
        postLikers[postId].push(msg.sender);
        
        emit PostLiked(postId, msg.sender);
    }
    
    function unlikePost(uint256 postId) external {
        require(posts[postId].id != 0, "Post does not exist");
        require(likedBy[postId][msg.sender], "Not liked");
        
        posts[postId].likes--;
        likedBy[postId][msg.sender] = false;
        
        // Remove from likers array
        address[] storage likers = postLikers[postId];
        for (uint i = 0; i < likers.length; i++) {
            if (likers[i] == msg.sender) {
                likers[i] = likers[likers.length - 1];
                likers.pop();
                break;
            }
        }
        
        emit PostUnliked(postId, msg.sender);
    }
    
    function getPost(uint256 postId) external view returns (Post memory) {
        return posts[postId];
    }
    
    function getPostCount() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    function getPostsByAuthor(address author, uint256 limit, uint256 offset) external view returns (Post[] memory) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](limit);
        
        for (uint256 i = 1; i < _nextTokenId; i++) {
            if (posts[i].author == author) {
                if (count >= offset && count < offset + limit) {
                    tempIds[count - offset] = i;
                }
                count++;
            }
        }
        
        Post[] memory result = new Post[](Math.min(limit, count - offset));
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = posts[tempIds[i]];
        }
        
        return result;
    }
    
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal {
        require(ownerOf(tokenId) != address(0), "URI set of nonexistent token");
        posts[tokenId].metadata = _tokenURI;
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        return posts[tokenId].metadata;
    }
}
