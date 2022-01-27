import "hardhat-network-metadata";

import { ethers } from "hardhat";
import hre from "hardhat";

interface MyMetadata {
  router: string;
  networkName: string;
}
async function main() {
  var metadata = hre.network.config.metadata as MyMetadata;
  const accounts = await hre.ethers.getSigners();
  console.log(`Running on '${metadata.networkName}'!`);

  const ROUTERADDRESS = metadata.router;
  const DEPLOYER = accounts[0];
  const MARKETING = accounts[1];
  const PLATFORM = accounts[2];
  const TRADER = accounts[3];

  const FP = await ethers.getContractFactory("FocalPoint");
  const fp = await FP.deploy(
    ROUTERADDRESS,
    MARKETING.address,
    PLATFORM.address
  );
  const TokenInstance = await fp.deployed();
  console.log("Focal at: " + TokenInstance.address);

  const SwapAbi = require("./../abis/Router.json");
  const router = new ethers.Contract(ROUTERADDRESS, SwapAbi);
  const DEPLOYER_ROUTER_SIGNER = router.connect(DEPLOYER);
  console.log(`Connected to router at ${ROUTERADDRESS}!`);

  var tokens = parseInt(
    ethers.utils.formatEther(await TokenInstance.balanceOf(DEPLOYER.address))
  );
  var tokensForLiq = ethers.utils.parseEther((tokens * 0.686).toString());
  var supply = (await TokenInstance.balanceOf(DEPLOYER.address)).toString();
  console.log(`${supply} available for liq, adding ${tokensForLiq.toString()}`);
  await TokenInstance.approve(ROUTERADDRESS, supply);

  await DEPLOYER_ROUTER_SIGNER.addLiquidityETH(
    TokenInstance.address,
    tokensForLiq,
    0,
    0,
    DEPLOYER.address,
    Math.round(new Date().getTime() / 1000) + 1000,
    {
      value: ethers.utils.parseEther("0.4"),
    }
  );
  console.log("Adding liquidity finished.");
  await TokenInstance.enableTrading();
  await TokenInstance.setSwapAndLiquifyEnabled(true);
  console.log("Token setup finished.");

  console.log(`Trading with account: ${TRADER.address}`);
  const TRADER_ROUTER_SIGNER = router.connect(TRADER);
  const TRADER_TOKEN_SIGNER = TokenInstance.connect(TRADER);
  await TRADER_TOKEN_SIGNER.approve(ROUTERADDRESS, supply);
  const WETH = await TRADER_ROUTER_SIGNER.WETH();
  for (var x = 1; x <= 10; x++) {
    var bal = (await TokenInstance.balanceOf(TRADER.address)).toString();
    console.log(`Executing trade ${x}/10... Token Balance: ${bal}`);

    await TRADER_ROUTER_SIGNER.swapExactETHForTokens(
      0,
      [WETH, TokenInstance.address],
      TRADER.address,
      Math.round(new Date().getTime() / 1000) + 1000,
      {
        value: ethers.utils.parseEther("0.001"),
      }
    );
    console.log(
      `Contract Token Balance: ${(
        await TRADER_TOKEN_SIGNER.balanceOf(TokenInstance.address)
      ).toString()}`
    );
  }

  console.log("Preparing to sell to trigger swapandliquify");
  console.log(
    `Contract Token Balance before sell: ${(
      await TokenInstance.balanceOf(TokenInstance.address)
    ).toString()}`
  );
  var sellRes =
    await TRADER_ROUTER_SIGNER.swapExactTokensForETHSupportingFeeOnTransferTokens(
      "2000000000000000000000",
      0,
      [TokenInstance.address, WETH],
      TRADER.address,
      Math.round(new Date().getTime() / 1000) + 1000
    );
  console.log(
    `Contract Token Balance after sell: ${(
      await TRADER_TOKEN_SIGNER.balanceOf(TokenInstance.address)
    ).toString()}`
  );

  var receipt = await ethers.provider.getTransactionReceipt(sellRes.hash);
  var index = 0;
  for (var l of receipt.logs) {
    console.log(`\nTopics for receipt at index ${index}: ${l.topics}`);
    try {
      console.log(router.interface.parseLog(l));
    } catch {
      console.log("failed to parse logs\n\n");
    }
    if (
      l.topics[0] ==
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    ) {
      console.log(l.data.toString() + "\n\n");
    }
    index++;
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
