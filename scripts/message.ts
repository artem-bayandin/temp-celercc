import { BigNumber, ContractReceipt } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Mock, MsgExampleBasic } from '../typechain-types'

/*
    Event topic
    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee)
    0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4
*/

/*
    Goerli to BSC testnet message logs
    Message: "'hello' from goerli to bsc"

EVENTS [
  {
    transactionIndex: 9,
    blockNumber: 8648017,
    transactionHash: '0x1fd26ddb29f7e48ce2ec409baebc9e68363089685d72e7ee881dda3638f7619d',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4', - topic of event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee)
      '0x000000000000000000000000b7fd68e57a4c6664badb21e5ec4b9a79d632813d' - sender MessageApp contract address on Goerli
    ],
    data: '
    0x
    0000000000000000000000002ed9be4d407a51a344c6e1312304982df6828265 - receiver MessageApp on BSC testnet
    0000000000000000000000000000000000000000000000000000000000000061 - 97 = dest chain id = BSC testnet
    0000000000000000000000000000000000000000000000000000000000000080 - 128
    000000000000000000000000000000000000000000000000000109928c464000 - 0.000292 000000 000000 fee
    0000000000000000000000000000000000000000000000000000000000000080 - 128
    00000000000000000000000068f9890555691ec7b23174c78abd13d720beb375 - abi.encode(msg.sender, _message); = sender
    0000000000000000000000000000000000000000000000000000000000000040
    000000000000000000000000000000000000000000000000000000000000001a
    2768656c6c6f272066726f6d20676f65726c6920746f20627363000000000000
    ',
    logIndex: 25,
    blockHash: '0xd90c0fac156a9c1cbdc7ee8bd1fa7133690846e2cca81da2858246e30a88d29d',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
    Message: "second message goerli->bsc"

EVENTS [
  {
    transactionIndex: 64,
    blockNumber: 8648103,
    transactionHash: '0x3ec68e3cae34d60619c490960e4df1ad4c73ab743138aedcd49c0f54f2a17edf',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x000000000000000000000000b7fd68e57a4c6664badb21e5ec4b9a79d632813d'
    ],
    data: '0x
    0000000000000000000000002ed9be4d407a51a344c6e1312304982df6828265
    0000000000000000000000000000000000000000000000000000000000000061
    0000000000000000000000000000000000000000000000000000000000000080
    000000000000000000000000000000000000000000000000000109928c464000
    0000000000000000000000000000000000000000000000000000000000000080
    00000000000000000000000068f9890555691ec7b23174c78abd13d720beb375
    0000000000000000000000000000000000000000000000000000000000000040
    000000000000000000000000000000000000000000000000000000000000001a
    7365636f6e64206d65737361676520676f65726c692d3e627363000000000000
    ',
    logIndex: 178,
    blockHash: '0xc228ee38cfbfe44452219d9fd69a015b16aba4b70b1a2465f6489c650885fd9d',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

const helloMessage = 'hello'
const celrTokenOnGoerli = '0x5D3c0F4cA5EE99f8E8F59Ff9A5fAb04F6a7e007f'

async function main() {
    const [ signer ] = await ethers.getSigners()
    console.log(`signer`, signer.address)

    const feeData = await ethers.provider.getFeeData()
    console.log(`feedata`, feeData)

    await getApproved()

    // return;

    // await deployMessageApp()

    await sendMessage(goerliChainData, bscChainData, "second message goerli->bsc")
}

interface IData {
    name: string
    chainId: number
    contractAddress: string
    messageBus: string
}

const goerliChainData: IData = {
    name: 'Goerli'
    , chainId: 5
    , contractAddress: '0xb7fd68e57a4C6664bADb21e5ec4B9a79D632813d'
    , messageBus: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2'
}

const mumbaiChainData: IData = {
    name: 'Mumbai'
    , chainId: 80001
    , contractAddress: '0xE49a7C1EBB5c695409967C1A9DA64eCA8C800A1F'
    , messageBus: '0x7d43AABC515C356145049227CeE54B608342c0ad'
}

const bscChainData: IData = {
    name: 'BSC Testnet'
    , chainId: 97
    , contractAddress: '0x2ED9Be4D407a51a344c6E1312304982Df6828265'
    , messageBus: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA'
}

async function getChainId(): Promise<number> {
    const { chainId } = await ethers.provider.getNetwork()
    console.log(`chainId: ${chainId}`)
    return chainId
}

async function getIDataByChainId(): Promise<IData> {
    const chainId = await getChainId()
    switch (chainId) {
        case goerliChainData.chainId:
            return goerliChainData;
        case mumbaiChainData.chainId: 
            return mumbaiChainData;
        case bscChainData.chainId:
            return bscChainData;
        default:
            throw new Error(`Invalid chainId: ${chainId}`)
    }
}

async function getContract(address: string): Promise<MsgExampleBasic> {
    return await ethers.getContractAt('MsgExampleBasic', address) as MsgExampleBasic
}

async function deployMessageApp() {
    const chainData = await getIDataByChainId()
    console.log(`deploying to ${chainData.chainId} ${chainData.name}`)
    const { messageBus } = chainData
    const factory = await ethers.getContractFactory('MsgExampleBasic');
    const implementation = await factory.deploy(messageBus);
    console.log(`MsgExampleBasic deployment tx hash: ${implementation.deployTransaction.hash}`)
    await implementation.deployed()
    console.log(`MsgExampleBasic deployed at ${implementation.address}`)
    return implementation
}

async function calcFee(contractAddress: string, msg: string): Promise<BigNumber> {
    console.log(`calc fee start`)
    const [ signer ] = await ethers.getSigners()
    console.log(`signer: ${signer.address}`)
    const contract = await getContract(contractAddress)
    console.log(`contract created`)
    const fee = await contract.calcFee(`${signer.address}${msg}`)
    console.log(`fee: ${fee.toString()}`)
    return fee
}

async function sendMessage(srcChainData: IData = goerliChainData, dstChainData: IData = bscChainData, message: string = helloMessage) {
    const currentChainData = await getIDataByChainId()
    if (currentChainData.chainId !== srcChainData.chainId) {
        console.log(`invalid chain id setup`)
        return;
    }

    console.log(`sending message...`)
    const contract = await getContract(srcChainData.contractAddress)

    console.log(`contract created`)
    const fee = await calcFee(contract.address, message)
    console.log(`fee:`, fee)

    const sendMessageTx = await contract.sendMessage(
        dstChainData.contractAddress
        , dstChainData.chainId
        , message
        , { value: fee /*'10 000 000 000 000 000'*/ } // 260 000 000 000 000
    )
    console.log(`sendMessageTx hash: ${sendMessageTx.hash}`)
    const sendMessageTxReceipt = await sendMessageTx.wait() as ContractReceipt
    console.log(`completed`)

    const events = sendMessageTxReceipt.events || []
    console.log('EVENTS', events)
}

async function testConnection() {
    console.log(`test connection`)

    const chainData = await getIDataByChainId()
    console.log(`chain data fetched`)

    const contract = await getContract(chainData.contractAddress)
    console.log(`contract created`)

    try {
        const bus = await contract.messageBus()
        console.log(`bus ${bus}`)
    } catch(e: any) { console.log(`Failed: `, e) }

    try {
        const fee = await contract.calcFee("abcd")
        console.log(`fee ${fee}`)
    } catch(e: any) { console.log(`Failed: `, e) }
}

async function approve1GethOnGoerli() {
    const [ signer ] = await ethers.getSigners()

    console.log(`approve1GethOnGoerli`)
    const erc20 = await ethers.getContractAt('ERC20Mock', celrTokenOnGoerli) as ERC20Mock
    console.log(`contract created`)
    
    let approved = await erc20.allowance(signer.address, goerliChainData.messageBus)
    console.log(`approved: ${approved.toString()}`)

    const approveTx = await erc20.approve(goerliChainData.messageBus, '0') // 1000000000000000000
    console.log(`approve tx hash: ${approveTx.hash}`)
    const receipt = await approveTx.wait()
    console.log(`done`)

    approved = await erc20.allowance(signer.address, goerliChainData.messageBus)
    console.log(`approved: ${approved.toString()}`)
}

async function getApproved() {
    const chainData = await getIDataByChainId()
    if (chainData.chainId !== goerliChainData.chainId) {
        return;
    }

    const [ signer ] = await ethers.getSigners()
    const erc20 = await ethers.getContractAt('ERC20Mock', celrTokenOnGoerli) as ERC20Mock

    const approved = await erc20.allowance(signer.address, goerliChainData.messageBus)
    console.log(`$CELR approved for message bus: ${approved.toString()}`)
}

if (require.main === module) {
    console.log('hello from message.ts')
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}