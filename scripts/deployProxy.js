const { ethers, upgrades } = require("hardhat")

async function main() {
    const raffleClonable = await ethers.getContractFactory("RaffleClonable")
    const proxy = await upgrades.deployProxy(raffleClonable, [12, 12])
    await proxy.deployed()

    console.log(proxy.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
