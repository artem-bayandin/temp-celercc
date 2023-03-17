// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

/*
    This contract is intended to be used as almost standard ERC721, adding cross chain functionality.
    Chains to be linked most likely should be managed by our app or contract.
    CC transfer to be used - "burn and mint", with neither "source" nor "pegged" contract, and each chain will have its own range of ids. (later)
    
    Current state:
    - crossChain() works via our custom bridge (NFTBridge.sol).

    Might be treated as "completed" for now, until any failures are faced.
*/

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { INFTBridge, INFT } from "./Interfaces.sol";

contract ERC721CelerCrossChain is ERC721, Initializable, Ownable, Pausable, ReentrancyGuard {
    event NFTBridgeUpdated(address);

    // ERC721.name()
    string internal name_;
    // ERC721.symbol()
    string internal symbol_;

    address internal bridge_;

    /* INITIALIZATION */

    // this contract is intended to be used under proxy, that's why it has such constructor as a temporary copy from `init` function
    constructor (string memory _name, string memory _symbol, address _bridge) ERC721(_name, _symbol) {
        _transferOwnership(msg.sender);
        name_ = _name;
        symbol_ = _symbol;
        bridge_ = _bridge;
        // _pause();
        _disableInitializers();
    }

    // function init(address _owner, string memory _name, string memory _symbol, address _bridge) initializer external {
    //     _transferOwnership(_owner);
    //     name_ = _name;
    //     symbol_ = _symbol;
    //     bridge_ = _bridge;
    // }

    function name() public view virtual override returns (string memory _name) {
        return name_;
    }

    function symbol() public view virtual override returns (string memory _symbol) {
        return symbol_;
    }

    /* CROSS CHAIN */

    modifier onlyNftBridge() {
        require(msg.sender == bridge_, "caller is not bridge");
        _;
    }

    function nftBridge() public view returns (address _bridge) {
        return bridge_;
    }

    function bridgeMint(address _to, uint256 _id) external onlyNftBridge {
        _mint(_to, _id);
    }

    // calls nft bridge to get total fee for crossChain msg.Value
    function totalFee(uint64 _dstChid, uint256 _id) external view returns (uint256) {
        return INFTBridge(bridge_).totalFee(_dstChid, address(this), _id);
    }

    // called by user, burn token on this chain and mint same id/uri on dest chain
    function crossChain(uint64 _dstChid, uint256 _id, address _receiver) external payable whenNotPaused {
        require(msg.sender == ownerOf(_id), "not token owner");
        // string memory _uri = tokenURI(_id);
        _burn(_id);
        INFTBridge(bridge_).sendMsg{value: msg.value}(msg.sender, _id, _dstChid, _receiver);
    }

    // ===== only Owner
    function mint(address _to, uint256 _id) external onlyOwner {
        _mint(_to, _id);
    }

    function setNFTBridge(address _newBridge) public onlyOwner {
        bridge_ = _newBridge;
        emit NFTBridgeUpdated(_newBridge);
    }

    function withdrawErc20(address _tokenAddress, address _to) public onlyOwner {
        if (_to == address(0)) {
            _to = msg.sender;
        }
        uint256 currentBalance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(_to, currentBalance);
    }

    function withdraw(address payable _to) public payable onlyOwner {
        (bool sent,) = _to.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }

    receive() external payable {}
    fallback() external payable {}
}