// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

/*
    This is a sample contract built according to https://im-docs.celer.network/developer/development-guide/contract-examples/hello-world .
    This should only transfer a message from one chain to another one.

    Current state:
    -  sendMessage() works cross chain via message bus provided by Celer.

    Might be treated as "completed" for now, until any failures are faced.
*/

import { MessageSenderApp } from "sgn-v2-contracts/contracts/message/framework/MessageSenderApp.sol";
import { MessageReceiverApp } from "sgn-v2-contracts/contracts/message/framework/MessageReceiverApp.sol";
import { IMessageBus } from "sgn-v2-contracts/contracts/message/interfaces/IMessageBus.sol";

abstract contract MessageApp is MessageSenderApp, MessageReceiverApp {
    constructor(address _messageBus) {
        messageBus = _messageBus;
    }
}

contract MsgExampleBasic is MessageApp {
    event MessageReceived(
        address srcContract,
        uint64 srcChainId,
        address sender,
        bytes message
    );

    event Fallen(bytes input);

    constructor(address _messageBus) MessageApp(_messageBus) {}

    function calcFee(string memory _message) external view returns (uint256) {
        bytes memory fullMessage = abi.encode(msg.sender, _message);
        return IMessageBus(messageBus).calcFee(fullMessage);
    }

    // called by user on source chain to send cross-chain messages
    function sendMessage(
        address _dstContract,
        uint64 _dstChainId,
        string memory _message
    ) external payable {
        bytes memory message = abi.encode(msg.sender, _message);
        super.sendMessage(_dstContract, _dstChainId, message, msg.value);
    }

    // called by MessageBus on destination chain to receive cross-chain messages
    function executeMessage(
        address _srcContract,
        uint64 _srcChainId,
        bytes calldata _message,
        address // executor
    ) external payable override onlyMessageBus returns (ExecutionStatus) {
        (address sender, bytes memory message) = abi.decode((_message), (address, bytes));
        emit MessageReceived(_srcContract, _srcChainId, sender, message);
        return ExecutionStatus.Success;
    }

    fallback(bytes calldata _input) external payable returns (bytes memory _output) {
        emit Fallen(_input);
        return _input;
    }

    receive() external payable {}
}