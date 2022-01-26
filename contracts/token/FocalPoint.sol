import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./../ISwap.sol";
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract FocalPoint is ERC20, Ownable {
  ISwapRouter private _router;
  address private _routerAddress;
  address public swapPairAddress;

  uint256 private constant BUY = 1;
  uint256 private constant SELL = 2;
  uint256 private constant TRANSFER = 3;
  uint256 private constant CONTRACT = 4;
  uint256 private constant FEELESS = 5;

  event SwapAndLiquifyUpdated(bool _enabled);
  event SwapAndLiquify(
    uint256 tokensSwapped,
    uint256 ethReceived,
    uint256 tokensIntoLiquidity
  );
  bool public swapAndLiquifyEnabled = false;
  bool private _liquifying;

  bool public tradingEnabled = false;
  uint256 public maxTxAmount = 75000 * 10**decimals(); // 0.5%
  uint256 private _minSwapTokens = 7500 * 10**decimals(); // 0.05%

  event UpdatePlatformInfo(uint256 buyFee, uint256 sellFee, address addy);
  event UpdateMarketingInfo(uint256 buyFee, uint256 sellFee, address addy);
  event UpdateLiqudityFee(uint256 buyFee, uint256 sellFee);
  uint256 public platformBuyFee = 0;
  uint256 public platformSellFee = 0;
  uint256 private _tokensForPlatform;

  uint256 public marketingBuyFee = 0;
  uint256 public marketingSellFee = 0;
  uint256 private _tokensForMarketing;

  uint256 public liquidityBuyFee = 0;
  uint256 public liquiditySellFee = 0;
  uint256 private _tokensForLiquidity;

  address public platformAddress;
  address public marketingAddress;
  address public liquidityAddress;

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
    address routerAddress,
    address mAddress,
    address dAddress
  ) ERC20("Focal Point", "FOCAL") {
    _mint(msg.sender, 15000000 * 10**decimals());

    // create pair on the swapping DEX with WETH
    _routerAddress = routerAddress;
    _router = ISwapRouter(_routerAddress);
    swapPairAddress = ISwapFactory(_router.factory()).createPair(
      address(this),
      _router.WETH()
    );

    // setup fee information
    liquidityAddress = msg.sender;
    marketingAddress = mAddress;
    platformAddress = dAddress;

    platformBuyFee = 2;
    marketingBuyFee = 2;
    liquidityBuyFee = 2;

    platformSellFee = 12;
    marketingSellFee = 4;
    liquiditySellFee = 4;

    setFeeless(address(this), true);
    setFeeless(msg.sender, true);
    setFeeless(mAddress, true);
    setFeeless(dAddress, true);
  }

  // To receive ETH from router when swapping
  receive() external payable {}
  function enableTrading() public onlyOwner {
    require(tradingEnabled == false);
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

  // marketing wallet operations
  function setMarketingAddress(address addy) public onlyOwner {
    require(addy != address(0));
    marketingAddress = addy;
    emit UpdateMarketingInfo(marketingBuyFee, marketingSellFee, addy);
  }

  function setMarketingBuyFee(uint256 buyFee) public onlyOwner {
    require(buyFee <= 20 && buyFee > 0); // max tax 20%
    require((buyFee + platformBuyFee + liquidityBuyFee) <= 20);
    platformBuyFee = buyFee;
    emit UpdatePlatformInfo(buyFee, marketingSellFee, marketingAddress);
  }

  function setMarketingSellFee(uint256 sellFee) public onlyOwner {
    require(sellFee <= 20 && sellFee > 0); // max tax 20%
    require((sellFee + platformSellFee + liquiditySellFee) <= 20);
    marketingSellFee = sellFee;
    emit UpdateMarketingInfo(marketingBuyFee, sellFee, marketingAddress);
  }

  // platform wallet operations
  function setPlatformAddress(address addy) public onlyOwner {
    require(addy != address(0));
    platformAddress = addy;
    emit UpdatePlatformInfo(platformBuyFee, platformSellFee, addy);
  }

  function setPlatformBuyFee(uint256 buyFee) public onlyOwner {
    require(buyFee <= 20 && buyFee > 0); // max tax 20%
    require((buyFee + marketingBuyFee + liquidityBuyFee) <= 20);
    platformBuyFee = buyFee;
    emit UpdatePlatformInfo(buyFee, platformSellFee, platformAddress);
  }

  function setPlatformSellFee(uint256 sellFee) public onlyOwner {
    require(sellFee <= 20 && sellFee > 0); // max tax 20%
    require((sellFee + marketingSellFee + liquiditySellFee) <= 20);
    platformSellFee = sellFee;
    emit UpdatePlatformInfo(platformBuyFee, sellFee, platformAddress);
  }

  // liquidity fees
  function setLiquiditySellFee(uint256 sellFee) public onlyOwner {
    require(sellFee <= 20 && sellFee > 0); // max tax 20%
    require((sellFee + platformSellFee + marketingSellFee) <= 20);
    liquiditySellFee = sellFee;
    emit UpdateLiqudityFee(liquidityBuyFee, sellFee);
  }

  function setLiquidityBuyFee(uint256 buyFee) public onlyOwner {
    require(buyFee <= 20 && buyFee > 0); // max tax 20%
    require((buyFee + platformSellFee + marketingBuyFee) <= 20);
    liquidityBuyFee = buyFee;
    emit UpdateLiqudityFee(buyFee, liquiditySellFee);
  }
  
  function setSwapAndLiquifyEnabled(bool _enabled) public onlyOwner {
    swapAndLiquifyEnabled = _enabled;
    emit SwapAndLiquifyUpdated(_enabled);
  }

  // token transfer logic
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
    uint256 transferType = 0;
    if (feelessAddresses[sender] == true) {
      transferType = FEELESS;
    } else if (sender == address(this)) {
      transferType = CONTRACT;
    } else if (sender == swapPairAddress) {
      transferType = BUY;
    } else if (recipient == swapPairAddress) {
      transferType = SELL;
    } else {
      transferType = TRANSFER;
    }
    return transferType;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual override {
    uint256 transferType = _getTransferType(sender, recipient);
    if (transferType == BUY || transferType == SELL) {
      require(tradingEnabled == true);
      require(amount <= maxTxAmount);
    }
    if (feesEnabled == false) {
      super._transfer(sender, recipient, amount);
      return;
    }
    uint256 tokenBalance = balanceOf(address(this));

    if (transferType == BUY) {
      // calculate taxes for a BUY (sender is the pair)
      uint256 newLiquidityTokens = _calculateTokensForFee(
        amount,
        liquidityBuyFee
      );
      uint256 newMarketingTokens = _calculateTokensForFee(
        amount,
        marketingBuyFee
      );
      uint256 newPlatformTokens = _calculateTokensForFee(
        amount,
        platformBuyFee
      );
      uint256 txFeeTokens = newLiquidityTokens +
        newMarketingTokens +
        newPlatformTokens;

      // track portion of collected tokens for each fee
      _tokensForLiquidity += newLiquidityTokens;
      _tokensForMarketing += newMarketingTokens;
      _tokensForPlatform  += newPlatformTokens;

      // send the buyer the promised token amount
      super._transfer(sender, recipient, amount);
      // then force-send the tax fees back to self
      super._transfer(recipient, address(this), txFeeTokens);
    } else if (transferType == SELL) {
      // calculate taxes for a SELL (pair is the recipient)

      // check if we should perform a liquify
      if (
        !_liquifying && swapAndLiquifyEnabled && tokenBalance >= _minSwapTokens
      ) { // contract min balance must be 0.05% (_minSwapTokens)
        _swapAndLiquify(
          _tokensForLiquidity + _tokensForMarketing + _tokensForPlatform
        );
      }
      uint256 newLiquidityTokens = _calculateTokensForFee(
        amount,
        liquiditySellFee
      );
      uint256 newMarketingTokens = _calculateTokensForFee(
        amount,
        marketingSellFee
      );
      uint256 newPlatformTokens  = _calculateTokensForFee(
        amount,
        platformSellFee
      );
      uint256 txFeeTokens = newLiquidityTokens +
        newMarketingTokens +
        newPlatformTokens;

      // track portion of collected tokens for each fee
      _tokensForLiquidity += newLiquidityTokens;
      _tokensForMarketing += newMarketingTokens;
      _tokensForPlatform  += newPlatformTokens;

      // send the pair the promised token amount
      super._transfer(sender, recipient, amount);
      // then force-send the tax fees back to self
      super._transfer(recipient, address(this), txFeeTokens);
    } else { // normal transfer if not a BUY or SELL
      super._transfer(sender, recipient, amount);
    }
  }

  // autoliquidity and fee logic
  function _swapAndLiquify(uint256 tokensToLiquify) private lockTheSwap {
    uint256 tokenBalance = balanceOf(address(this));

    // Half of the collected tokens need to be sold
    // the rest are reserved for adding to liquidity
    uint256 tokensForLiquidity = tokensToLiquify / 2;
    uint256 amountToSwapForNative = tokenBalance - tokensForLiquidity;

    uint256 initialNativeBalance = address(this).balance;

    // sell the tokens and divide recieved amount to fee addresses
    _swapTokensForNative(amountToSwapForNative);
    uint256 nativeBalance = address(this).balance - initialNativeBalance;
    uint256 nativeForMarketing = (nativeBalance * _tokensForMarketing) /
      tokensToLiquify;
    uint256 nativeForPlatform  = (nativeBalance * _tokensForPlatform) /
      tokensToLiquify;
    uint256 nativeForLiquidity = nativeBalance -
      nativeForMarketing -
      nativeForPlatform;

    // after a liquify reset our tracking variables
    _tokensForLiquidity = 0;
    _tokensForMarketing = 0;
    _tokensForPlatform  = 0;

    // send the native token to the fee addresses
    (bool success, ) = address(marketingAddress).call{
      value: nativeForMarketing
    }("");
    (success, ) = address(platformAddress).call{value: nativeForPlatform}("");

    // add the remaining native token as liquidity along with
    // reserved tokens
    _addLiquidity(tokensForLiquidity, nativeForLiquidity);
    emit SwapAndLiquify(
      amountToSwapForNative,
      nativeForLiquidity,
      tokensForLiquidity
    );

    // move any remaining native tokens to the marketing address
    if (address(this).balance > 1e17) {
      (success, ) = address(platformAddress).call{value: address(this).balance}(
        ""
      );
    }
  }

  function _swapTokensForNative(uint256 tokenAmount) private {
    address[] memory path = new address[](2);
    path[0] = address(this);
    path[1] = _router.WETH();
    _approve(address(this), address(_routerAddress), tokenAmount);
    _router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokenAmount,
      0, // accept any amount of ETH
      path,
      address(this),
      block.timestamp
    );
  }

  function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
    _approve(address(this), address(_routerAddress), tokenAmount);
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
