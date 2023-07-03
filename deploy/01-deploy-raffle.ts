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
import { Raffle__factory } from "../typechain-types"

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30")

const raffle: DeployFunction = async function ({
    getNamedAccounts,
    deployments,
}: HardhatRuntimeEnvironment) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId as number
    let vrfCoordinatorV2Mock
    let vrfCoordinatorV2Address, subscriptionId

    console.log("holaaaaaaaaaaaaaaaaaa CHAIN ID:", chainId)

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2MockContract = await deployments.get("VRFCoordinatorV2Mock")

        // console.log("contract", vrfCoordinatorV2MockContract)

        vrfCoordinatorV2Mock = (await ethers.getContractAt(
            vrfCoordinatorV2MockContract.abi,
            vrfCoordinatorV2MockContract.address
        )) as any as VRFCoordinatorV2Mock

        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = (await transactionResponse.wait(1)) as any

        // subscriptionId = await transactionReceipt?.events[0].args.subscriptionId
        subscriptionId = 1

        // console.log("sub id", subscriptionId)
        // console.log(transactionReceipt)
        const fundTxResponse = await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            VRF_SUB_FUND_AMOUNT
        )
        const fundTxReceipt = await fundTxResponse.wait(1)
    } else {
        vrfCoordinatorV2Address = Object.entries(networkConfig).find(
            ([key, value]) => key === chainId.toString()
        )?.[1].vrfCoordinatorV2Address
        subscriptionId = Object.entries(networkConfig).find(
            ([key, value]) => key === chainId.toString()
        )?.[1].subscriptionId
    }

    const entranceFee = Object.entries(networkConfig).find(
        ([key, value]) => key === chainId.toString()
    )?.[1].entranceFee

    const gasLane = Object.entries(networkConfig).find(
        ([key, value]) => key === chainId.toString()
    )?.[1].gasLane

    const callbackGasLimit = Object.entries(networkConfig).find(
        ([key, value]) => key === chainId.toString()
    )?.[1].callbackGasLimit

    const interval = Object.entries(networkConfig).find(
        ([key, value]) => key === chainId.toString()
    )?.[1].interval

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    // console.log("args", args)

    // const signers = await ethers.getSigners()
    // const raffleContract = new Raffle__factory(signers[0])
    // const raffle = await raffleContract.deploy(
    //     vrfCoordinatorV2Address!,
    //     entranceFee!,
    //     gasLane!,
    //     subscriptionId!,
    //     callbackGasLimit!,
    //     interval!
    // )

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: 1,
    })

    if (vrfCoordinatorV2Mock && subscriptionId) {
        await vrfCoordinatorV2Mock!.addConsumer(subscriptionId, await raffle.address)
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args)
    }

    console.log("------------------------------------------------------")
}

export default raffle
raffle.tags = ["all", "raffle"]
