import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { assert, expect } from "chai";
import { ethers, waffle } from "hardhat";
import hre from "hardhat";

import { FocalPoint, FocalPoint__factory, Router } from "./../typechain-types";

chai.config.includeStack = true;
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
  let Factory: Router;
  let FACTORYADDRESS;
  let WETH: string;
  let pairAddress: string;

  let DEPLOYER: SignerWithAddress;
  let dTokenOperator: FocalPoint;
  let dRouterOperator: Router;
  let dFactoryOperator: Router;

  let PLATFORM: SignerWithAddress;
  let MARKETING: SignerWithAddress;
  let TRADER: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let tTokenOperator: FocalPoint;
  let tRouterOperator: Router;

  async function addLiquidity() {
    await (
      await dRouterOperator.addLiquidityETH(
        FocalPoint.address,
        "4490000000000000000000000",
        0,
        0,
        DEPLOYER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("400"),
        }
      )
    ).wait();
  }

  before(async function () {
    [DEPLOYER, PLATFORM, MARKETING, TRADER, ...addrs] =
      await ethers.getSigners();
    RouterAbi = require("./../abis/Router.json");
    Router = new ethers.Contract(ROUTERADDRESS, RouterAbi) as Router;
    console.log(`Connected to router at ${ROUTERADDRESS}!`);

    dRouterOperator = Router.connect(DEPLOYER);
    tRouterOperator = Router.connect(TRADER);
    WETH = await dRouterOperator.WETH();
    FACTORYADDRESS = await dRouterOperator.factory();
    Factory = new ethers.Contract(FACTORYADDRESS, RouterAbi) as Router;
    console.log(`Connected to factory at ${FACTORYADDRESS}!`);
    dFactoryOperator = Factory.connect(DEPLOYER);
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
    // approve max transfer to/from the router
    var supply = (await FocalPoint.balanceOf(DEPLOYER.address)).toString();
    await (await dTokenOperator.approve(ROUTERADDRESS, supply)).wait();
    await (await tTokenOperator.approve(ROUTERADDRESS, supply)).wait();
    pairAddress = await dFactoryOperator.getPair(WETH, FocalPoint.address);
  });

  it("Should allow transfering between non-DEX accounts", async function () {
    expect(
      await dTokenOperator.transfer(TRADER.address, "50000000000000000000")
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(DEPLOYER.address, TRADER.address, "50000000000000000000");

    expect(await FocalPoint.balanceOf(TRADER.address)).to.equal(
      "50000000000000000000"
    );
    expect(await FocalPoint.balanceOf(DEPLOYER.address)).to.equal(
      "14999950000000000000000000"
    );

    expect(
      await tTokenOperator.transfer(addrs[0].address, "50000000000000000000")
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, addrs[0].address, "50000000000000000000");

    expect(await FocalPoint.balanceOf(TRADER.address)).to.equal("0");
  });

  it("Should allow trading when fees are 0", async function () {
    await addLiquidity();
    await (await dTokenOperator.enableTrading()).wait();
    await (await dTokenOperator.setBuyFees(0, 0, 0)).wait();

    let buyAmount: any = ethers.utils.parseEther("37500");
    await expect(
      tRouterOperator.swapETHForExactTokens(
        buyAmount,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("3.5"), // ~ 375000/11225 with slippage
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, TRADER.address, buyAmount);
    expect(await FocalPoint.balanceOf(TRADER.address)).to.equal(buyAmount);
  });

  it("Should allow deployer to add liquidity", async function () {
    await expect(
      dRouterOperator.addLiquidityETH(
        FocalPoint.address,
        "4490000000000000000000000",
        0,
        0,
        DEPLOYER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("400"),
        }
      )
    ).to.be.not.reverted;
  });

  it("Should only allow trading after enabled", async function () {
    await addLiquidity();
    await expect(
      tRouterOperator.swapExactETHForTokens(
        0,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("0.1"),
        }
      )
    ).to.be.reverted;

    await (await dTokenOperator.enableTrading()).wait();

    await expect(
      tRouterOperator.swapExactETHForTokens(
        0,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("0.1"),
        }
      )
    ).to.be.not.reverted;
  });

  it("Should only allow trading below max transaction amount", async function () {
    await addLiquidity();
    await (await dTokenOperator.enableTrading()).wait();

    // try to buy 1 coin over the max
    await expect(
      tRouterOperator.swapETHForExactTokens(
        ethers.utils.parseEther("75001"),
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("7"), // ~ 75000/11225 with slippage
        }
      )
    ).to.be.revertedWith("Pancake: TRANSFER_FAILED");
  });

  it("Should only change non-zero'd fee addresses", async function () {
    let zero = "0x0000000000000000000000000000000000000000";
    let cachedAddress = {
      platform: (await FocalPoint.platformFee()).beneficiary,
      marketing: (await FocalPoint.marketingFee()).beneficiary,
      liquidity: (await FocalPoint.liquidityFee()).beneficiary,
    };

    await expect(dTokenOperator.setFeeAddresses(addrs[0].address, zero, zero))
      .to.emit(FocalPoint, "UpdatePlatformInfo")
      .withArgs(2, 12, addrs[0].address);
    assert(
      (await FocalPoint.marketingFee()).beneficiary == cachedAddress.marketing
    );
    assert(
      (await FocalPoint.liquidityFee()).beneficiary == cachedAddress.liquidity
    );

    await expect(dTokenOperator.setFeeAddresses(zero, addrs[0].address, zero))
      .to.emit(FocalPoint, "UpdateMarketingInfo")
      .withArgs(2, 4, addrs[0].address);
    assert((await FocalPoint.platformFee()).beneficiary == addrs[0].address);
    assert(
      (await FocalPoint.liquidityFee()).beneficiary == cachedAddress.liquidity
    );

    await expect(dTokenOperator.setFeeAddresses(zero, zero, addrs[0].address))
      .to.emit(FocalPoint, "UpdateLiquidityInfo")
      .withArgs(2, 4, addrs[0].address);
    assert((await FocalPoint.platformFee()).beneficiary == addrs[0].address);
    assert((await FocalPoint.marketingFee()).beneficiary == addrs[0].address);
    assert((await FocalPoint.liquidityFee()).beneficiary == addrs[0].address);
  });

  it("Should adjust minSwapTokens", async function () {
    await addLiquidity();
    await (await dTokenOperator.enableTrading()).wait();
    await (await dTokenOperator.setSwapAndLiquifyEnabled(true)).wait();

    // set sell tax to zero to ensure sells don't mess balances up
    await (await dTokenOperator.setSellFees(0, 0, 0)).wait();
    await expect(dTokenOperator.setMinSwapTokens("10000")).to.not.be.reverted;

    // buy enough tokens to trigger the original value of minSwapTokens
    await (await dTokenOperator.setBuyFees(20, 0, 0)).wait();
    let buyAmount: any = ethers.utils.parseEther("37500");
    let expectedBuyFeeAmount: any = ethers.utils.parseEther("7500"); // 37500 * 0.2
    await expect(
      tRouterOperator.swapETHForExactTokens(
        buyAmount,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("7"),
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, TRADER.address, buyAmount) // amount you bought
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, FocalPoint.address, expectedBuyFeeAmount); // taxes taken

    // sell and confirm liquify did NOT happen
    await expect(
      tRouterOperator.swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("1"),
        0,
        [FocalPoint.address, WETH],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, pairAddress, ethers.utils.parseEther("1"));
    let contractBalance = await FocalPoint.balanceOf(FocalPoint.address);
    assert(contractBalance.toString() === expectedBuyFeeAmount.toString());

    // buy enough tokens to trigger the new minSwapTokens and distribute
    // 7500+2500 = 10000
    await (await dTokenOperator.setBuyFees(20, 0, 0)).wait();
    buyAmount = ethers.utils.parseEther("12500");
    expectedBuyFeeAmount = ethers.utils.parseEther("2500"); // 12500 * 0.2
    await expect(
      tRouterOperator.swapETHForExactTokens(
        buyAmount,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("7"),
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, TRADER.address, buyAmount) // amount you bought
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, FocalPoint.address, expectedBuyFeeAmount); // taxes taken

    // trigger distribute and validate that tokens get sold by the contract
    await expect(
      tRouterOperator.swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("1"),
        0,
        [FocalPoint.address, WETH],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, pairAddress, ethers.utils.parseEther("1"))
      .to.emit(FocalPoint, "Transfer")
      .withArgs(
        FocalPoint.address,
        pairAddress,
        ethers.utils.parseEther("10000")
      ); // fee tokens sold and sent return native the
    // platform addy
  });

  it("Should prevent decreasing max transaction to below 75000", async function () {
    await expect(dTokenOperator.setMaxTransaction("74000")).to.be.revertedWith(
      "max tx cannot be lower than 0.5%"
    );
    await expect(dTokenOperator.setMaxTransaction("76000")).to.not.be.reverted;
  });

  it("Should prevent total fees above 20%", async function () {
    await expect(dTokenOperator.setBuyFees(0, 0, 21)).to.be.revertedWith(
      "fees cannot be over 20%"
    );
    await expect(dTokenOperator.setSellFees(0, 0, 21)).to.be.revertedWith(
      "fees cannot be over 20%"
    );
  });

  it("Should report total buy fees", async function () {
    await (await dTokenOperator.setBuyFees(2, 2, 2)).wait();
    assert((await dTokenOperator.buyFee()).toString() == "6");
  });

  it("Should report total sell fees", async function () {
    await (await dTokenOperator.setSellFees(2, 2, 2)).wait();
    assert((await dTokenOperator.sellFee()).toString() == "6");
  });

  it("Should add/remove feeless address", async function () {
    await expect(dTokenOperator.setFeeless(TRADER.address, true))
      .to.emit(FocalPoint, "AddFeeExemption")
      .withArgs(TRADER.address);
    assert((await dTokenOperator.feelessAddresses(TRADER.address)) == true);

    await expect(dTokenOperator.setFeeless(TRADER.address, false))
      .to.emit(FocalPoint, "RemoveFeeExemption")
      .withArgs(TRADER.address);
    assert((await dTokenOperator.feelessAddresses(TRADER.address)) == false);
  });

  it("Should take appropriate fees", async function () {
    await addLiquidity();
    await (await dTokenOperator.enableTrading()).wait();
    await (await dTokenOperator.setSwapAndLiquifyEnabled(true)).wait();

    // buy 1 bnb worth and ensure we get taxed correctly
    // set buy fees to 2% all around to make it simple
    await (await dTokenOperator.setBuyFees(2, 2, 2)).wait();
    let buyAmount: any = ethers.utils.parseEther("11225");
    let expectedBuyFeeAmount: any = ethers.utils.parseEther("673.5"); // 11225 * 0.06
    await expect(
      tRouterOperator.swapETHForExactTokens(
        buyAmount,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("1.01"),
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, TRADER.address, buyAmount) // amount you bought
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, FocalPoint.address, expectedBuyFeeAmount); // taxes taken

    // sell 10000 tokens and ensure we get taxed correctly
    // set sell fees to 2% all around to make it simple
    await (await dTokenOperator.setSellFees(2, 2, 2)).wait();
    let sellAmount = ethers.utils.parseEther("10000");
    let expectedSellFeeAmount: any = ethers.utils.parseEther("600"); // 10000 * 0.06
    await expect(
      tRouterOperator.swapExactTokensForETHSupportingFeeOnTransferTokens(
        sellAmount,
        0,
        [FocalPoint.address, WETH],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          gasLimit: 500000,
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, pairAddress, sellAmount) // amount sold
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, FocalPoint.address, expectedSellFeeAmount); // taxes taken
  });

  it("Should liquify and distribute if contract balance high enough", async function () {
    await addLiquidity();
    await (await dTokenOperator.enableTrading()).wait();
    await (await dTokenOperator.setSwapAndLiquifyEnabled(true)).wait();

    // buy enough tokens to get both the platform fee and liq fee
    // to the minSwapTokens amount, we set the tax really high for simplicity
    await (await dTokenOperator.setBuyFees(10, 0, 10)).wait();
    let buyAmount: any = ethers.utils.parseEther("75000");
    let expectedBuyFeeAmount: any = ethers.utils.parseEther("15000"); // 75000 * 0.2
    await expect(
      tRouterOperator.swapETHForExactTokens(
        buyAmount,
        [WETH, FocalPoint.address],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000,
        {
          value: ethers.utils.parseEther("7"),
        }
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(pairAddress, TRADER.address, buyAmount) // amount you bought
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, FocalPoint.address, expectedBuyFeeAmount); // taxes taken

    // trigger liquify and validate that tokens get sold by the contract
    await expect(
      tRouterOperator.swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("1"),
        0,
        [FocalPoint.address, WETH],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, pairAddress, ethers.utils.parseEther("1"))
      .to.emit(FocalPoint, "Transfer")
      .withArgs(
        FocalPoint.address,
        pairAddress,
        ethers.utils.parseEther("3750")
      ); // taxes liquified
    let prov = waffle.provider;
    let initPR = await prov.getBalance(PLATFORM.address);

    // trigger distribute and validate what we're looking for:
    // distribution of Native tokens to the platform wallet
    await expect(
      tRouterOperator.swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.utils.parseEther("1"),
        0,
        [FocalPoint.address, WETH],
        TRADER.address,
        Math.round(new Date().getTime() / 1000) + 1000
      )
    )
      .to.emit(FocalPoint, "Transfer")
      .withArgs(TRADER.address, pairAddress, ethers.utils.parseEther("1"))
      .to.emit(FocalPoint, "Transfer")
      .withArgs(
        FocalPoint.address,
        pairAddress,
        ethers.utils.parseEther("7500")
      ); // fee tokens sold and sent return native the
    // platform addy
    assert(
      (await prov.getBalance(PLATFORM.address)) > initPR,
      "Native balance didn't increase"
    );
  });
});
