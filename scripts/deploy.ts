// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  console.log("Network name=", hre.network.config);
  var network = process.env.HARDHAT_NETWORK;
  if (network == 'testnet') {
    var ROUTERADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  } else if (network== "hardhat") {
    var ROUTERADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  } else {
    console.log(`Network '${network}' not supported!`);
    return;
  }
  const accounts = await hre.ethers.getSigners();
  // const DEPLOYER = accounts[0];
  const MARKETING = accounts[1];
  const PLATFORM = accounts[2];

  const FP = await ethers.getContractFactory("FocalPoint");
  const fp = await FP.deploy(ROUTERADDRESS, MARKETING, PLATFORM);

  await fp.deployed();

  console.log("FocalPoint deployed to:", fp.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
