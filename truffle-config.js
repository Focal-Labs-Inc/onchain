var Web3 = require("web3");
const { mnemonic } = require('./secrets.json');
const HDWalletProvider = require('@truffle/hdwallet-provider');
module.exports = {
  compilers: {
    solc: {
      version: "0.8.11",
      // Can also be set to "native" to use a native solc
      docker: false, // Use a version obtained through docker
      parser: "solcjs", // Leverages solc-js purely for speedy parsing
      settings: {
        optimizer: {
          enabled: true,
          runs: 200, // Optimize for how many times you intend to run the code
        },
      },
    },
  },
  networks: {
    forknet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    testnet: {
      provider: () => new HDWalletProvider(
        mnemonic, "https://bsc.getblock.io/testnet/?api_key=ca849af4-9686-4934-beec-ec61ef23118b"
      ),
      port: 443,
      network_id: "97",
    },
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: 'MY_API_KEY',
    bscscan: 'KK2YI5PJ3P5RN4WAEBBVGY1YYWHGVCBPQU',
    hecoinfo: 'MY_API_KEY',
    ftmscan: 'MY_API_KEY'
  }
};
