import { readFileSync, writeFileSync, writeSync } from "fs"
import { deployments, ethers, network } from "hardhat"
import { Raffle } from "../typechain-types"

const FRONT_END_ADDRESSES_FILE = "../raffly-front/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../raffly-front/constants/abi.json"

const updateFunction = async () => {
    if (process.env.UPDATE_FRONTEND) {
        console.log("updating frontend...")
        await updateContractAddresses()
        await updateContractAbi()
    }
}

const updateContractAddresses = async () => {
    const raffleContract = await deployments.get("Raffle")
    const chainId = network?.config?.chainId?.toString() ?? ""

    const currentAddresses = JSON.parse(readFileSync(FRONT_END_ADDRESSES_FILE, "utf-8"))

    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffleContract.address)) {
            currentAddresses[chainId].push(raffleContract.address)
        }
    } else {
        currentAddresses[chainId] = [raffleContract.address]
    }

    writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

const updateContractAbi = async () => {
    const raffleContract = await deployments.get("Raffle")
    const raffle = (await ethers.getContractAt(
        raffleContract.abi,
        raffleContract.address
    )) as any as Raffle

    writeFileSync(FRONT_END_ABI_FILE, JSON.stringify(raffleContract.abi))
}

export default updateFunction

updateFunction.tags = ["all", "frontend"]
