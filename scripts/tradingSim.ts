import "hardhat-network-metadata";

import { ethers } from "hardhat";
import hre from "hardhat";

interface MyMetadata {
  router: string;
  networkName: string;
}
function tablify(trade: number, msg: string, value: string) {
  return { trade: trade, name: msg, uint256: value };
}
var table: Object[] = [];

async function main() {
  var metadata = hre.network.config.metadata as MyMetadata;
  const accounts = await hre.ethers.getSigners();
  console.log(`Running on '${metadata.networkName}'!`);
  // await hre.network.provider.send("hardhat_reset");

  const ROUTERADDRESS = metadata.router;
  const DEPLOYER = accounts[0];
  const PLATFORM = accounts[1];
  const MARKETING = accounts[2];
  const TRADER = accounts[3];
  const FP = await ethers.getContractFactory("FocalPoint");
  const fp = await FP.deploy(
    ROUTERADDRESS,
    PLATFORM.address,
    MARKETING.address
  );
  const TokenInstance = await fp.deployed();
  console.log("Focal deployed at: " + TokenInstance.address);
  console.log("Verifying....");
  try {
    await hre.run("verify:verify", {
      address: TokenInstance.address,
      constructorArguments: [
        ROUTERADDRESS,
        PLATFORM.address,
        MARKETING.address,
      ],
    });
  } catch {
    console.log("VERIFICATION FAILED!!!");
  }

  const SwapAbi = require("./../abis/Router.json");
  const router = new ethers.Contract(ROUTERADDRESS, SwapAbi);
  const DEPLOYER_ROUTER_SIGNER = router.connect(DEPLOYER);
  console.log(`Connected to router at ${ROUTERADDRESS}!`);

  var tokens = parseInt(
    ethers.utils.formatEther(await TokenInstance.balanceOf(DEPLOYER.address))
  );
  var supply = await (
    await TokenInstance.balanceOf(DEPLOYER.address)
  ).toString();
  console.log(`${tokens} available for liq, adding 4490000!`);
  await (await TokenInstance.approve(ROUTERADDRESS, supply)).wait();
  (
    await DEPLOYER_ROUTER_SIGNER.addLiquidityETH(
      TokenInstance.address,
      ethers.utils.parseEther("4490000"),
      0,
      0,
      DEPLOYER.address,
      Math.round(new Date().getTime() / 1000) + 1000,
      {
        value: ethers.utils.parseEther("400"),
      }
    )
  ).wait();
  console.log("Adding liquidity finished.");
  await (await TokenInstance.enableTrading()).wait();
  await (await TokenInstance.setSwapAndLiquifyEnabled(true)).wait();
  await (await TokenInstance.setMaxTransaction("10000000")).wait();
  console.log("Token setup finished.");

  console.log(`Trading with account: ${TRADER.address}`);
  const TRADER_ROUTER_SIGNER = router.connect(TRADER);
  const TRADER_TOKEN_SIGNER = TokenInstance.connect(TRADER);
  await (await TRADER_TOKEN_SIGNER.approve(ROUTERADDRESS, supply)).wait();
  const WETH = await TRADER_ROUTER_SIGNER.WETH();
  await (
    await TRADER_ROUTER_SIGNER.swapExactETHForTokens(
      0,
      [WETH, TokenInstance.address],
      TRADER.address,
      Math.round(new Date().getTime() / 1000) + 1000,
      {
        value: ethers.utils.parseEther("3"),
        gasLimit: 400000,
      }
    )
  ).wait();
  console.log("Initial BUY finished.");
  const TRADES = 1000;
  for (var x = 1; x <= TRADES; x++) {
    var buyCount = 1;
    var bal = await TokenInstance.balanceOf(TRADER.address);
    var buyOrSell = Math.random() < 0.3;
    if (buyOrSell == true) {
      buyCount+=1;
      console.log(
        `Executing BUY trade ${x}/${TRADES}... Token Balance: ${bal.toString()}`
      );
      await (
        await TRADER_ROUTER_SIGNER.swapExactETHForTokens(
          0,
          [WETH, TokenInstance.address],
          TRADER.address,
          Math.round(new Date().getTime() / 1000) + 1000,
          {
            value: ethers.utils.parseEther((0.1+(0.1*buyCount)).toString()),
            gasLimit: 400000,
          }
        )
      ).wait();
      table.push(
        tablify(
          x,
          `Contract Balance After BUY`,
          (
            await TRADER_TOKEN_SIGNER.balanceOf(TokenInstance.address)
          ).toString()
        )
      );
    } else {
      console.log(
        `Executing SELL trade ${x}/${TRADES}... Token Balance: ${bal.toString()}`
      );
      await (
        await TRADER_ROUTER_SIGNER.swapExactTokensForETHSupportingFeeOnTransferTokens(
          bal.div(8).toString(),
          0,
          [TokenInstance.address, WETH],
          TRADER.address,
          Math.round(new Date().getTime() / 1000) + 1000,
          {
            gasLimit: 500000,
          }
        )
      ).wait();
      table.push(
        tablify(
          x,
          `Contract Balance After SELL`,
          (
            await TRADER_TOKEN_SIGNER.balanceOf(TokenInstance.address)
          ).toString()
        )
      );
    }
    var platformFee = await TokenInstance.platformFee();
    var marketingFee = await TokenInstance.marketingFee();
    var liqFee = await TokenInstance.liquidityFee();
    table.push(
      tablify(
        x,
        `Contract tokens for Platform`,
        platformFee.tokensCollected.toString()
      )
    );
    table.push(
      tablify(
        x,
        `Contract tokens for Marketing`,
        marketingFee.tokensCollected.toString()
      )
    );
    table.push(
      tablify(
        x,
        `Contract tokens for Liquidity`,
        liqFee.tokensCollected.toString()
      )
    );
  }
  console.table(table);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  console.table(table);
  process.exitCode = 1;
});
