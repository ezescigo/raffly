import { deployments, ethers, network } from "hardhat"
import { developmentChains } from "../../helper-hardhat-config"
import { describe } from "mocha"
import { RaffleClonable, RaffleFactory, VRFCoordinatorV2Mock } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { Deployment } from "hardhat-deploy/types"

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Clonable Unit Tests", () => {
          let raffle: RaffleClonable
          let factory: RaffleFactory
          let deployer: HardhatEthersSigner
          let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
          let raffleContract: Deployment
          let factoryContract: Deployment
          let entranceFee: bigint
          let interval: bigint
          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              //const { deployer } = await getNamedAccounts()

              await deployments.fixture(["all"])
              raffleContract = await deployments.get("RaffleClonable")
              factoryContract = await deployments.get("RaffleFactory")
              const vrfCoordinatorV2MockContract = await deployments.get("VRFCoordinatorV2Mock")

              vrfCoordinatorV2Mock = (await ethers.getContractAt(
                  vrfCoordinatorV2MockContract.abi,
                  vrfCoordinatorV2MockContract.address
              )) as any as VRFCoordinatorV2Mock

              raffle = (await ethers.getContractAt(
                  raffleContract.abi,
                  raffleContract.address
              )) as any as RaffleClonable

              factory = (await ethers.getContractAt(
                  factoryContract.abi,
                  factoryContract.address
              )) as any as RaffleFactory

              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })
      })
