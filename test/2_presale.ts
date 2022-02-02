import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { ethers, waffle } from "hardhat";
import hre from "hardhat";

import {
  FocalPoint,
  FocalPoint__factory,
  Presale,
  Presale__factory,
} from "./../typechain-types";

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
    [
      DEPLOYER,
      PLATFORM,
      MARKETING,
      WHITELISTER,
      PRIVATESALER,
      NOBODY,
      ...addrs
    ] = await ethers.getSigners();
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
    dPresaleOperator = Presale.connect(DEPLOYER);
    wPresaleOperator = Presale.connect(WHITELISTER);
    pPresaleOperator = Presale.connect(PRIVATESALER);
    nPresaleOperator = Presale.connect(NOBODY);

    var supplyForPresale = "6760000"; // 11225*hardcap + private sale (13500*85)
    await (
      await dTokenOperator.transfer(
        Presale.address,
        ethers.utils.parseEther(supplyForPresale)
      )
    ).wait(); // transfer presale+private sale tokens

    // initialize private sale and whitelisters
    await (
      await dPresaleOperator.addWhitelisters([WHITELISTER.address])
    ).wait();
    await (
      await dPresaleOperator.addPrivatesalers(
        [PRIVATESALER.address],
        [ethers.utils.parseEther("13500")]
      )
    ).wait();

    // set token address
    await (await dPresaleOperator.setToken(FocalPoint.address)).wait();
  });

  it("Should start the presale for whitelisters", async function () {
    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.be.reverted;

    await (await dPresaleOperator.open()).wait();

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.not.be.reverted;

    assert(
      (await wPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("1122.5").toString()
    );
  });

  it("Should allow private sale claim 100% on close", async function () {
    await (await dPresaleOperator.open()).wait(); // open the sale then close it
    await (await dPresaleOperator.finalize()).wait();

    await expect(pPresaleOperator.claimTokens())
      .to.emit(Presale, "PrivateSaleClaimed")
      .withArgs(PRIVATESALER.address, ethers.utils.parseEther("13500"))
      .to.emit(FocalPoint, "Transfer")
      .withArgs(
        Presale.address,
        PRIVATESALER.address,
        ethers.utils.parseEther("13500")
      );
  });

  it("Should allow claim of vested tokens after 1 week", async function () {
    await (await dPresaleOperator.open()).wait();

    // buy 1122.5 tokens
    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.not.be.reverted;
    assert(
      (await wPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("1122.5").toString()
    );

    await (await dPresaleOperator.finalize()).wait();

    // initial claim is half
    await expect(wPresaleOperator.claimTokens())
      .to.emit(Presale, "TokensClaimed")
      .withArgs(WHITELISTER.address, ethers.utils.parseEther("561.25"));

    // we can't claim the rest yet
    await expect(wPresaleOperator.claimTokens()).to.be.revertedWith(
      "Cannot claim vested tokens yet"
    );

    // wait a week and a bit to ensure the next claim works (86400*7)
    let startTime = await dPresaleOperator.claimStart();
    await ethers.provider.send("evm_mine", [
      startTime.toNumber() + 86400 * 7 + 30,
    ]);

    assert(
      (await wPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("561.25").toString()
    );

    // claim the vested tokens
    await expect(wPresaleOperator.claimTokens())
      .to.emit(Presale, "TokensClaimed")
      .withArgs(WHITELISTER.address, ethers.utils.parseEther("561.25"));

    // ensure we can't claim anymore
    await expect(wPresaleOperator.claimTokens()).to.be.revertedWith(
      "User should have unclaimed FOCAL tokens"
    );
  });

  it("Should prevent buying more than the max tokens", async function () {
    await (await dPresaleOperator.open()).wait();

    // buy 22450 tokens
    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("2"),
      })
    ).to.not.be.reverted;

    assert(
      (await wPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("22450").toString()
    );

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.be.revertedWith("Can't buy more than 2 BNB worth of tokens");

    // verify our owned tokens didn't change
    assert(
      (await wPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("22450").toString()
    );
  });

  it("Should allow anyone to contribute after whitelist period", async function () {
    await expect(
      nPresaleOperator.buy(NOBODY.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.be.reverted;

    await (await dPresaleOperator.open()).wait();

    await expect(
      nPresaleOperator.buy(NOBODY.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.be.revertedWith("You are not whitelisted");

    // wait 30 minutes for the whitelist to close
    let startTime = await dPresaleOperator.timestampStarted();
    await ethers.provider.send("evm_mine", [
      startTime.toNumber() + 60 * 30 + 30,
    ]);

    await expect(
      nPresaleOperator.buy(NOBODY.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.not.be.reverted;

    assert(
      (await nPresaleOperator.ownedTokens()).toString() ==
        ethers.utils.parseEther("1122.5").toString()
    );
  });

  it("Should prevent claim before close", async function () {
    await (await dPresaleOperator.open()).wait();

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.not.be.reverted;

    await expect(wPresaleOperator.claimTokens()).to.be.revertedWith(
      "Claiming tokens not yet enabled."
    );
  });

  it("Should prevent contributions on close", async function () {
    await (await dPresaleOperator.open()).wait();
    await (await dPresaleOperator.finalize()).wait();

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.1"),
      })
    ).to.be.revertedWith("Sale is over");
  });

  it("Should limit contributions to multiples of 0.1", async function () {
    await (await dPresaleOperator.open()).wait();

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.11"),
      })
    ).to.be.revertedWith("BNB is not a multiple of 0.1");
  });

  it("Should limit contributions to min 0.1 and max 2", async function () {
    await (await dPresaleOperator.open()).wait();

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("0.01"),
      })
    ).to.be.revertedWith("BNB is lesser than min value");

    await expect(
      wPresaleOperator.buy(WHITELISTER.address, {
        value: ethers.utils.parseEther("2.1"),
      })
    ).to.be.revertedWith("BNB is greater than max value");
  });
});
