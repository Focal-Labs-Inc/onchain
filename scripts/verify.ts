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
  // await hre.network.provider.send("hardhat_reset");

  const ROUTERADDRESS = metadata.router;
  const PLATFORM = accounts[1];
  const MARKETING = accounts[2];
  console.log("Verifying....");
  try {
    await hre.run("verify:verify", {
      address: '0x37Edd303Dd2B174522e22cd73D74D04eE267849a',
      constructorArguments: [
        ROUTERADDRESS,
        PLATFORM.address,
        MARKETING.address,
      ],
    });
  } catch {
    console.log("VERIFICATION FAILED!!!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

