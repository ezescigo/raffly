import "@nomicfoundation/hardhat-toolbox"
import "@nomiclabs/hardhat-solhint"
import { HardhatUserConfig } from "hardhat/types"
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import "@nomicfoundation/hardhat-toolbox"
import "dotenv/config"

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || ""
const SEPOLIA_RPC_URL =
    process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY"
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            // gasPrice: 130000000000,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 11155111,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
        },
        user: {
            default: 1,
        },
    },
    mocha: {
        timeout: 120000,
    },
    solidity: {
        compilers: [
            {
                version: "0.8.18",
            },
            {
                version: "0.4.24",
            },
        ],
    },
}

export default config
