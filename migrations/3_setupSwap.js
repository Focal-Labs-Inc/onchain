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
  var TRADER = accounts[3];

  const TokenInstance = await TokenContract.deployed();
  console.log("Focal at: " + TokenInstance.address);
  await new Promise((r) => setTimeout(r, 2000));

  const SwapAbi = require("./../abis/Router.json");
  const RouterContract = contract({ abi: SwapAbi, address: ROUTERADDRESS });
  RouterContract.setProvider(provider);
  const RouterInstance = await RouterContract.at(ROUTERADDRESS);
  console.log(`Connected to router at ${ROUTERADDRESS}!`);

  var tokens = this.web3.utils.fromWei(
    (await TokenInstance.balanceOf(DEPLOYER)).toString(),
    "ether"
  );
  var tokensForLiq = this.web3.utils.toWei(
    (tokens * 0.686).toString(),
    "ether"
  );
  var supply = (await TokenInstance.balanceOf(DEPLOYER)).toString();
  console.log(`${supply} available for liq, adding ${tokensForLiq.toString()}`);
  await TokenInstance.approve(ROUTERADDRESS, supply, {
    from: DEPLOYER,
    gas: 4000000,
  });
  // not working?? Nothing happens...
  await RouterInstance.addLiquidityETH(
    TokenInstance.address,
    tokensForLiq,
    0,
    0,
    DEPLOYER,
    Math.round(new Date().getTime() / 1000) + 1000,
    {
      from: DEPLOYER,
      value: this.web3.utils.toWei("0.4", "ether"),
      gas: 5000000,
    }
  );
  console.log("Adding liquidity finished.");
  await TokenInstance.enableTrading();
  await TokenInstance.setSwapAndLiquifyEnabled(true);
  console.log("Token setup finished.");

  console.log(`Trading with account: ${TRADER}`);
  await TokenInstance.approve(ROUTERADDRESS, supply, { from: TRADER });
  for (var x = 0; x < 10; x++) {
    console.log(
      `Executing trade ${x}/10... Token Balance: ${(
        await TokenInstance.balanceOf(TRADER)
      ).toString()}`
    );
    await RouterInstance.swapExactETHForTokens(
      0,
      [await RouterInstance.WETH(), TokenInstance.address],
      TRADER,
      Math.round(new Date().getTime() / 1000) + 1000,
      {
        from: TRADER,
        value: this.web3.utils.toWei("0.001", "ether"),
        gas: 5000000,
      }
    );
    console.log(
      `Contract Token Balance: ${(
        await TokenInstance.balanceOf(TokenInstance.address)
      ).toString()}`
    );
  }

  console.log("Preparing to sell to trigger swapandliquify");
  console.log(
    `Contract Token Balance before sell: ${(
      await TokenInstance.balanceOf(TokenInstance.address)
    ).toString()}`
  );
  var sellRes = await RouterInstance.swapExactTokensForETHSupportingFeeOnTransferTokens(
    "2000000000000000000000",
    0,
    [TokenInstance.address, await RouterInstance.WETH()],
    TRADER,
    Math.round(new Date().getTime() / 1000) + 1000,
    {
      from: TRADER,
      gas: 5000000,
    }
  );
  console.log(
    `Contract Token Balance after sell: ${(
      await TokenInstance.balanceOf(TokenInstance.address)
    ).toString()}`
  );

  console.log(sellRes.receipt.rawLogs);
};
