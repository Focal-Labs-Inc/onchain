// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import hre from "hardhat";
import "hardhat-network-metadata";

interface MyMetadata {
  router: string;
  networkName: string;
}
async function main() {
  var metadata = hre.network.config.metadata as MyMetadata;
  console.log("Network name=", metadata.networkName);
  var network = metadata.networkName;
  console.log(`Deploying to '${network}'!`);
  const ROUTERADDRESS = metadata.router;
  const accounts = await hre.ethers.getSigners();
  // const DEPLOYER = accounts[0];
  const MARKETING = accounts[1];
  const PLATFORM = accounts[2];

  // We get the contract to deploy
  const FP = await ethers.getContractFactory("FocalPoint");
  const fp = await FP.deploy(
    ROUTERADDRESS,
    MARKETING.address,
    PLATFORM.address
  );

  await fp.deployed();

  console.log("FocalPoint deployed to:", fp.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
