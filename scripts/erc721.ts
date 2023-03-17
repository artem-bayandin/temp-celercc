import { FeeData } from '@ethersproject/providers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, ContractReceipt } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Mock, ERC721CelerCrossChain, IERC20, NFTBridge } from '../typechain-types'
import secrets from '../.secrets.json'

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

    await crossChain(mumbaiChainData, goerliChainData, 9 + mumbaiChainData.offset)
    await crossChain(mumbaiChainData, bscChainData, 10 + mumbaiChainData.offset)
    // await logTokenOwners()
    // await logBalances()
    // await transferSingleChain()

    // todo: review $CELER token consumption
    // todo: review balance comsumption
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
    , minted: 10
    // 100001
    // 100002
    // 100003 on BSC
    // 100004 on Mumbai
    // 100005 on BSC
    // 100006 (user)
    // 100007 (user)
    // 100008 (user)
    // 100009 (user)
    // 100010 (user)
    // other
    // 4 (user)
    // 200004 from BSC (user)
}

const mumbaiChainData: IData = {
    name: 'Mumbai'
    , chainId: 80001
    , nftAddress: '0x7AEC44c7b27a810c38897b6e4ec4521355711940'
    , messageBus: '0x7d43AABC515C356145049227CeE54B608342c0ad'
    , bridgeAddress: '0x57F291B73150157c94a99172355722e2c0268e26' // '0x841ce48F9446C8E281D3F1444cB859b4A6D0738C'
    , offset: 0
    , minted: 10
    // 1
    // 2
    // 3 on BSC
    // 4 on Goerli
    // 5 (user)
    // 6
    // 7
    // 8
    // 9
    // 10
    // other
    // 200003 from BSC (user)
    // 100004 from Goerli (user)
}

const bscChainData: IData = {
    name: 'BSC Testnet'
    , chainId: 97
    , nftAddress: '0xb06C0B907c5F1A4090Ec41749e3e00A57f55ca03'
    , messageBus: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA'
    , bridgeAddress: '0x22D8DC613d0866393714ad038817158d79507039' // '0xf89354F314faF344Abd754924438bA798E306DF2'
    , offset: 200000
    , minted: 10
    // 200001
    // 200002
    // 200003 on Mumbai
    // 200004 on Goerli
    // 200005 (user)
    // 200006
    // 200007
    // 200008
    // 200009
    // 200010
    // other
    // 3 from Mumbai (user)
    // 100003 from Goerli (user)
    // 100005 from Goerli (user)
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

async function getCelerToken(): Promise<IERC20> {
    return await ethers.getContractAt('IERC20', '0x5d3c0f4ca5ee99f8e8f59ff9a5fab04f6a7e007f') as IERC20
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
    const receiver = secrets.userAddress

    const chainData = await getIDataByChainId()
    const contract = await getNftContract(chainData.nftAddress)

    for (let i = 6; i <= 10; i++) {
        const tokenId = chainData.offset + i

        const transferTx = await contract.transferFrom(signer.address, receiver, tokenId)
        console.log(`transfer ${tokenId} to ${receiver} on ${chainData.name} tx hash: ${transferTx.hash}`)
        await transferTx.wait()
        console.log(`completed`)
    }
}

async function crossChain(srcChainData: IData, destChainData: IData, tokenId: number) {
    const contract = await getNftContract(srcChainData.nftAddress)

    // const tokenId = 3 + srcChainData.offset

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
    console.log(`crossChain ${tokenId} from ${srcChainData.name} to ${destChainData.name} tx hash: ${crossChainTx.hash}`)
    const receipt = await crossChainTx.wait()
    console.log(`completed`)

    const events = receipt.events || []

    const msgBusEvents = events.filter((item: any) => item.address.toLowerCase() === srcChainData.messageBus.toLowerCase())
    console.log(`MSG_BUS EVENTS`, msgBusEvents)
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

async function logTokenOwners() {
    const { chainId, nftAddress } = await getIDataByChainId()
    const contract = await getNftContract(nftAddress)

    const chains = [ mumbaiChainData, bscChainData, goerliChainData ]

    for (let i = 0; i < chains.length; i++) {
        const { chainId: cid, name, offset, minted } = chains[i]

        console.log(`
reading tokens from chain ${name} (isCurrent: ${ chainId === cid })`)
        for (let i = offset + 1; i <= offset + minted; i++) {
            try {
                const owner = await contract.ownerOf(i)
                console.log(`${i} owner: ${owner}`)
            } catch (error) {
                console.log(`${i} owner not found`)
            }
        }
    }
}

async function logBalances() {
    const chainData = await getIDataByChainId()

    const adminBalance = await ethers.provider.getBalance(secrets.adminAddress)
    const userBalance = await ethers.provider.getBalance(secrets.userAddress)
    console.log(`balances (native):`, {
        adminBalance: adminBalance.toString()
        , userBalance: userBalance.toString()
    })

    if (chainData.chainId === goerliChainData.chainId) {
        const erc20Celer = await getCelerToken()
        const adminCeler = await erc20Celer.balanceOf(secrets.adminAddress)
        const userCeler = await erc20Celer.balanceOf(secrets.userAddress)
        console.log(`balances ($CELER):`, {
            adminCeler: adminCeler.toString()
            , userCeler: userCeler.toString()
        })
    }
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
crossChain 100004 from Goerli Mumbai tx hash: -----
completed
MSG_BUS EVENTS [
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
    00000000000000000000000022d8dc613d0866393714ad038817158d79507039 = receiver (dest bridge)
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

/*
crossChain 100004 from Goerli Mumbai tx hash: 0x1d07a1b07ade2c2d21660351d5c53dc8a17b87f4edf71d3d000e4469d4f25e40
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 10,
    blockNumber: 8659033,
    transactionHash: '0x1d07a1b07ade2c2d21660351d5c53dc8a17b87f4edf71d3d000e4469d4f25e40',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4', = event topic
      '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606' = indexed sender = src bridge
    ],
    data: '0x
    00000000000000000000000057f291b73150157c94a99172355722e2c0268e26 = receiver (dest bridge)
    0000000000000000000000000000000000000000000000000000000000013881 = destChainId = 80001 = Mumbai
    0000000000000000000000000000000000000000000000000000000000000080 = 128? offset/length (4 slots?)
    0000000000000000000000000000000000000000000000000000b242ce604000 = fee = 196000000000000 (fee from totalFee())
    0000000000000000000000000000000000000000000000000000000000000060 = 96 length of? NFTMsg(address user, address nft, uint256 tokenId)
    00000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc = user receiver
    0000000000000000000000007aec44c7b27a810c38897b6e4ec4521355711940 = nft on dest chain, Mumbai
    00000000000000000000000000000000000000000000000000000000000186a4 = token id = 100004
    ',
    logIndex: 18,
    blockHash: '0x1a1b6d5cad38e356e2530ac55ca73523f294a9c91596966605f46857ba70b601',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 200003 from BSC Testnet to Mumbai tx hash: 0x5e650f19244c99a09db1a21f6c69662d15c1391b91231853075bc8f77f7371f8
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 6,
    blockNumber: 28064731,
    transactionHash: '0x5e650f19244c99a09db1a21f6c69662d15c1391b91231853075bc8f77f7371f8',
    address: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039'
    ],
    data: '0x00000000000000000000000057f291b73150157c94a99172355722e2c0268e26000000000000000000000000000000000000000000000000000000000001388100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000b242ce604000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc0000000000000000000000007aec44c7b27a810c38897b6e4ec45213557119400000000000000000000000000000000000000000000000000000000000030d43',
    logIndex: 1,
    blockHash: '0x11108b74cfc1cb2b509c0804139ee953f15efbb580e4cc15fb1c4de91fbcc9bc',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 200004 from BSC Testnet to Goerli tx hash: 0x30bf34c9be2f0a211a917b9bea5d2cfa9dd789c38a854a36b26917d5d552148c
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 7,
    blockNumber: 28064765,
    transactionHash: '0x30bf34c9be2f0a211a917b9bea5d2cfa9dd789c38a854a36b26917d5d552148c',
    address: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039'
    ],
    data: '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000b242ce604000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc0000000000000000000000001fc79da8eed8b183b73ce5a24e99f971c33369170000000000000000000000000000000000000000000000000000000000030d44',
    logIndex: 16,
    blockHash: '0x8f52a3243372a8970db3a26874d60834765164475df9883e0061e821d6c0791f',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 3 from Mumbai to BSC Testnet tx hash: 0xac186cf738a40417fccadea3758997b460a7fd101526b56e54eeace8322644b9
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 4,
    blockNumber: 33142405,
    transactionHash: '0xac186cf738a40417fccadea3758997b460a7fd101526b56e54eeace8322644b9',
    address: '0x7d43AABC515C356145049227CeE54B608342c0ad',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x00000000000000000000000057f291b73150157c94a99172355722e2c0268e26'
    ],
    data: '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc000000000000000000000000b06c0b907c5f1a4090ec41749e3e00a57f55ca030000000000000000000000000000000000000000000000000000000000000003',
    logIndex: 31,
    blockHash: '0x09e2a0837a2adf45d1126282e22c05607f058e6bdbba0b76e0715424ec3b3c2c',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 4 from Mumbai to Goerli tx hash: 0x46db6049421f6f0094f97c7e41460556848ad8e65b7f471a4e6dc709f53518e0
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 1,
    blockNumber: 33142426,
    transactionHash: '0x46db6049421f6f0094f97c7e41460556848ad8e65b7f471a4e6dc709f53518e0',
    address: '0x7d43AABC515C356145049227CeE54B608342c0ad',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x00000000000000000000000057f291b73150157c94a99172355722e2c0268e26'
    ],
    data: '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc0000000000000000000000001fc79da8eed8b183b73ce5a24e99f971c33369170000000000000000000000000000000000000000000000000000000000000004',
    logIndex: 7,
    blockHash: '0xe2ee48ab1a4ca88903cbd3632ddaad3992f90db6d7b2e5cc6c6b97a458e4224d',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
    ===== BALANCES

    Initial                                         . After 1st transfer        . After executor        . BSC to Goerli
    Mumbai:
    balances (native): {
        adminBalance: '15 823413022752805553',
        userBalance:  '00 999669543750104808'
    }
    BSC Testnet:
    balances (native): {
        adminBalance: '7 940905322000000000',       . -                         . 7 939336658000000000  . -
                                                                                . 0 001568664000000000
        userBalance:  '0 998306920000000000'        . -                         . -                     . 0 997460500000000000
                                                                                                        . 0 000846420000000000
    }
    Goerli:
    balances (native): {
        adminBalance: '3 661475952160960321',      . -                          . -                     . 3 651359959825087729
                                                                                                        . 0 010115992335872592
        userBalance:  '0 283222143144835135'       . 0 277628413144835135       . -                     . -
                                                   . 0 005593730000000000       .
    }
    balances ($CELER): {
        adminCeler: '202939 515335428076168245',   . -                          . -                     . -
        userCeler:  '0'                            .
    }
*/

/*
crossChain 100005 from Goerli to BSC Testnet tx hash: 0x8391a1ed6331a9f6a0159a3250af963f66139fcfc5add00d60c68983f3782560
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 4,
    blockNumber: 8660109,
    transactionHash: '0x8391a1ed6331a9f6a0159a3250af963f66139fcfc5add00d60c68983f3782560',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606'
    ],
    data: '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000b242ce604000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc000000000000000000000000b06c0b907c5f1a4090ec41749e3e00a57f55ca0300000000000000000000000000000000000000000000000000000000000186a5',
    logIndex: 7,
    blockHash: '0x5bce3a4bac09bea49a42d583fe0925508a986ef4bc073258972b6b7bd7fc1512',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 100006 from Goerli to BSC Testnet tx hash: 0x66e9930688d8301eab5f20921cc34ab56c5efeb9e82236561ede4a7105c11dd1
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 38,
    blockNumber: 8660224,
    transactionHash: '0x66e9930688d8301eab5f20921cc34ab56c5efeb9e82236561ede4a7105c11dd1',
    address: '0xF25170F86E4291a99a9A560032Fe9948b8BcFBB2',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606'
    ],
    data: '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039000000000000000000000000000000000000000000000000000000000000006100000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000b242ce604000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc000000000000000000000000b06c0b907c5f1a4090ec41749e3e00a57f55ca0300000000000000000000000000000000000000000000000000000000000186a6',
    logIndex: 56,
    blockHash: '0x84ff21b459827b0004a200a25980d267251edda802eb019ac8a9a403736ac41e',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/

/*
crossChain 100006 from BSC Testnet to Goerli tx hash: 0xc2c5be027c3575dee9e9b6b97195398aa089e46b54c773afd9d34585744ed72a
completed
MSG_BUS EVENTS [
  {
    transactionIndex: 8,
    blockNumber: 28070993,
    transactionHash: '0xc2c5be027c3575dee9e9b6b97195398aa089e46b54c773afd9d34585744ed72a',
    address: '0xAd204986D6cB67A5Bc76a3CB8974823F43Cb9AAA',
    topics: [
      '0xce3972bfffe49d317e1d128047a97a3d86b25c94f6f04409f988ef854d25e0e4',
      '0x00000000000000000000000022d8dc613d0866393714ad038817158d79507039'
    ],
    data: '0x000000000000000000000000130b890db8796667c92c9df0afa3eaeee60f5606000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000b242ce604000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000093629a73b8898cd35cf070d53b4633c543ebdffc0000000000000000000000001fc79da8eed8b183b73ce5a24e99f971c333691700000000000000000000000000000000000000000000000000000000000186a6',
    logIndex: 3,
    blockHash: '0x0066ec80ce3b09dfc2580f950a0ca99156700e6b7e289f20163646e955a68fba',
    removeListener: [Function (anonymous)],
    getBlock: [Function (anonymous)],
    getTransaction: [Function (anonymous)],
    getTransactionReceipt: [Function (anonymous)]
  }
]
*/