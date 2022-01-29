import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import "./../ISwap.sol";

//
//
//                ,,µ▄▄▄▄▄▄▓▄▄▄╦╥,
//             -╔▄▓████████████████▓▓▄╥
//         ,╓▄████████████████████████▓▄,
//        .╔▓█████████████████████████████▓µ
//       !▄█████████████████████████████████▌
//      ╔████████████████▌╓▄▄▄▄▄▄▄▄▄▄▄═▄██████
//     "████████████▀▀▀▀▀ ▀▀▀▀▀▀▀▀▀▀▀██████████
//    .║███████████▄ ███⌐▄█████████████████████▌
//    ⌂█████████████ ██▌,███████████████████████
//    ░█████████████▌▄▄ ▄▄▄▄▄▄▄▄▄ ██████████████
//    ]███████████████▌▐████████╓███████████████
//    ╘███████████████ ████▀▀▀▀▄███████████████▌
//     ╫█████████████▌║███⌐████████████████████
//     ╫████████████ ███▌╓███████████████████⌐
//       ╫██████████⌐████ ███████████████████`
//       ╙▓████████,▀▀▀│▄█████████████████▀
//          ╙▓███████████████████████████▀
//            `▀██████████████████████▀└
//                "▀▀████████████▀▀└
//
// Focal DeFi: The First Generation 2.0 Wallet
// focaldefi.io
// t.me/focaldeficommunity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract FocalPoint is ERC20, ERC20Burnable, Ownable {
  ISwapRouter private _router;
  address public routerAddress;
  address public swapPairAddress;

  uint256 private constant BUY = 1;
  uint256 private constant SELL = 2;
  uint256 private constant TRANSFER = 3;

  event SwapAndLiquifyUpdated(bool _enabled);
  event SwapAndLiquify(
    uint256 tokensSwapped,
    uint256 ethReceived,
    uint256 tokensIntoLiquidity
  );
  bool public swapAndLiquifyEnabled = false;
  bool private _liquifying;

  bool public tradingEnabled = false;
  uint256 public maxTxAmount;
  uint256 private _minSwapTokens;

  event UpdatePlatformInfo(
    uint256 buyFee,
    uint256 sellFee,
    address beneficiary
  );
  event UpdateMarketingInfo(
    uint256 buyFee,
    uint256 sellFee,
    address beneficiary
  );
  event UpdateLiquidityInfo(
    uint256 buyFee,
    uint256 sellFee,
    address beneficiary
  );
  struct TokenFee {
    uint256 buyFee;
    uint256 sellFee;
    address beneficiary;
    uint256 tokensCollected;
  }
  TokenFee public platformFee;
  TokenFee public marketingFee;
  TokenFee public liquidityFee;

  event AddFeeExemption(address addy);
  event RemoveFeeExemption(address addy);
  mapping(address => bool) public feelessAddresses;
  bool public feesEnabled = false;

  modifier lockTheSwap() {
    _liquifying = true;
    _;
    _liquifying = false;
  }

  constructor(
    address rAddress,
    address pAddress,
    address mAddress
  ) ERC20("Focal Point", "FOCAL") {
    uint256 supply = 15000000;

    // mint total supply and set transaction limits
    _mint(msg.sender, supply * 10**decimals());
    maxTxAmount = totalSupply() / 200; // 0.5%
    _minSwapTokens = totalSupply() / 2000; // 0.05%

    // create pair on the swapping DEX with WETH
    routerAddress = rAddress;
    _router = ISwapRouter(routerAddress);
    swapPairAddress = ISwapFactory(_router.factory()).createPair(
      address(this),
      _router.WETH()
    );

    // setup fee information
    // initialize platformFee as 2% buy 12% sell
    // beneficiary pAddress
    platformFee = TokenFee(2, 12, pAddress, 0);
    // initialize marketingFee as 2% buy 4% sell
    // beneficiary mAddress
    marketingFee = TokenFee(2, 4, mAddress, 0);
    // initialize liquidityFee as 2% buy 4% sell
    // beneficiary msg.sender
    liquidityFee = TokenFee(2, 4, msg.sender, 0);

    setFeeless(address(this), true);
    setFeeless(msg.sender, true);
    setFeeless(mAddress, true);
    setFeeless(pAddress, true);
  }

  // To receive ETH from router when swapping
  receive() external payable {}

  function enableTrading() public onlyOwner {
    require(tradingEnabled == false, "trading already enabled");
    tradingEnabled = true;
    enableFees(true);
  }

  function enableFees(bool v) public onlyOwner {
    feesEnabled = v;
  }

  function setFeeless(address addy, bool value) public onlyOwner {
    feelessAddresses[addy] = value;
    if (value == true) {
      emit AddFeeExemption(addy);
    } else {
      emit RemoveFeeExemption(addy);
    }
  }

  // fee shortcuts
  // set fee addresses, leaving intact if the argument is address(0)
  function setFeeAddresses(
    address platformAddress,
    address marketingAddress,
    address liquidityAddress
  ) public onlyOwner {
    if (platformAddress != address(0)) {
      platformFee.beneficiary = platformAddress;
      emit UpdatePlatformInfo(
        platformFee.buyFee,
        platformFee.sellFee,
        platformAddress
      );
    }
    if (marketingAddress != address(0)) {
      marketingFee.beneficiary = marketingAddress;
      emit UpdateMarketingInfo(
        marketingFee.buyFee,
        marketingFee.sellFee,
        marketingAddress
      );
    }
    if (liquidityAddress != address(0)) {
      liquidityFee.beneficiary = liquidityAddress;
      emit UpdateLiquidityInfo(
        liquidityFee.buyFee,
        liquidityFee.sellFee,
        liquidityAddress
      );
    }
  }

  function setBuyFees(
    uint256 platformBuyFee,
    uint256 marketingBuyFee,
    uint256 liquidityBuyFee
  ) public onlyOwner {
    require(
      platformBuyFee + marketingBuyFee + liquidityBuyFee <= 20,
      "fees cannot be over 20%"
    );
    platformFee.buyFee = platformBuyFee;
    emit UpdatePlatformInfo(
      platformBuyFee,
      platformFee.sellFee,
      platformFee.beneficiary
    );
    marketingFee.buyFee = marketingBuyFee;
    emit UpdateMarketingInfo(
      marketingBuyFee,
      marketingFee.sellFee,
      marketingFee.beneficiary
    );
    liquidityFee.buyFee = liquidityBuyFee;
    emit UpdateLiquidityInfo(
      liquidityBuyFee,
      liquidityFee.sellFee,
      liquidityFee.beneficiary
    );
  }

  function setSellFees(
    uint256 platformSellFee,
    uint256 marketingSellFee,
    uint256 liquiditySellFee
  ) public onlyOwner {
    require(
      platformSellFee + marketingSellFee + liquiditySellFee <= 20,
      "fees cannot be over 20%"
    );
    platformFee.sellFee = platformSellFee;
    emit UpdatePlatformInfo(
      platformFee.buyFee,
      platformSellFee,
      platformFee.beneficiary
    );
    marketingFee.sellFee = marketingSellFee;
    emit UpdateMarketingInfo(
      marketingFee.buyFee,
      marketingSellFee,
      marketingFee.beneficiary
    );
    liquidityFee.sellFee = liquiditySellFee;
    emit UpdateLiquidityInfo(
      liquidityFee.buyFee,
      liquiditySellFee,
      liquidityFee.beneficiary
    );
  }

  function setMaxTransaction(uint256 amount) public onlyOwner {
    require(
      (amount * 10**decimals()) >= (totalSupply() / 200),
      "max tx cannot be lower than 0.5%"
    );
    maxTxAmount = amount * 10**decimals();
  }

  function setSwapAndLiquifyEnabled(bool enabled) public onlyOwner {
    swapAndLiquifyEnabled = enabled;
    emit SwapAndLiquifyUpdated(enabled);
  }

  // token transfer logic
  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual override {
    uint256 transferType = _getTransferType(sender, recipient);

    // prevent trading until manually enabled
    if (transferType == BUY || transferType == SELL) {
      require(tradingEnabled == true, "trading not enabled");
      require(amount <= maxTxAmount, "transaction over max");
    }
    // if fees are off just skip the checks
    if (feesEnabled == false) {
      super._transfer(sender, recipient, amount);
      return;
    }

    if (transferType == BUY) {
      _buyTransfer(sender, recipient, amount);
    } else if (transferType == SELL) {
      _sellTransfer(sender, recipient, amount);
    } else {
      // normal transfer if not a BUY or SELL
      super._transfer(sender, recipient, amount);
    }
  }

  function _calculateTokensForFee(uint256 amount, uint256 feePercent)
    private
    pure
    returns (uint256)
  {
    return (amount * feePercent) / (10**2);
  }

  function _getTransferType(address sender, address recipient)
    private
    view
    returns (uint256)
  {
    if (feelessAddresses[sender] == true || sender == address(this)) {
      // if the sender is set as feeless or the sender is the contract itself
      // treat as a regular transfer
      return TRANSFER;
    } else if (sender == swapPairAddress && recipient == routerAddress) {
      return TRANSFER;
    } else if (sender == swapPairAddress) {
      return BUY;
    } else if (recipient == swapPairAddress) {
      return SELL;
    } else {
      return TRANSFER;
    }
  }

  // calculate taxes for a BUY (sender is the pair)
  function _buyTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) private {
    uint256 newPlatformTokens = _calculateTokensForFee(
      amount,
      platformFee.buyFee
    );
    uint256 newMarketingTokens = _calculateTokensForFee(
      amount,
      marketingFee.buyFee
    );
    uint256 newLiquidityTokens = _calculateTokensForFee(
      amount,
      liquidityFee.buyFee
    );
    uint256 txFeeTokens = newPlatformTokens +
      newMarketingTokens +
      newLiquidityTokens;
    // track portion of collected tokens for each fee
    platformFee.tokensCollected += newPlatformTokens;
    marketingFee.tokensCollected += newMarketingTokens;
    liquidityFee.tokensCollected += newLiquidityTokens;

    // send the buyer the promised token amount
    super._transfer(sender, recipient, amount);
    // then force-send the tax fees back to self
    super._transfer(recipient, address(this), txFeeTokens);
  }

  // calculate taxes for a SELL (pair is the recipient)
  function _sellTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) private {
    // check if we should perform a liquify
    // contract min balance of tokens must be high enough
    uint256 tokenBalance = balanceOf(address(this));
    if (
      !_liquifying && swapAndLiquifyEnabled && tokenBalance >= _minSwapTokens
    ) {
      _swapAndLiquify(
        platformFee.tokensCollected +
          marketingFee.tokensCollected +
          liquidityFee.tokensCollected
      );
    }
    uint256 newPlatformTokens = _calculateTokensForFee(
      amount,
      platformFee.sellFee
    );
    uint256 newMarketingTokens = _calculateTokensForFee(
      amount,
      marketingFee.sellFee
    );
    uint256 newLiquidityTokens = _calculateTokensForFee(
      amount,
      liquidityFee.sellFee
    );
    uint256 txFeeTokens = newPlatformTokens +
      newMarketingTokens +
      newLiquidityTokens;

    // track portion of collected tokens for each fee
    platformFee.tokensCollected += newPlatformTokens;
    marketingFee.tokensCollected += newMarketingTokens;
    liquidityFee.tokensCollected += newLiquidityTokens;

    // send the pair the promised token amount
    super._transfer(sender, recipient, amount);
    // then force-send the tax fees back to self
    super._transfer(recipient, address(this), txFeeTokens);
  }

  // autoliquidity and fee logic
  function _swapAndLiquify(uint256 tokensToLiquify) private lockTheSwap {
    uint256 tokenBalance = balanceOf(address(this));
    uint256 initialNativeBalance = address(this).balance;

    // if the total balance is higher than our accounting the contract
    // received TOKEN outside of our control. Burn em!
    if (tokenBalance > tokensToLiquify) {
      uint256 tokensToBurn = tokenBalance - tokensToLiquify;
      burn(tokensToBurn);
    }
    // Half of the collected tokens need to be sold
    // the rest are reserved for adding to liquidity
    uint256 tokensForLiquidity = tokensToLiquify / 2;
    uint256 amountToSwapForNative = tokenBalance - tokensForLiquidity;

    // sell the tokens and divide recieved amount to fee addresses
    _swapTokensForNative(amountToSwapForNative);
    uint256 nativeBalance = address(this).balance - initialNativeBalance;
    uint256 nativeForPlatform = (nativeBalance * platformFee.tokensCollected) /
      tokensToLiquify;
    uint256 nativeForMarketing = (nativeBalance *
      marketingFee.tokensCollected) / tokensToLiquify;
    uint256 nativeForLiquidity = nativeBalance -
      nativeForMarketing -
      nativeForPlatform;

    // after a liquify reset our tracking variables
    platformFee.tokensCollected = 0;
    marketingFee.tokensCollected = 0;

    // add the remaining native token as liquidity along with
    // reserved tokens
    _addLiquidity(tokensForLiquidity, nativeForLiquidity);
    emit SwapAndLiquify(
      amountToSwapForNative,
      nativeForLiquidity,
      tokensForLiquidity
    );
    // since we sent off some of our Native Token for the fees
    // not all of our reserved tokens can be added as liquidity.
    // Add the leftovers to accounting
    liquidityFee.tokensCollected = balanceOf(address(this));

    // send the native token to the fee addresses
    (bool success, ) = address(platformFee.beneficiary).call{
      value: nativeForPlatform
    }("");
    (success, ) = address(marketingFee.beneficiary).call{
      value: nativeForMarketing
    }("");
    // move any remaining native tokens to the platform address
    if (address(this).balance > 1e16) {
      (success, ) = address(platformFee.beneficiary).call{
        value: address(this).balance
      }("");
    }
  }

  function _swapTokensForNative(uint256 tokenAmount) private {
    address[] memory path = new address[](2);
    path[0] = address(this);
    path[1] = _router.WETH();
    _approve(address(this), address(routerAddress), tokenAmount);
    _router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokenAmount,
      0, // accept any amount of ETH
      path,
      address(this),
      block.timestamp
    );
  }

  function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
    _approve(address(this), address(routerAddress), tokenAmount);
    _router.addLiquidityETH{value: ethAmount}(
      address(this),
      tokenAmount,
      0, // slippage is unavoidable
      0, // slippage is unavoidable
      owner(),
      block.timestamp
    );
  }
}
