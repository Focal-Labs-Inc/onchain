import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import hre from "hardhat";

import { FocalPoint, FocalPoint__factory, Presale, Presale__factory} from "./../typechain-types";

interface MyMetadata {
  router: string;
  networkName: string;
}

describe("FocalPoint Presale", function () {
  let networkMetadata = hre.network.config.metadata as MyMetadata;

  let ROUTERADDRESS = networkMetadata.router;
  let FocalPointFactory: FocalPoint__factory;
  let FocalPoint: FocalPoint;

  let PresaleFactory: Presale__factory;
  let Presale: Presale;

  let DEPLOYER: SignerWithAddress;
  let dTokenOperator: FocalPoint;
  let dPresaleOperator: Presale;

  let PLATFORM: SignerWithAddress;
  let MARKETING: SignerWithAddress;
  let WHITELISTER: SignerWithAddress;
  let PRIVATESALER: SignerWithAddress;
  let NOBODY: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let wPresaleOperator: Presale; // WHITELISTER account connected to presale contract
  let pPresaleOperator: Presale; // PRIVATESALER account connected to presale contract
  let nPresaleOperator: Presale; // NOBODY account connected to presale contract
  
  beforeEach(async function () {
    [DEPLOYER, PLATFORM, MARKETING, WHITELISTER, PRIVATESALER, NOBODY, ...addrs] =
      await ethers.getSigners();
    FocalPointFactory = (await ethers.getContractFactory(
      "FocalPoint"
    )) as FocalPoint__factory;
    FocalPoint = await FocalPointFactory.deploy(
      ROUTERADDRESS,
      PLATFORM.address,
      MARKETING.address
    );
    PresaleFactory = (await ethers.getContractFactory(
      "Presale"
    )) as Presale__factory;
    Presale = await PresaleFactory.deploy();
    dTokenOperator = FocalPoint.connect(DEPLOYER);
    // approve max transfer to/from the router
    var supplyForPresale = '100'
    await (await dTokenOperator.transfer(Presale.address, ethers.utils.parseEther(supplyForPresale))).wait(); // transfer presale+private sale tokens
  });

  it("Should prevent contributions before start", async function() {});
  it("Should allow private sale withdraw 100% on close", async function() {});
  it("Should vest half of tokens on claim", async function() {});
  it("Should allow claim of vested tokens after 1 week", async function() {});
  it("Should prevent claim before close", async function() {});
  it("Should prevent contributions on close", async function() {});
  it("Should limit contributions to multiples of 0.1", async function() {});
  it("Should limit contributions to min 0.1 and max 2", async function() {});
  it("Should allocate correct amout of tokens", async function() {});
});
