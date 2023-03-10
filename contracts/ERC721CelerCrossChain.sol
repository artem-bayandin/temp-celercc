// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

/*
    This contract is intended to be used as almost standard ERC721, adding cross chain functionality.
    Chains to be linked most likely should be managed by our app or contract.
    CC transfer to be used - "burn and mint", with neither "source" nor "pegged" contract, and each chain will have its own range of ids. (later)
    
    Current task - to somehow transfer minted tokens to another chain to finally understand how it works.
    Current state - calling .totalFee(...) as well as .crossChain(...) fails with
    `Error: missing revert data in call exception; Transaction reverted without a reason string`.
*/

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INFTBridge {
    function sendMsg(
        uint64 _dstChid,
        address _sender,
        address _receiver,
        uint256 _id,
        string calldata _uri
    ) external payable;

    function sendMsg(
        uint64 _dstChid,
        address _sender,
        bytes calldata _receiver,
        uint256 _id,
        string calldata _uri
    ) external payable;

    function totalFee(
        uint64 _dstChid,
        address _nft,
        uint256 _id
    ) external view returns (uint256);
}

contract ERC721CelerCrossChain is ERC721, Initializable, Ownable, Pausable, ReentrancyGuard {
    event NFTBridgeUpdated(address);

    // ERC721.name()
    string internal name_;
    // ERC721.symbol()
    string internal symbol_;

    address internal bridge_;

    /* INITIALISATION */

    constructor () ERC721("", "") {
        _pause();
        _disableInitializers();
    }

    function init(
        address _owner
		, string memory _name
        , string memory _symbol
        , address _bridge
	) initializer external {
        _transferOwnership(_owner);
        name_ = _name;
        symbol_ = _symbol;
        bridge_ = _bridge;
	}

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

    function bridgeMint(
        address to,
        uint256 id,
        string memory/* uri*/
    ) external onlyNftBridge {
        _mint(to, id);
        // _setTokenURI(id, uri);
    }

    // calls nft bridge to get total fee for crossChain msg.Value
    function totalFee(uint64 _dstChid, uint256 _id) external view returns (uint256) {
        return INFTBridge(bridge_).totalFee(_dstChid, address(this), _id);
    }

    // called by user, burn token on this chain and mint same id/uri on dest chain
    function crossChain(
        uint64 _dstChid,
        uint256 _id,
        address _receiver
    ) external payable whenNotPaused {
        require(msg.sender == ownerOf(_id), "not token owner");
        // string memory _uri = tokenURI(_id);
        _burn(_id);
        INFTBridge(bridge_).sendMsg{value: msg.value}(_dstChid, msg.sender, _receiver, _id, "" /*_uri*/);
    }

    // support chains using bytes for address
    function crossChain(
        uint64 _dstChid,
        uint256 _id,
        bytes calldata _receiver
    ) external payable whenNotPaused {
        require(msg.sender == ownerOf(_id), "not token owner");
        // string memory _uri = tokenURI(_id);
        _burn(_id);
        INFTBridge(bridge_).sendMsg{value: msg.value}(_dstChid, msg.sender, _receiver, _id, "" /*_uri*/);
    }

    // ===== only Owner
    function mint(
        address to,
        uint256 id,
        string memory/* uri*/
    ) external onlyOwner {
        _mint(to, id);
        // _setTokenURI(id, uri);
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