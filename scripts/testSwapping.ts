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
        value: ethers.utils.parseEther("0.4"),
      }
    )
  ).wait();
  console.log("Adding liquidity finished.");
  await (await TokenInstance.enableTrading()).wait();
  await (await TokenInstance.setSwapAndLiquifyEnabled(true)).wait();
  console.log("Token setup finished.");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  console.table(table);
  process.exitCode = 1;
});
