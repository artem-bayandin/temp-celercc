// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.9;

/*
    Custom version of NFT bridge, source: https://github.com/celer-network/sgn-v2-contracts/blob/main/contracts/message/apps/nft-bridge/NFTBridge.sol

    Interfaces updated to our needs.
    Simplified version to have just minimum needed.

    Current state:
    - sendMsg() called from our NFT contract (ERC721CelerCrossChain.sol) works as intended;
    - message is sent; when a message is executed, an NFT tokenId is minted.

    Might be treated as "completed" for now, until any failures are faced.
*/

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { MessageSenderApp } from "sgn-v2-contracts/contracts/message/framework/MessageSenderApp.sol";
import { MessageReceiverApp } from "sgn-v2-contracts/contracts/message/framework/MessageReceiverApp.sol";
import { IMessageBus } from "sgn-v2-contracts/contracts/message/interfaces/IMessageBus.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { INFTBridge, INFT } from "./Interfaces.sol";

contract NFTBridge is INFTBridge, MessageReceiverApp, Pausable, Initializable {
    /// per dest chain id executor fee in this chain's gas token
    mapping(uint64 => uint256) internal destTxFee_;
    /// per dest chain id NFTBridge address
    mapping(uint64 => address) internal destBridge_;
    /// first key is NFT address on this chain, 2nd key is dest chain id, value is address on dest chain
    mapping(address => mapping(uint64 => address)) internal destNFTAddr_;

    /// @notice Struct to send cross chain messages
    struct NFTMsg {
        address user; // receiver of minted or withdrawn NFT
        address nft; // NFT contract on mint/withdraw chain
        uint256 tokenId; // token ID
    }

    event Sent(address sender, address srcNft, uint256 tokenId, uint64 destChid, address receiver, address destNft);
    event Received(address receiver, address nft, uint256 tokenId, uint64 srcChid);

    // admin events
    event SetDestNFT(address srcNft, uint64 destChid, address destNft);
    event SetTxFee(uint64 chid, uint256 fee);
    event SetDestBridge(uint64 destChid, address destNftBridge);

    constructor(address _msgBus) {
        messageBus = _msgBus;
    }

    // to use as a proxy
    function init(address _owner, address _msgBus) initializer external {
        transferOwnership(_owner);
        messageBus = _msgBus;
    }

    function totalFee(uint64 _destChid, address _nft, uint256 _tokenId) external view returns (uint256 _fee) {
        bytes memory message = abi.encode(NFTMsg(_nft, _nft, _tokenId));
        return IMessageBus(messageBus).calcFee(message) + destTxFee_[_destChid];
    }

    // ===== called by User
    /**
     * @notice burn user's NFT in this contract and send message to mint on dest chain
     * @param _nft address of source NFT contract
     * @param _tokenId nft token ID to bridge
     * @param _destChid dest chain ID
     * @param _receiver receiver address on dest chain
     */
    function sendTo(address _nft, uint256 _tokenId, uint64 _destChid, address _receiver) external payable whenNotPaused {
        address msgSender = msg.sender;
        require(msgSender == INFT(_nft).ownerOf(_tokenId), "Not token owner.");

        // burn
        INFT(_nft).burn(_tokenId);

        // validate dest addresses
        (address _destBridge, address _destNft) = _checkAddr(_nft, _destChid);

        // send message
        _sendViaMsgBus(_destBridge, _destChid, abi.encode(NFTMsg(_receiver, _destNft, _tokenId)));

        // emit event on success
        emit Sent(msgSender, _nft, _tokenId, _destChid, _receiver, _destNft);
    }

    // ===== called by NFT
    /**
     * @notice burn user's NFT in this contract and send message to mint on dest chain
     * @param _sender token owner address
     * @param _tokenId nft token ID to bridge
     * @param _destChid dest chain ID
     * @param _receiver receiver address on dest chain
     */
    function sendMsg(address _sender, uint256 _tokenId, uint64 _destChid, address _receiver) external payable whenNotPaused {
        address _nft = msg.sender;

        try INFT(_nft).ownerOf(_tokenId) returns (address _owner) {
            // if the value returned is not 0x00, then burn the token
            if (_owner != address(0)) {
                 INFT(_nft).burn(_tokenId);
            }
        } catch {
            // failed - means no owner
        }

        // validate dest addresses
        (address _destBridge, address _destNft) = _checkAddr(_nft, _destChid);

        // send message
        _sendViaMsgBus(_destBridge, _destChid, abi.encode(NFTMsg(_receiver, _destNft, _tokenId)));

        // emit event on success
        emit Sent(_sender, _nft, _tokenId, _destChid, _receiver, _destNft);
    }

    // ===== called by MessageBus
    /**
     * @notice executes token transfer by minting token
     * @param _sender dest chain bridge address
     * @param _srcChid src chain ID
     * @param _message encoded NFTMsg
     */
    function executeMessage(address _sender, uint64 _srcChid, bytes calldata _message, address /*_executor*/) external payable override onlyMessageBus returns (ExecutionStatus _status) {
        // Must check sender to ensure msg is from another nft bridge
        // but we allow retry later in case it's a temporary config error
        // risk is invalid sender will be retried but this can be easily filtered
        // in executor or require manual trigger for retry
        if (paused() || _sender != destBridge_[_srcChid]) {
            return ExecutionStatus.Retry;
        }
        return xferOrMint(_message, _srcChid);
    }

    // READ

    /// @notice Returns current fee set for dest chain
    function destTxFee(uint64 _destChid) external view returns (uint256 _fee) {
        return destTxFee_[_destChid];
    }

    /// @notice Returns dest chain bridge
    function destBridge(uint64 _destChid) external view returns (address _destBridge) {
        return destBridge_[_destChid];
    }

    /// @notice Returns dest NFT address of scr NFT on dest chain
    function destNFTAddr(address _srcNft, uint64 _destChid) external view returns (address _destNft) {
        return destNFTAddr_[_srcNft][_destChid];
    }

    // INTERNAL

    // check _nft and _destChid are valid, return _destBridge and _destNft
    function _checkAddr(address _nft, uint64 _destChid) internal view returns (address _destBridge, address _destNft) {
        _destBridge = destBridge_[_destChid];
        require(_destBridge != address(0), "Dest NFT Bridge not found.");
        _destNft = destNFTAddr_[_nft][_destChid];
        require(_destNft != address(0), "Dest NFT not found.");
    }

    // check fee and call msgbus sendMessage
    function _sendViaMsgBus(address _destBridge, uint64 _destChid, bytes memory _message) internal {
        uint256 fee = IMessageBus(messageBus).calcFee(_message);
        require(msg.value >= fee + destTxFee_[_destChid], "Insufficient fee.");
        IMessageBus(messageBus).sendMessage{value: fee}(_destBridge, _destChid, _message);
    }

    // xferOrMint on receiver side, mints NFT to receiver
    function xferOrMint(bytes calldata _message, uint64 _srcChid) internal returns (ExecutionStatus _status) {
        NFTMsg memory nftMsg = abi.decode((_message), (NFTMsg));
        // mint the token
        try INFT(nftMsg.nft).bridgeMint(nftMsg.user, nftMsg.tokenId) {
            // do nothing here to move on to emit Received event and return success
        } catch (bytes memory /*returnData*/) {
            // emit ExtCallErr(returnData);
            return ExecutionStatus.Retry;
        }
        emit Received(nftMsg.user, nftMsg.nft, nftMsg.tokenId, _srcChid);
        return ExecutionStatus.Success;
    }

    // CONFIG

    // set per NFT, per chain id, address
    function setDestNFT(address _srcNft, uint64 _destChid, address _destNft) external onlyOwner {
        _setDestNFT(_srcNft, _destChid, _destNft);
    }

    // set all dest chains
    function setDestNFTs(address _srcNft, uint64[] calldata _destChid, address[] calldata _destNft) external onlyOwner {
        uint256 len = _destChid.length;
        require(len == _destNft.length, "Length mismatch.");
        for (uint256 i = 0; i < len; i++) {
            _setDestNFT(_srcNft, _destChid[i], _destNft[i]);
        }
    }

    function _setDestNFT(address _srcNft, uint64 _destChid, address _destNft) internal {
        destNFTAddr_[_srcNft][_destChid] = _destNft;
        emit SetDestNFT(_srcNft, _destChid, _destNft);
    }

    // set destTxFee
    function setTxFee(uint64 _chid, uint256 _fee) external onlyOwner {
        destTxFee_[_chid] = _fee;
        emit SetTxFee(_chid, _fee);
    }

    // set per chain id, nft bridge address
    function setDestBridge(uint64 _destChid, address _destNftBridge) external onlyOwner {
        _setDestBridge(_destChid, _destNftBridge);
    }

    // batch set nft bridge addresses for multiple chainids
    function setDestBridges(uint64[] calldata _destChid, address[] calldata _destNftBridge) external onlyOwner {
        uint256 len = _destChid.length;
        require(len == _destNftBridge.length, "Length mismatch.");
        for (uint256 i = 0; i < len; i++) {
            _setDestBridge(_destChid[i], _destNftBridge[i]);
        }
    }

    function _setDestBridge(uint64 _destChid, address _destNftBridge) internal {
        destBridge_[_destChid] = _destNftBridge;
        emit SetDestBridge(_destChid, _destNftBridge);
    }

    // send all gas token this contract has to owner
    function claimFee() external onlyOwner {
        uint256 amount = address(this).balance;
        payable(msg.sender).transfer(amount);
    }
}