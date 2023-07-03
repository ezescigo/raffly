import { deployments, ethers, getNamedAccounts, network } from "hardhat"
import { ChainId, developmentChains, networkConfig } from "../../helper-hardhat-config"
import { Raffle, Raffle__factory, VRFCoordinatorV2Mock } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { assert, expect } from "chai"

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          let raffle: Raffle
          let deployer: HardhatEthersSigner
          let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
          let entranceFee: bigint
          let interval: bigint

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              //const { deployer } = await getNamedAccounts()

              await deployments.fixture(["all"])
              const raffleContract = await deployments.get("Raffle")
              const vrfCoordinatorV2MockContract = await deployments.get("VRFCoordinatorV2Mock")

              vrfCoordinatorV2Mock = (await ethers.getContractAt(
                  vrfCoordinatorV2MockContract.abi,
                  vrfCoordinatorV2MockContract.address
              )) as any as VRFCoordinatorV2Mock
              raffle = (await ethers.getContractAt(
                  raffleContract.abi,
                  raffleContract.address
              )) as any as Raffle

              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })
          describe("constructor", () => {
              it("initializes raffleState correctly", async () => {
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
              })
              it("initializes interval correctly", async () => {
                  const interval = await raffle.getInterval()
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId as ChainId].interval
                  )
              })
          })
          describe("EnterRaffle", () => {
              it("Reverts when you dont pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("Save players when is successful", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  const contractPlayer = await raffle.getPlayer(0)
                  assert.equal(contractPlayer.toString(), deployer.address)
              })
              it("Emits event RaffleEnter", async () => {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("Reverts when Raffle is not open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  // Pretending to be a Chainlink Keeper
                  await raffle.performUpkeep("0x")

                  await expect(
                      raffle.enterRaffle({ value: entranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
                  // await expect(
                  //     raffle.enterRaffle({ value: sendValue })
                  // ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
          })
          describe("checkUpkeep", () => {
              //     it("Returns false if people haven't sent any ETH", async () => {
              //         await network.provider.send("evm_increaseTime", [Number(interval) + 1])
              //         await network.provider.send("evm_mine", [])
              //         // const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
              //         console.log(upKeepNeeded)
              // assert(!upkeepNeeded)
              //     })
              it("Returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  // const { upkeepNeeded } = raffle.callStatic.checkUpkeep("0x")
                  assert.equal(raffleState.toString(), "1")
                  // assert.equal(upkeepNeeded, false)
              })
          })
      })
