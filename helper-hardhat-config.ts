import { ethers } from "hardhat"

const UPKEEP_ADDRESS = process.env.UPKEEP_ADDRESS || ""

export interface NetworkConfigItemType {
    name: string
    entranceFee: bigint
    gasLane: string
    subscriptionId?: string
    vrfCoordinatorV2Address?: string
    callbackGasLimit: string
    interval: string
    upkeepAddress?: string
}

export type NetworkConfigType = Record<ChainId, NetworkConfigItemType>

export type ChainId = 11155111 | 31337

export const networkConfig: NetworkConfigType = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2Address: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        upkeepAddress: UPKEEP_ADDRESS,
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei Key Hashm
        subscriptionId: "3306",
        callbackGasLimit: "500000",
        interval: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.parseEther("0.1"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        interval: "172800", // 2 days
    },
    // 137: {
    //     name: "polygon",
    //     vrfCoordinatorV2Address: "",
    //     entranceFee
    // },
}

export const developmentChains = ["hardhat", "localhost"]
