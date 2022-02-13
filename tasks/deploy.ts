// ensures that SAFE_DEPLOY exists

// this task should
// 1. ensure the orchestrator is connected
// 2. refuse to run if its on the mainnet and a SAFE_DEPLOY file doesn't exist
// 2. deploy the FOCAL contract and ensure the address is correct
// |-- needs to ensure the proper platform address is set and marketing and liquidity fee
// 3. send 20% of FOCAL to the team wallet, 5% to the marketing wallet
// 4. deploy the presale contract and send presale+privatesale tokens to it (6760000 tokens)
// 5. transfer the remaining coins to the OPERATOR wallet and then transferOwnership of both contracts
// 6. if on forknet write SAFE_DEPLOY file on success. Each step should assert to prove it was correct
// 7. verify the contract on BSCSCAN
//
import assert from "assert";
import * as dotenv from "dotenv";
import { BigNumber, ethers, Wallet } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NetworkMetadata } from "./../lib";
import {
  FocalPoint,
  FocalPoint__factory,
  Presale,
  Presale__factory,
} from "./../typechain-types";
import * as fs from 'fs';
dotenv.config();
const ORCHESTRATOR_KEY = process.env.ORCHESTRATOR_PRIVATE_KEY!;
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!;
const MARKETING_ADDRESS = process.env.MARKETING_ADDRESS!;
const TEAM_ADDRESS = process.env.TEAM_ADDRESS!;
const OPERATOR_ADDRESS = process.env.OPERATOR_ADDRESS!;

if (
  ORCHESTRATOR_KEY == undefined ||
  PLATFORM_ADDRESS == undefined ||
  MARKETING_ADDRESS == undefined ||
  TEAM_ADDRESS == undefined ||
  OPERATOR_ADDRESS == undefined
) {
  console.log("Undefined env var!");
  process.exit(1);
}

async function deployPresale(
  deployerAccount: Wallet,
  hre: HardhatRuntimeEnvironment
): Promise<Presale> {
  let PresaleFactory: Presale__factory;
  let FocalPresale: Presale;

  console.log(`address of orchestrator: ${deployerAccount.address}`);
  console.log(`balance: ${await deployerAccount.getBalance()}`);
  PresaleFactory = (await hre.ethers.getContractFactory(
    "Presale",
    deployerAccount
  )) as Presale__factory;
  FocalPresale = await PresaleFactory.deploy();
  console.log(`address of Focal Presale: ${FocalPresale.address}`);
  return FocalPresale;
}

async function deployToken(
  deployerAccount: Wallet,
  metadata: NetworkMetadata,
  hre: HardhatRuntimeEnvironment
): Promise<FocalPoint> {
  let FocalPointFactory: FocalPoint__factory;
  let FocalPoint: FocalPoint;

  console.log(`address of orchestrator: ${deployerAccount.address}`);
  console.log(`balance: ${await deployerAccount.getBalance()}`);
  FocalPointFactory = (await hre.ethers.getContractFactory(
    "FocalPoint",
    deployerAccount
  )) as FocalPoint__factory;
  FocalPoint = await FocalPointFactory.deploy(
    metadata.router,
    PLATFORM_ADDRESS,
    MARKETING_ADDRESS
  );
  console.log(`address of Focal Point: ${FocalPoint.address}`);
  assert.equal(
    FocalPoint.address,
    "0xF0ca100000e47A0dd2087C81EC910B0BDe6Ad6f5"
  );
  return FocalPoint;
}

async function distributeTokens(
  deployerAccount: Wallet,
  tokenInstance: FocalPoint,
  presaleInstance: Presale,
) {
  var supply = (
    await tokenInstance.balanceOf(deployerAccount.address)
  ).toString();
  let teamTokens = BigNumber.from(supply).div(5).toString();
  let marketingTokens = BigNumber.from(supply).div(20).toString();
  let presaleContractTokens = ethers.utils.parseEther("6760000");
  let liquidityTokens = ethers.utils.parseEther("4490000");
  console.log("Focal Point deployed, distributing tokens");
  console.log(
    `Total supply and initial balance: ${supply}` +
      `\n> sending 20% (${teamTokens}) to team wallet` +
      `\n> sending 5% (${marketingTokens}) to marketing wallet` +
      `\n> sending presale+private sale tokens (${presaleContractTokens}) to presale contract`
  );

  await tokenInstance.transfer(TEAM_ADDRESS, teamTokens);
  await tokenInstance.transfer(MARKETING_ADDRESS, marketingTokens);
  await tokenInstance.transfer(presaleInstance.address, presaleContractTokens);

  assert.equal(
    (await tokenInstance.balanceOf(TEAM_ADDRESS)).toString(),
    teamTokens
  );
  assert.equal(
    (await tokenInstance.balanceOf(MARKETING_ADDRESS)).toString(),
    marketingTokens
  );
  assert.equal(
    (await tokenInstance.balanceOf(presaleInstance.address)).toString(),
    presaleContractTokens
  );
  assert.equal(
    (await tokenInstance.balanceOf(deployerAccount.address)).toString(),
    liquidityTokens
  );

  console.log(
    `Tokens distributed, sending remainder (${liquidityTokens}) to OPERATOR for launch`
  );
  await tokenInstance.transfer(OPERATOR_ADDRESS, liquidityTokens);
  assert.equal(
    (await tokenInstance.balanceOf(OPERATOR_ADDRESS)).toString(),
    liquidityTokens
  );
}

task(
  "deploy",
  "Deploys Focal contracts and sets them up for launch",
  async (taskArgs, hre) => {
    var metadata = hre.network.config.metadata as NetworkMetadata;

    if (metadata.networkName == "mainnet") {
      console.log("!!!! Running on MAINNET !!!!");
      var path = require("path");

      path.exists("./SAFE_DEPLOY", function (exists: boolean) {
        if (!exists) {
          console.log(
            "File SAFE_DEPLOY does not exist! Please run on the forknet first!"
          );
        }
      });
    }

    const wallet = new hre.ethers.Wallet(ORCHESTRATOR_KEY);
    const provider = hre.waffle.provider;
    const ORCHESTRATOR_ACCOUNT = wallet.connect(provider);

    const FocalPoint = await deployToken(ORCHESTRATOR_ACCOUNT, metadata, hre);
    const FocalPresale = await deployPresale(ORCHESTRATOR_ACCOUNT, hre);
    await distributeTokens(ORCHESTRATOR_ACCOUNT, FocalPoint, FocalPresale);

    console.log(
      "Deployment success, transfering ownership to operator and verifying FocalPoint"
    );
    await FocalPoint.transferOwnership(OPERATOR_ADDRESS);
    await FocalPresale.transferOwnership(OPERATOR_ADDRESS);
    console.log("Verifying....");
    try {
      await hre.run("verify:verify", {
        address: FocalPoint.address,
        constructorArguments: [
          metadata.router,
          PLATFORM_ADDRESS,
          MARKETING_ADDRESS,
        ],
      });
    } catch {
      console.log("VERIFICATION FAILED!!!");
    }
    if (metadata.networkName == "forknet") {
      console.log("!!!! Finished test run on forknet successfully !!!!");
      fs.writeFileSync('./SAFE_DEPLOY','0');
    }
  }
);
