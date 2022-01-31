import chai, { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { FocalPoint, FocalPoint__factory } from "./../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface MyMetadata {
  router: string;
  networkName: string;
}
describe("FocalPoint", function () {
  let networkMetadata = hre.network.config.metadata as MyMetadata;
  let FocalPointFactory: FocalPoint__factory;
  let FocalPoint: FocalPoint;

  let ROUTERADDRESS = networkMetadata.router;
  let RouterAbi = require("./../abis/Router.json");
  let Router;

  let DEPLOYER: SignerWithAddress;
  let dTokenOperator: FocalPoint;
  let dRouterOperator;

  let PLATFORM: SignerWithAddress;
  let MARKETING: SignerWithAddress;
  let TRADER: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let tTokenOperator: FocalPoint;
  let tRouterOperator;

  before(async function () {
    [DEPLOYER, PLATFORM, MARKETING, TRADER, ...addrs] =
      await ethers.getSigners();
    RouterAbi = require("./../abis/Router.json");
    Router = new ethers.Contract(ROUTERADDRESS, RouterAbi);
    console.log(`Connected to router at ${ROUTERADDRESS}!`);

    dRouterOperator = Router.connect(DEPLOYER);
    tRouterOperator = Router.connect(TRADER);
  });

  beforeEach(async function () {
    [DEPLOYER, PLATFORM, MARKETING, TRADER, ...addrs] =
      await ethers.getSigners();
    FocalPointFactory = (await ethers.getContractFactory(
      "FocalPoint"
    )) as FocalPoint__factory;
    FocalPoint = await FocalPointFactory.deploy(
      ROUTERADDRESS,
      PLATFORM.address,
      MARKETING.address
    );
    dTokenOperator = FocalPoint.connect(DEPLOYER);
    tTokenOperator = FocalPoint.connect(TRADER);
  });

  it("Should allow trading between non-DEX accounts", async function () {
    await expect(
      dTokenOperator.transfer(TRADER.address, "50000000000000000000")
    )
      .to.emit(FocalPoint.address, "Transfer")
      .withArgs(DEPLOYER.address, TRADER.address, "50000000000000000000");

    // expect(await FocalPoint.balanceOf(TRADER.address)).to.equal(
    //   "50000000000000000000"
    // );
    // expect(await FocalPoint.balanceOf(DEPLOYER.address)).to.equal(
    //   "14999950000000000000000000"
    // );

    // expect(await tTokenOperator.transfer(addrs[0].address, "50000000000000000000"))
    //   .to.emit(FocalPoint.address, "Transfer")
    //   .withArgs(TRADER.address, addrs[0].address, "50000000000000000000");
    
    // expect(await FocalPoint.balanceOf(TRADER.address)).to.equal(
    //   "0"
    // );
  });
});
