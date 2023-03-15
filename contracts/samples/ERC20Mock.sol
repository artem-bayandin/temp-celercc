// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

/*
    This is a contract to imitate ERC20 tokens.
*/

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract ERC20Mock is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        super._mint(_to, _amount);
    }

    function burn(address _account, uint256 _amount) public {
        super._burn(_account, _amount);
    }
}
