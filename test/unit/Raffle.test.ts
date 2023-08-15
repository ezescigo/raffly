import { deployments, ethers, getNamedAccounts, network } from "hardhat"
import { ChainId, developmentChains, networkConfig } from "../../helper-hardhat-config"
import { Raffle, Raffle__factory, VRFCoordinatorV2Mock } from "../../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import { Deployment } from "hardhat-deploy/types"
import { BigNumberish, EventLog } from "ethers"
import assert from "assert"

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          let raffle: Raffle
          let deployer: HardhatEthersSigner
          let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
          let raffleContract: Deployment
          let entranceFee: bigint
          let interval: bigint

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              //const { deployer } = await getNamedAccounts()

              await deployments.fixture(["all"])
              raffleContract = await deployments.get("Raffle")
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
                  // const a = raffleContract.callStatic.checkUpkeep("0x")
                  // console.log(a)
                  assert.equal(raffleState.toString(), "1")
                  // assert.equal(upkeepNeeded, false)
              })
          })
          describe("performUpkeep", () => {
              //     it("Returns false if people haven't sent any ETH", async () => {
              //         await network.provider.send("evm_increaseTime", [Number(interval) + 1])
              //         await network.provider.send("evm_mine", [])
              //         // const { upKeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
              //         console.log(upKeepNeeded)
              // assert(!upkeepNeeded)
              //     })
              it("can only run if checkUpkeep is true", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("Reverts when checkupkeep is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("Updates the raffle state, emits an event, and calls the vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait()

                  const raffleState = await raffle.getRaffleState()
                  // const requestId = await txReceipt?.logs[0].provider.
                  // const requestId = await txReceipt.events[1].args.requestId
                  // assert(Number(requestId) > 0)
                  assert(raffleState.toString(), "1")
                  // console.log(requestId)
              })
          })
          describe("fulfillRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("Can only be called after performUpkeep ", async () => {
                  const address = await raffle.getAddress()
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, address)
                  ).to.be.revertedWith("nonexistent request")
              })
              it("Picks a winner, resets the lottery, sends money", async () => {
                  const additionalParticipants = 3
                  const startingAccountIndex = 1 // deployer = 0
                  const accounts = await ethers.getSigners()
                  const raffleAddress = await raffle.getAddress()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalParticipants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: entranceFee })
                  }
                  const startingTimeStamp = await raffle.getLastTimeStamp()

                  // performupkeep (mock being Chainlink Keepers)
                  // fulfillRandomWords (mock being the Chainlink VRF)
                  // wait for the fulfillRandomWords to be called
                  await new Promise(async (resolve, reject) => {
                      const event = raffle.getEvent("WinnerPicked")
                      // console.log("event", event)
                      // await raffle.once(event, async () => {
                      //     console.log("WinnerPicked triggered!")
                      //     try {
                      //         const recentWinner = await raffle.getRecentWinner()
                      //         console.log("recentWinner", recentWinner)
                      //         console.log(accounts[0].address)
                      //         console.log(accounts[1].address)
                      //         console.log(accounts[2].address)
                      //         console.log(accounts[3].address)
                      //         const raffleState = await raffle.getRaffleState()
                      //         const endingTimeStamp = await raffle.getLastTimeStamp()
                      //         const numPlayers = await raffle.getNumberOfPlayers()
                      //         const winnerEndingBalance = await raffle.runner!.provider!.getBalance(
                      //             accounts[1].address
                      //         )
                      //         assert.equal(numPlayers.toString(), "0")
                      //         assert.equal(raffleState.toString(), "0")
                      //         assert(endingTimeStamp > startingTimeStamp)

                      //         // Winner ends with their starting money + all the entries fees (including theirs)
                      //         assert.equal(
                      //             winnerEndingBalance.toString(),
                      //             (
                      //                 winnerStartingBalance +
                      //                 entranceFee * BigInt(additionalParticipants)
                      //             ).toString()
                      //         )
                      //     } catch (e) {
                      //         reject(e)
                      //     }
                      //     resolve("")
                      // })

                      try {
                          await raffle.enterRaffle({ value: entranceFee })
                          await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                          await network.provider.send("evm_mine", [])

                          const tx = await raffle.performUpkeep("0x")
                          const txReceipt = await tx.wait(1)

                          const txReceiptEventLogs = txReceipt?.logs[0] as EventLog
                          // console.log("here", txReceiptEventLogs)
                          const requestId = txReceiptEventLogs.topics[2]

                          const winnerStartingBalance = await raffle.runner!.provider!.getBalance(
                              accounts[1].address
                          )

                          // console.log("winnerStartingBalance", winnerStartingBalance)
                          // console.log("requestId", requestId)
                          // console.log("raffleAddress", raffleAddress)
                          // await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target)

                          await new Promise((resolve) => setTimeout(resolve, 5000))

                          // This expect does not work
                          expect(
                              vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target)
                          ).to.emit(vrfCoordinatorV2Mock, "WinnerPickedsss")

                          console.log("WinnerPicked !!! ")

                          await new Promise((resolve) => setTimeout(resolve, 5000))

                          const recentWinner = await raffle.getRecentWinner()
                          const raffleState = await raffle.getRaffleState()
                          const endingTimeStamp = await raffle.getLastTimeStamp()
                          const numPlayers = await raffle.getNumberOfPlayers()
                          const winnerEndingBalance = await raffle.runner!.provider!.getBalance(
                              accounts[1].address
                          )
                          assert.equal(numPlayers.toString(), "0")
                          assert.equal(raffleState.toString(), "0")
                          assert(endingTimeStamp > startingTimeStamp)

                          console.log("recentWinner", recentWinner)
                          // Winner ends with their starting money + all the entries fees (including theirs)

                          console.log("winnerEndingBalance", winnerEndingBalance.toString())
                          console.log("entranceFee", entranceFee)
                          assert.equal(
                              (winnerEndingBalance - winnerStartingBalance).toString(),
                              (entranceFee * BigInt(additionalParticipants + 2)).toString()
                          )
                          resolve("0x")
                      } catch (e) {
                          reject(e)
                      }
                  })
              })
          })
      })
