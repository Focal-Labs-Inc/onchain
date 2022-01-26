const TokenContract = artifacts.require("./../contracts/token/FocalPoint.sol");

const contract = require("@truffle/contract");
const Web3 = require("web3");
module.exports = async function (deployer, network, accounts) {
  if (network == "forknet") {
    var ROUTERADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    var provider = new Web3.providers.HttpProvider("http://localhost:8545");
  } else if (network == "testnet") {
    var ROUTERADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
    var provider = new Web3.providers.HttpProvider(
      "https://data-seed-prebsc-2-s3.binance.org:8545/"
    );
  } else {
    console.log(`Network ${network} not supported!`);
    return;
  }
  var DEPLOYER = accounts[0];
  var MARKETING = accounts[1];
  var PLATFORM = accounts[2];

  const TokenInstance = await TokenContract.deployed();
  console.log("Focal at: " + TokenInstance.address);
  await new Promise((r) => setTimeout(r, 2000));

  const SwapAbi = require("./../abis/Router.json");
  const RouterContract = contract({ abi: SwapAbi, address: ROUTERADDRESS });
  RouterContract.setProvider(provider);
  const RouterInstance = await RouterContract.at(ROUTERADDRESS);
  console.log(`Connected to router at ${ROUTERADDRESS}!`);

  await TokenInstance.approve(
    ROUTERADDRESS,
    this.web3.utils.toWei("100000000", "ether"),
    {
      from: DEPLOYER,
      gas: 4000000,
    }
  );

  var tokens = this.web3.utils.fromWei(
    (await TokenInstance.balanceOf(DEPLOYER)).toString(),
    "ether"
  );
  var tokensForLiq = this.web3.utils.toWei((tokens * 0.686).toString(), "ether");
  console.log(`${tokens.toString()} available for liq, adding ${tokensForLiq.toString()}`);
  // not working?? Nothing happens...
  var x = await RouterInstance.addLiquidityETH(
    TokenInstance.address,
    tokensForLiq,
    0,
    0,
    DEPLOYER,
    1645279988,
    {
      value: 400000000000000000,
      gas: 5000000,
    }
  );
  console.log(`adding liquidity: ${x}`);
};
