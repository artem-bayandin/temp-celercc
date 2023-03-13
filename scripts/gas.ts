import { ethers } from 'hardhat'

async function main() {
    const [ signer ] = await ethers.getSigners()
    console.log(`signer`, signer.address)

    const feeData = await ethers.provider.getFeeData()
    console.log(`feedata`, feeData)
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