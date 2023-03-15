// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.9;

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { MessageSenderApp } from "sgn-v2-contracts/contracts/message/framework/MessageSenderApp.sol";
import { MessageReceiverApp } from "sgn-v2-contracts/contracts/message/framework/MessageReceiverApp.sol";
import { IMessageBus } from "sgn-v2-contracts/contracts/message/interfaces/IMessageBus.sol";

// interface for NFT contract, ERC721 and metadata, only funcs needed by NFTBridge
interface INFT {
    // function tokenURI(uint256 tokenId) external view returns (string memory);

    function ownerOf(uint256 tokenId) external view returns (address owner);

    // we do not support NFT that charges transfer fees
    function transferFrom(address from, address to, uint256 tokenId) external;

    // impl by NFToken contract, mint an NFT with id and uri to user or burn
    function bridgeMint(address to, uint256 id) external;

    function burn(uint256 id) external;
}

contract NFTBridge is MessageReceiverApp, Pausable {
    /// per dest chain id executor fee in this chain's gas token
    mapping(uint64 => uint256) public destTxFee;
    /// per dest chain id NFTBridge address
    mapping(uint64 => address) public destBridge;
    /// first key is NFT address on this chain, 2nd key is dest chain id, value is address on dest chain
    mapping(address => mapping(uint64 => address)) public destNFTAddr;

    struct NFTMsg {
        address user; // receiver of minted or withdrawn NFT
        address nft; // NFT contract on mint/withdraw chain
        uint256 id; // token ID
        // string uri; // tokenURI from source NFT
    }

    constructor(address _msgBus) {
        messageBus = _msgBus;
    }

    function totalFee(uint64 _dstChid, address _nft, uint256 _id) external view returns (uint256) {
        bytes memory message = abi.encode(NFTMsg(_nft, _nft, _id));
        return IMessageBus(messageBus).calcFee(message) + destTxFee[_dstChid];
    }

    // ===== called by user
    /**
     * @notice locks or burn user's NFT in this contract and send message to mint (or withdraw) on dest chain
     * @param _nft address of source NFT contract
     * @param _id nft token ID to bridge
     * @param _dstChid dest chain ID
     * @param _receiver receiver address on dest chain
     */
    function sendTo(
        address _nft,
        uint256 _id,
        uint64 _dstChid,
        address _receiver
    ) external payable /*whenNotPaused*/ {
        require(msg.sender == INFT(_nft).ownerOf(_id), "not token owner");
        // must save _uri before burn
        // string memory _uri = INFT(_nft).tokenURI(_id);
        
        // lockOrBurn(_nft, _id);
        INFT(_nft).burn(_id);

        (address _dstBridge, address _dstNft) = checkAddr(_nft, _dstChid);
        msgBus(_dstBridge, _dstChid, abi.encode(NFTMsg(_receiver, _dstNft, _id)));
        // emit Sent(msg.sender, _nft, _id, _dstChid, _receiver, _dstNft);
    }

    // ===== called by MCN NFT after NFT is burnt
    /// @dev should this validate that a token has been burnt?
    function sendMsg(
        uint64 _dstChid,
        address /*_sender*/,
        address _receiver,
        uint256 _id/*,
        string calldata _uri*/
    ) external payable whenNotPaused {
        address _nft = msg.sender;
        (address _dstBridge, address _dstNft) = checkAddr(_nft, _dstChid);
        msgBus(_dstBridge, _dstChid, abi.encode(NFTMsg(_receiver, _dstNft, _id)));
        // emit Sent(_sender, _nft, _id, _dstChid, _receiver, _dstNft);
    }



    // ===== called by msgbus
    function executeMessage(
        address sender,
        uint64 srcChid,
        bytes calldata _message,
        address // executor
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        // Must check sender to ensure msg is from another nft bridge
        // but we allow retry later in case it's a temporary config error
        // risk is invalid sender will be retried but this can be easily filtered
        // in executor or require manual trigger for retry
        if (paused() || sender != destBridge[srcChid]) {
            return ExecutionStatus.Retry;
        }
        return xferOrMint(_message, srcChid);
    }



    // check _nft and destChid are valid, return dstBridge and dstNft
    function checkAddr(address _nft, uint64 _dstChid) internal view returns (address dstBridge, address dstNft) {
        dstBridge = destBridge[_dstChid];
        require(dstBridge != address(0), "dest NFT Bridge not found");
        dstNft = destNFTAddr[_nft][_dstChid];
        require(dstNft != address(0), "dest NFT not found");
    }

    // check fee and call msgbus sendMessage
    function msgBus(
        address _dstBridge,
        uint64 _dstChid,
        bytes memory message
    ) internal {
        uint256 fee = IMessageBus(messageBus).calcFee(message);
        require(msg.value >= fee + destTxFee[_dstChid], "insufficient fee");
        IMessageBus(messageBus).sendMessage{value: fee}(_dstBridge, _dstChid, message);
    }

    // xferOrMint on receiver side, transfer or mint NFT to receiver
    function xferOrMint(bytes calldata _message, uint64 /*srcChid*/) internal returns (ExecutionStatus) {
        // withdraw original locked nft back to user, or mint new nft depending on if this is the orig chain of nft
        NFTMsg memory nftMsg = abi.decode((_message), (NFTMsg));
        // if we are on nft orig chain, use transfer, otherwise, use mint
        // we must never return fail because burnt nft will be lost forever
        // if (origNFT[nftMsg.nft] == true) {
        //     try INFT(nftMsg.nft).transferFrom(address(this), nftMsg.user, nftMsg.id) {
        //         // do nothing here to move on to emit Received event and return success
        //     } catch (bytes memory returnData) {
        //         emit ExtCallErr(returnData);
        //         return ExecutionStatus.Retry;
        //     }
        // } else {
            try INFT(nftMsg.nft).bridgeMint(nftMsg.user, nftMsg.id) {
                // do nothing here to move on to emit Received event and return success
            } catch (bytes memory /*returnData*/) {
                // emit ExtCallErr(returnData);
                return ExecutionStatus.Retry;
            }
        // }
        // emit Received(nftMsg.user, nftMsg.nft, nftMsg.id, srcChid);
        return ExecutionStatus.Success;
    }



    // set per NFT, per chain id, address
    function setDestNFT(
        address srcNft,
        uint64 dstChid,
        address dstNft
    ) external onlyOwner {
        destNFTAddr[srcNft][dstChid] = dstNft;
        // emit SetDestNFT(srcNft, dstChid, dstNft);
    }

    // set all dest chains
    function setDestNFTs(
        address srcNft,
        uint64[] calldata dstChid,
        address[] calldata dstNft
    ) external onlyOwner {
        require(dstChid.length == dstNft.length, "length mismatch");
        for (uint256 i = 0; i < dstChid.length; i++) {
            destNFTAddr[srcNft][dstChid[i]] = dstNft[i];
        }
    }

    // set destTxFee
    function setTxFee(uint64 chid, uint256 fee) external onlyOwner {
        destTxFee[chid] = fee;
        // emit SetTxFee(chid, fee);
    }

    // set per chain id, nft bridge address
    function setDestBridge(uint64 dstChid, address dstNftBridge) external onlyOwner {
        destBridge[dstChid] = dstNftBridge;
        // emit SetDestBridge(dstChid, dstNftBridge);
    }

    // batch set nft bridge addresses for multiple chainids
    function setDestBridges(uint64[] calldata dstChid, address[] calldata dstNftBridge) external onlyOwner {
        for (uint256 i = 0; i < dstChid.length; i++) {
            destBridge[dstChid[i]] = dstNftBridge[i];
        }
    }
}