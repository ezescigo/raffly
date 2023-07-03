import { HardhatRuntimeEnvironment } from "hardhat/types"
import { ethers, network } from "hardhat"

import { DeployFunction } from "hardhat-deploy/types"
import { developmentChains } from "../helper-hardhat-config"

const deployMocks: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
}: HardhatRuntimeEnvironment) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const BASE_FEE = ethers.parseEther("0.25") // 0.25 LINK per request (Premium param)
    const GAS_PRICE_LINK = 1e9

    if (developmentChains.includes(network.name)) {
        log("Local network detected, deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mocks deployed!!!!")
        log("---------------------------------------------------")
    }
}

export default deployMocks
deployMocks.tags = ["all", "mocks"]
