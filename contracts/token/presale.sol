import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract Presale is ReentrancyGuard, Ownable {
  // Maps user to the number of tokens owned
  mapping(address => uint256) public tokensOwned;
  // The block when the user claimed tokens prevously
  mapping(address => uint256) public lastTokensClaimed;
  // The number of unclaimed tokens the user has
  mapping(address => uint256) public tokensUnclaimed;
  // Whitelisted addresses
  mapping(address => bool) public whitelisted;
  // Private sale addresses
  mapping(address => bool) public privatesaler;

  uint256 public hardcap = 500 ether;

  IERC20 safeToken;

  // Sale ended
  bool isSaleActive;
  // Starting timestamp normal
  uint256 public totalTokensSold = 0;
  uint256 public tokensPerBNB = 11225;
  uint256 public bnbReceived = 0;
  bool public claimEnabled;
  uint256 claimStart;

  uint256 whiteListDuration = 30 minutes;
  uint256 public timestampStarted;

  event TokenBuy(address user, uint256 tokens);
  event TokenClaim(address user, uint256 tokens);
  event PrivateSaleClaim(address user, uint256 tokens);

  constructor() {
    isSaleActive = false;
    claimEnabled = false;
  }

  receive() external payable {
    buy(msg.sender);
  }

  function buy(address beneficiary) public payable nonReentrant {
    require(isSaleActive, "Sale is not active yet");

    if (whiteListDuration + timestampStarted > block.timestamp) {
      require(
        whitelisted[msg.sender] == true,
        "You are not whitelisted, wait for the general presale to start."
      );
    }

    address _buyer = beneficiary;
    uint256 _bnbSent = msg.value;

    require(_bnbSent % 0.1 ether == 0, "BNB is not a multiple of 0.1");
    require(_bnbSent >= 0.1 ether, "BNB is lesser than min value");
    require(_bnbSent <= 2 ether, "BNB is greater than max value");
    require(bnbReceived <= hardcap, "Hardcap reached");

    uint256 tokens = _bnbSent * tokensPerBNB;
    tokensOwned[_buyer] += tokens;

    // Changed to prevent botting of presale
    require(
      tokensOwned[_buyer] <= tokensPerBNB * 2 ether,
      "Can't buy more than 2 BNB worth of tokens"
    );

    tokensUnclaimed[_buyer] = tokensUnclaimed[_buyer] + (tokens);
    totalTokensSold = totalTokensSold + (tokens);
    bnbReceived = bnbReceived + (msg.value);
    emit TokenBuy(beneficiary, tokens);
  }

  function setStartTime(uint256 _startTime) external onlyOwner {
    timestampStarted = _startTime;
  }

  function setSaleActive(bool _isSaleActive) external onlyOwner {
    isSaleActive = _isSaleActive;
  }

  function getTokensOwned() external view returns (uint256) {
    return tokensOwned[msg.sender];
  }

  function getTokensUnclaimed() external view returns (uint256) {
    return tokensUnclaimed[msg.sender];
  }

  function getLastTokensClaimed() external view returns (uint256) {
    return lastTokensClaimed[msg.sender];
  }

  function getSafeTokensLeft() external view returns (uint256) {
    return safeToken.balanceOf(address(this));
  }

  function setClaimEnabled(bool _enabled) external onlyOwner {
    claimEnabled = _enabled;
    claimStart = block.timestamp;
  }

  function addWhitelisters(address[] calldata accounts) external onlyOwner {
    for (uint256 i = 0; i < accounts.length; i++) {
      whitelisted[accounts[i]] = true;
    }
  }
  
  function addPrivatesalers(address[] calldata accounts, uint256[] calldata amounts) external onlyOwner {
    for (uint256 i = 0; i < accounts.length; i++) {
      privatesaler[accounts[i]] = true;
      tokensOwned[accounts[i]] = amounts[i];
    }
  }

  function claimTokens() external nonReentrant {
    require(claimEnabled == true, "Claiming tokens not yet enabled.");
    require(isSaleActive == false, "Sale is still active");
    require(tokensOwned[msg.sender] > 0, "User should own some FOCAL tokens");
    require(
      tokensUnclaimed[msg.sender] > 0,
      "User should have unclaimed FOCAL tokens"
    );
    require(
      safeToken.balanceOf(address(this)) >= tokensOwned[msg.sender],
      "There are not enough FOCAL tokens to transfer, wtf?"
    );
    // private sale buyers are special
    if (privatesaler[msg.sender] == true) {
        tokensUnclaimed[msg.sender] =
          tokensUnclaimed[msg.sender] -
          (tokensOwned[msg.sender]);
        lastTokensClaimed[msg.sender] = block.number;

        safeToken.transfer(msg.sender, tokensOwned[msg.sender]);
        emit TokenClaim(msg.sender, tokensOwned[msg.sender]);
        return;
    }
    require(lastTokensClaimed[msg.sender] == 0 || block.timestamp >= claimStart + 7 days,
           "second claim period not open"); // first claim or second claim open

    if (block.timestamp < claimStart + 7 days) {
        tokensUnclaimed[msg.sender] -= (tokensOwned[msg.sender] / 2);
        lastTokensClaimed[msg.sender] = block.number;
        safeToken.transfer(msg.sender, tokensOwned[msg.sender] / 2);
        emit PrivateSaleClaim(msg.sender, tokensOwned[msg.sender] / 2);
    } else { // second claim
        uint256 rem = tokensUnclaimed[msg.sender];
        tokensUnclaimed[msg.sender] = 0;
        lastTokensClaimed[msg.sender] = block.number;
        safeToken.transfer(msg.sender, rem);
        emit PrivateSaleClaim(msg.sender, rem);
    }
  }

  function setToken(address tokenAddress) public onlyOwner {
    safeToken = IERC20(tokenAddress);
  }

  function withdrawFunds() external onlyOwner {
    (bool success, ) = msg.sender.call{value: address(this).balance}("");
    require(success, "Transfer failed");
  }

  function withdrawUnsoldTokens() external onlyOwner {
    safeToken.transfer(msg.sender, safeToken.balanceOf(address(this)));
  }
}
