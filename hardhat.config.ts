import { HardhatUserConfig } from 'hardhat/types'
import 'hardhat-contract-sizer'
import 'solidity-coverage'

const config: HardhatUserConfig = {
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
      gasPrice: 5 * 1000000000,
      allowUnlimitedContractSize: false,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      /* loggingEnabled: true */
    },
    mumbai: {
      url: 'https://matic-mumbai.chainstacklabs.com/',
      chainId: 80001,
      gas: 3000000,
      gasPrice: 50 * 1000000000,
      // or `accounts: [privateKey]`
      accounts: {
        mnemonic: 'junk test 1111 test junk 2222 junk test 3333 test junk 4444'
      }
    }
  }
}

export default config
