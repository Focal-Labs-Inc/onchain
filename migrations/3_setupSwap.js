const Web3 = require("web3");
const TokenContract = artifacts.require("./../contracts/token/FocalPoint.sol");

const contract = require("@truffle/contract");
var provider = new Web3.providers.HttpProvider(
  "https://data-seed-prebsc-2-s3.binance.org:8545/"
);

module.exports = async function (deployer, network, accounts) {
  if (network != "testnet") {
    return;
  }

  var DEPLOYER = accounts[0];
  var MARKETING = accounts[1];
  var PLATFORM = accounts[2];
  const TokenInstance = await TokenContract.deployed();
  console.log("Focal at: " + TokenInstance.address);

  var ROUTERADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  const SwapAbi = require("./../abis/Router.json");
  const RouterInstance = new this.web3.eth.Contract(SwapAbi, ROUTERADDRESS);
  RouterInstance.setProvider(provider);

  await TokenInstance.approve(
    ROUTERADDRESS,
    Web3.utils.toWei("100000000", "ether"),
    {
      from: DEPLOYER,
      gas: 4000000,
    }
  );

  var liqTokens = web3.utils.fromWei(
    (await TokenInstance.balanceOf(DEPLOYER)).toString(),
    "ether"
  );
  console.log(`${liqTokens.toString()} available for liq`);

  // not working?? Nothing happens...
  RouterInstance.methods
    .addLiquidityETH(
      TokenInstance.address,
      web3.utils.toWei((liqTokens * 0.686).toString(), "ether"),
      0,
      0,
      DEPLOYER,
      Math.floor(Date.now() / 1000) + 60
    )
    .call({
      value: web3.utils.toWei("1", "ether"),
      from: DEPLOYER,
      gas: 4000000,
    })
    .then(function (status) {
      if (status) {
        console.log("adding liquidity worked");
        return status;
      }
    })
    .catch(function (error) {
      console.log(error);
      return "transfer.service error";
    });
};
