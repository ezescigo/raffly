import { deployments, ethers, network } from "hardhat"
import { Raffle } from "../../typechain-types"
import { Deployment } from "hardhat-deploy/types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { developmentChains } from "../../helper-hardhat-config"
import { assert, expect } from "chai"
import { log } from "console"

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", () => {
          let raffle: Raffle
          let deployer: HardhatEthersSigner
          let raffleContract: Deployment
          let entranceFee: bigint
          let interval: bigint
          let accounts: HardhatEthersSigner[]

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]

              raffleContract = await deployments.get("Raffle")

              raffle = (await ethers.getContractAt(
                  raffleContract.abi,
                  raffleContract.address
              )) as any as Raffle

              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("fulfillRandomWords", () => {
              it("works with live Chainlink keepers and Chainlink VRF, we get a random winner", async () => {
                  const startingTimeStamp = await raffle.getLastTimeStamp()
                  const event = raffle.getEvent("WinnerPicked")

                  await new Promise(async (resolve, reject) => {
                      raffle.once(event, async () => {
                          // por alguna razón no se dispara. Pero sí se ve en el Keeper y en VRF
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].provider.getBalance(
                                  accounts[0].address
                              )
                              const endingTimeStamp = await raffle.getLastTimeStamp()

                              // Players array has been reset
                              await expect(raffle.getPlayer(0)).to.be.reverted

                              // Winner must be our deployer
                              assert.equal(recentWinner.toString(), accounts[0].address)

                              // Raffle State has been reset to OPEN
                              assert.equal(raffleState.toString(), "0")

                              // Deployer is the only player, so he will only recover the entranceFee when he wins
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + entranceFee).toString()
                              )

                              assert(endingTimeStamp > startingTimeStamp)
                              resolve("")
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })

                      log("Entering Raffle")
                      const txEnter = await raffle.enterRaffle({ value: entranceFee })
                      console.log("Tx Enter", txEnter)
                      const txEnterReceipt = await txEnter.wait()
                      console.log("Tx Receipt!", txEnterReceipt)

                      const winnerStartingBalance = await accounts[0].provider.getBalance(
                          accounts[0].address
                      )
                      console.log("winnerStartingBalance", winnerStartingBalance)
                  })
              })
          })
      })
