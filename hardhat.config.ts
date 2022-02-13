import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";

import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-network-metadata";
import "solidity-coverage";
import "hardhat-gas-reporter";

import "./tasks/accounts.ts";
import "./tasks/deploy.ts";
import "./tasks/setupPresale.ts";
import "./tasks/finalizePresale.ts";
import "./tasks/launchToken.ts";

dotenv.config();


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    externalArtifacts: ['abis/*.json'],
  },
  networks: {
    mainnet: {
      metadata: {
        router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        networkName: "mainnet",
      },
      url: `https://bsc.getblock.io/mainnet/?api_key=${process.env.GETBLOCK_API_KEY}`,
    },
    testnet: {
      metadata: {
        router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
        networkName: "testnet",
      },
      gas: 5000000,
      gasPrice: 20000000000,

      accounts: {
        mnemonic:
         process.env.TESTNET_SEED
      },

      url: `https://bsc.getblock.io/testnet/?api_key=${process.env.GETBLOCK_API_KEY}`,
    },
    hardhat: {
      metadata: {
        router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        networkName: "forknet",
      },
      forking: {
        url: `https://bsc.getblock.io/mainnet/?api_key=${process.env.GETBLOCK_API_KEY}`,
      },
    },
  },
  etherscan: {
    apiKey: {
      // binance smart chain
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY
    },
  },
};

export default config;

