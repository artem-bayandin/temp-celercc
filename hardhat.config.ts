import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import '@nomiclabs/hardhat-web3'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-contract-sizer'
import 'solidity-coverage'

/*
  .secrets.json:
  {
    "pk": ""
  }
*/
const { pk } = require("./.secrets.json")

const _1gwei = 1000000000

const config: HardhatUserConfig = {
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts'
  },
  solidity: {
    compilers:[{
      version: '0.8.18',
      settings:{
        optimizer:{
          enabled: true,
          runs: 1331
        }
      }
    }, {
      version: '0.8.9',
      settings:{
        optimizer:{
          enabled: true,
          runs: 1331
        }
      }
    }]
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 127127,
      accounts: {
        mnemonic: 'junk test junk test junk test junk test junk test junk test'
      },
      blockGasLimit: 30000000,
      gas: 3000000,
      gasPrice: 5 * _1gwei,
      allowUnlimitedContractSize: false,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      /* loggingEnabled: true */
    },
    bsctest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gas: 3000000,
      gasPrice: 10 * _1gwei,
      accounts: [pk]
    },
    goerli: {
      url: "https://goerli.blockpi.network/v1/rpc/public",
      chainId: 5,
      gas: 3000000,
      gasPrice: 110 * _1gwei, // 133 609 732 389
      accounts: [pk]
    },
    mumbai: {
      url: 'https://matic-mumbai.chainstacklabs.com',
      chainId: 80001,
      gas: 3000000,
      gasPrice: 2 * _1gwei,
      accounts: [pk]
    }
  }
}

export default config
