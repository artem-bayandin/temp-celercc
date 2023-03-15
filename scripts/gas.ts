import { ethers } from 'hardhat'

async function main() {
    const [ signer ] = await ethers.getSigners()
    console.log(`signer`, signer.address)

    const feeData = await ethers.provider.getFeeData()
    console.log(`feedata`, feeData)

    const gas = feeData.gasPrice?.div(1000000000).add(1)
    console.log(`gas costs ${gas} gwei`)
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