import { FeeData } from '@ethersproject/providers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, ContractReceipt } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Mock, ERC721CelerCrossChain, NFTBridge } from '../typechain-types'

/*
    Event topic
    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee)
    0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4
*/

/*
    Event topic
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
    0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
*/

let signer: SignerWithAddress
let feeData: FeeData

async function main() {
    signer = (await ethers.getSigners())[0]
    console.log(`signer`, signer.address)

    feeData = await ethers.provider.getFeeData()
    console.log(`feedata`, feeData)

    // await crossChain(goerliChainData, bscChainData)

    // todo: review $CELER token consumption
    // todo: review balance comsumption

    await getTokenOwner(100003)
}


interface IData {
    name: string
    chainId: number
    nftAddress: string
    messageBus: string
    bridgeAddress: string
    offset: number
    minted: number
}

const goerliChainData: IData = {
    name: 'Goerli'
    , chainId: 5
    , nftAddress: '0x1Fc79Da8EeD8b183b73cE5A24E99f971C3336917'
    , messageBus: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2'
    , bridgeAddress: '0x130b890db8796667c92c9df0afa3eaeee60f5606' // '0x358234B325EF9eA8115291A8b81b7d33A2Fa762D'
    , offset: 100000
    , minted: 10 // 3,4,5 transferred
}

const mumbaiChainData: IData = {
    name: 'Mumbai'
    , chainId: 80001
    , nftAddress: '0x7AEC44c7b27a810c38897b6e4ec4521355711940'
    , messageBus: '0x7d43AABC515C356145049227CeE54B608342c0ad'
    , bridgeAddress: '0x57F291B73150157c94a99172355722e2c0268e26' // '0x841ce48F9446C8E281D3F1444cB859b4A6D0738C'
    , offset: 0
    , minted: 10 // 3,4,5 transferred
}

const bscChainData: IData = {
    name: 'BSC Testnet'
    , chainId: 97
    , nftAddress: '0xb06C0B907c5F1A4090Ec41749e3e00A57f55ca03'
    , messageBus: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA'
    , bridgeAddress: '0x22D8DC613d0866393714ad038817158d79507039' // '0xf89354F314faF344Abd754924438bA798E306DF2'
    , offset: 200000
    , minted: 10 // 3,4,5 transferred
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

async function getNftContract(address: string): Promise<ERC721CelerCrossChain> {
    return await ethers.getContractAt('ERC721CelerCrossChain', address) as ERC721CelerCrossChain
}

async function getBridgeContract(address: string): Promise<NFTBridge> {
    return await ethers.getContractAt('NFTBridge', address) as NFTBridge
}

async function deployContract(bridge: string) {
    const chainData = await getIDataByChainId()
    console.log(`deploying to ${chainData.chainId} ${chainData.name}`)

    if (!bridge) {
        bridge = chainData.bridgeAddress
    }

    const factory = await ethers.getContractFactory('ERC721CelerCrossChain');
    const implementation = await factory.deploy(`ERC721CC-${chainData.name}`, `ERC721CC${chainData.chainId}`, bridge);
    console.log(`ERC721CelerCrossChain deployment tx hash: ${implementation.deployTransaction.hash}`)
    await implementation.deployed()
    console.log(`ERC721CelerCrossChain deployed at ${implementation.address}`)
    return implementation
}

async function deployBridge() {
    const chainData = await getIDataByChainId()
    console.log(`deploying to ${chainData.chainId} ${chainData.name}`)
    const factory = await ethers.getContractFactory('NFTBridge');
    const implementation = await factory.deploy(chainData.messageBus);
    console.log(`NFTBridge deployment tx hash: ${implementation.deployTransaction.hash}`)
    await implementation.deployed()
    console.log(`NFTBridge deployed at ${implementation.address}`)
    return implementation
}

async function mint(amount: number) {
    const chainData = await getIDataByChainId()
    const contract = await getNftContract(chainData.nftAddress)

    for (let i = 0; i < amount; i++) {
        const tokenId = chainData.offset + chainData.minted + 1 + i
        const mintTx = await contract.mint(signer.address, tokenId)
        console.log(`mint ${tokenId} to ${signer.address} on ${chainData.name} tx hash: ${mintTx.hash}`)
        await mintTx.wait()
        console.log(`completed`)
    }
}

async function transferSingleChain() {
    const receiver = '0x93629A73B8898Cd35Cf070d53b4633c543Ebdffc'

    const chainData = await getIDataByChainId()
    const contract = await getNftContract(chainData.nftAddress)

    for (let i = 3; i <= 5; i++) {
        const tokenId = chainData.offset + i

        const transferTx = await contract.transferFrom(signer.address, receiver, tokenId)
        console.log(`transfer ${tokenId} to ${receiver} on ${chainData.name} tx hash: ${transferTx.hash}`)
        await transferTx.wait()
        console.log(`completed`)
    }
}

async function crossChain(srcChainData: IData, destChainData: IData) {
    const contract = await getNftContract(srcChainData.nftAddress)

    const tokenId = 3 + srcChainData.offset

    const fee = await contract.totalFee(destChainData.chainId, tokenId)
    console.log(`fee: ${fee.toString()}`)

    const bridge = await contract.nftBridge()
    console.log(`bridge: ${bridge}`)

    const estimated = await contract.estimateGas.crossChain(destChainData.chainId, tokenId, signer.address, { value: fee, gasLimit: 500000 })
    console.log(`estimated: ${estimated.toString()}`)

    const balance = await signer.getBalance()
    const balanceNeeded = feeData.gasPrice?.mul(estimated).add(fee)
    console.log(
`balance: ${balance.toString()}
needed : ${balanceNeeded?.toString()}`)

    const crossChainTx = await contract.crossChain(destChainData.chainId, tokenId, signer.address, { value: fee, gasLimit: 500000 })
    console.log(`crossChain ${tokenId} from ${srcChainData.name} ${destChainData.name} tx hash: ${crossChainTx.hash}`)
    const receipt = await crossChainTx.wait()
    console.log(`completed`.toLowerCase)

    const events = receipt.events || []

    const msgBusEvents = events.filter((item: any) => item.address.toLowerCase() === srcChainData.messageBus.toLowerCase())
    console.log(`MSG_BUS EVENTS`, msgBusEvents)

    console.log('ALL EVENTS', events)
}

async function setupBridge() {
    const currentChainData = await getIDataByChainId()
    const bridge = await getBridgeContract(currentChainData.bridgeAddress)

    const destChains = [ goerliChainData, mumbaiChainData, bscChainData ]
    .filter((item: IData) => item.chainId !== currentChainData.chainId)

    const tokenId = 3 + currentChainData.offset
    const fee = await bridge.totalFee(destChains[0].chainId, currentChainData.nftAddress, tokenId)
    console.log(`fee: ${fee.toString()}`)

    const destChaindIds = destChains.map((item: IData) => item.chainId)
    const destNfts = destChains.map((item: IData) => item.nftAddress)
    const destBridges = destChains.map((item: IData) => item.bridgeAddress)

    const setDestBridgesTx = await bridge.setDestBridges(destChaindIds, destBridges)
    console.log(`setDestBridges on ${currentChainData.name} tx hash: ${setDestBridgesTx.hash}`)
    await setDestBridgesTx.wait()
    console.log(`completed`)

    const setDestNftsTx = await bridge.setDestNFTs(currentChainData.nftAddress, destChaindIds, destNfts)
    console.log(`setDestNfts on ${currentChainData.name} tx hash: ${setDestNftsTx.hash}`)
    await setDestNftsTx.wait()
    console.log(`completed`)
}

async function getTokenOwner(tokenId: number) {
    const chainData = await getIDataByChainId()
    const contract = await getNftContract(chainData.nftAddress)

    const owner = await contract.ownerOf(tokenId)
    console.log(`owner: ${owner}`)
}

if (require.main === module) {
    console.log('hello from erc721.ts')
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}

/*
EVENTS [
  {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)

    transactionIndex: 1,
    blockNumber: 8658218,
    transactionHash: '0x0ac3c57c2ea8d3ac97f2242a39f18588c683b2179e947edeba8f96ca95e46fa8',
    address: '0x1Fc79Da8EeD8b183b73cE5A24E99f971C3336917',
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x00000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x00000000000000000000000000000000000000000000000000000000000186a3'
    ],
    data: '0x',
    logIndex: 3,
    blockHash: '0xd4c80287e33d9c1d08d5fd5c8ffdae4220f4f1bbc8e2842b0f3cc03c6071b1ab',
    args: [
      '0x93629A73B8898Cd35Cf070d53b4633c543Ebdffc',
      '0x0000000000000000000000000000000000000000',
      BigNumber { value: "100003" },
      from: '0x93629A73B8898Cd35Cf070d53b4633c543Ebdffc',
      to: '0x0000000000000000000000000000000000000000',
      tokenId: BigNumber { value: "100003" }
    ],
    decode: [Function (anonymous)],
    event: 'Transfer',
    eventSignature: 'Transfer(address,address,uint256)',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  },
  {
    event Message(address indexed sender, address receiver, uint256 dstChainId, bytes message, uint256 fee)

    transactionIndex: 1,
    blockNumber: 8658218,
    transactionHash: '0x0ac3c57c2ea8d3ac97f2242a39f18588c683b2179e947edeba8f96ca95e46fa8',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4', = event topic
      '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606' = indexed sender = src bridge
    ],
    data: '0x
    00000000000000000000000022d8dc613d0866393714ad038817158d79507039 = receiver
    0000000000000000000000000000000000000000000000000000000000000061 = destChainId = 97 = BSC testnet
    0000000000000000000000000000000000000000000000000000000000000080 = 128? offset/length (4 slots?)
    0000000000000000000000000000000000000000000000000000b242ce604000 = fee = 196000000000000 (fee from totalFee())
    0000000000000000000000000000000000000000000000000000000000000060 = 96 length of? NFTMsg(address user, address nft, uint256 tokenId)
    00000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc = user receiver
    000000000000000000000000b06c0b907c5f1a4090ec41749e3e00a57f55ca03 = nft on dest chain, BSC testnet
    00000000000000000000000000000000000000000000000000000000000186a3 = token id = 100003
    ',
    logIndex: 4,
    blockHash: '0xd4c80287e33d9c1d08d5fd5c8ffdae4220f4f1bbc8e2842b0f3cc03c6071b1ab',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/