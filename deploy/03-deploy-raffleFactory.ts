import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { ethers, network } from "hardhat"

import { developmentChains, networkConfig } from "../helper-hardhat-config"
import {
    VRFCoordinatorV2Mock,
    VRFCoordinatorV2MockInterface,
} from "../typechain-types/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock"
import { verify } from "../utils/verify"
import { BigNumberish } from "ethers"
import { RaffleClonable, Raffle__factory } from "../typechain-types"

const raffleFactory: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
}: HardhatRuntimeEnvironment) {
    ;``
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId as number
    // let raffleImplementation
    let upkeepAddress

    console.log("CHAIN ID:", chainId)
    console.log("---- DEPLOYING RAFFLE FACTORY CONTRACT -----")

    if (developmentChains.includes(network.name)) {
        // local
    } else {
        upkeepAddress = Object.entries(networkConfig).find(
            ([key, value]) => key === chainId.toString()
        )?.[1].upkeepAddress
    }

    const raffleImplementationContract = await deployments.get("RaffleClonable")
    const raffleImplementation = (await ethers.getContractAt(
        raffleImplementationContract.abi,
        raffleImplementationContract.address
    )) as any as RaffleClonable

    console.log(raffleImplementationContract.address)
    const args = [raffleImplementationContract.address, deployer, upkeepAddress]

    const raffleFactory = await deploy("RaffleFactory", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffleFactory.address, args)
    }

    console.log("------------------------------------------------------")
}

export default raffleFactory
raffleFactory.tags = ["all", "raffleFactory"]
