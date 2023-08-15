import { deployments, ethers, network } from "hardhat"
import { Raffle, VRFCoordinatorV2Mock } from "../typechain-types"
import { EventLog, keccak256 } from "ethers"

const mockKeepers = async () => {
    const raffleContract = await deployments.get("Raffle")
    const raffle = (await ethers.getContractAt(
        raffleContract.abi,
        raffleContract.address
    )) as any as Raffle

    const checkData = keccak256(ethers.toUtf8Bytes(""))
    const { upKeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
    console.log(upKeepNeeded)
    if (upKeepNeeded) {
        const tx = await raffle.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const txReceiptEventLogs = txReceipt?.logs[0] as EventLog
        // console.log("here", txReceiptEventLogs)
        const requestId = txReceiptEventLogs.topics[2]
        console.log(`Performed upkeep with RequestId:  ${requestId}`)
        console.log(network.config.chainId)
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, raffle)
        }
    } else {
        console.log("No upkeep needed!")
    }
}

const mockVrf = async (requestId: any, raffle: Raffle) => {
    console.log("Mocking")
    const vrfCoordinatorV2MockContract = await deployments.get("VRFCoordinatorV2Mock")

    const vrfCoordinatorV2Mock = (await ethers.getContractAt(
        vrfCoordinatorV2MockContract.abi,
        vrfCoordinatorV2MockContract.address
    )) as any as VRFCoordinatorV2Mock

    const raffleAddress = await raffle.getAddress()
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffleAddress)
    const recentWinner = await raffle.getRecentWinner()
    console.log(`Winner is ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
