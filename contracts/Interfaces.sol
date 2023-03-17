// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

// interface for NFT contract, only funcs needed by NFTBridge
interface INFT {
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function transferFrom(address from, address to, uint256 tokenId) external;
    // impl by NFToken contract, mint an NFT with id to user or burn
    function bridgeMint(address to, uint256 tokenId) external;
    function burn(uint256 tokenId) external;
}

// interface of our custom NFT Bridge
interface INFTBridge {
    function sendMsg(
        address _sender,
        uint256 _tokenId,
        uint64 _destChid,
        address _receiver
    ) external payable;

    function totalFee(
        uint64 _destChid,
        address _nft,
        uint256 _tokenId
    ) external view returns (uint256);
}