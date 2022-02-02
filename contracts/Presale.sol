import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract Presale is ReentrancyGuard, Ownable {
  // The number of unclaimed tokens the user has
  mapping(address => uint256) public tokensUnclaimed;
  // The block when the user claimed tokens prevously
  mapping(address => uint256) public lastTokensClaimed;
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
  uint256 public claimStart;

  uint256 whiteListDuration = 30 minutes;
  uint256 public timestampStarted;

  event TokensBought(address user, uint256 tokens);
  event TokensClaimed(address user, uint256 tokens);
  event PrivateSaleClaimed(address user, uint256 tokens);

  constructor() {
    isSaleActive = false;
    claimEnabled = false;
  }

  receive() external payable {
    buy(msg.sender);
  }

  function open() external onlyOwner {
    isSaleActive = true;
    timestampStarted = block.timestamp;
  }
  
  function finalize() external onlyOwner {
    claimEnabled = true;
    isSaleActive = false;
    claimStart = block.timestamp;
  }

  function buy(address beneficiary) public payable nonReentrant {
    require(!claimEnabled, "Sale is over");
    require(isSaleActive, "Sale is not active yet");
    require(privatesaler[msg.sender] == false, "private buyers cannot participate");
    if (whiteListDuration + timestampStarted > block.timestamp) {
      require(
        whitelisted[msg.sender] == true,
        "You are not whitelisted"
      );
    }

    uint256 _bnbSent = msg.value;
    require(_bnbSent >= 0.1 ether, "BNB is lesser than min value");
    require(_bnbSent <= 2 ether, "BNB is greater than max value");
    require(_bnbSent % 0.1 ether == 0, "BNB is not a multiple of 0.1");
    require(bnbReceived <= hardcap, "Hardcap reached");
    require(bnbReceived+_bnbSent <= hardcap, "BNB is greater than remaining cap space");
    require(totalTokensSold < hardcap * tokensPerBNB, "No tokens left for sale");
    

    uint256 tokens = _bnbSent * tokensPerBNB;
    require(
      tokensUnclaimed[beneficiary] + tokens <= tokensPerBNB * 2 ether,
      "Can't buy more than 2 BNB worth of tokens"
    );

    tokensUnclaimed[beneficiary] += tokens;

    totalTokensSold += tokens;
    bnbReceived += msg.value;
    emit TokensBought(beneficiary, tokens);
  }

  function ownedTokens() external view returns (uint256) {
    return tokensUnclaimed[msg.sender];
  }

  function unpurchasedTokens() external view returns (uint256) {
    return (hardcap * tokensPerBNB) - totalTokensSold;
  }

  function addWhitelisters(address[] calldata accounts) external onlyOwner {
    for (uint256 i = 0; i < accounts.length; i++) {
      whitelisted[accounts[i]] = true;
    }
  }

  function addPrivatesalers(
    address[] calldata accounts,
    uint256[] calldata amounts
  ) external onlyOwner {
    for (uint256 i = 0; i < accounts.length; i++) {
      privatesaler[accounts[i]] = true;
      tokensUnclaimed[accounts[i]] = amounts[i];
    }
  }

  function claimTokens() external nonReentrant {
    require(claimEnabled == true, "Claiming tokens not yet enabled.");
    require(isSaleActive == false, "Sale is still active");
    require(
      tokensUnclaimed[msg.sender] > 0,
      "User should have unclaimed FOCAL tokens"
    );
    require(
      safeToken.balanceOf(address(this)) >= tokensUnclaimed[msg.sender],
      "There are not enough FOCAL tokens to transfer, wtf?"
    );
    // private sale buyers are special
    if (privatesaler[msg.sender] == true) {
      uint256 tokens = tokensUnclaimed[msg.sender];

      tokensUnclaimed[msg.sender] = 0;
      lastTokensClaimed[msg.sender] = block.number;

      safeToken.transfer(msg.sender, tokens);
      emit PrivateSaleClaimed(msg.sender, tokens);
      return;
    }

    // everyone else can claim half their tokens on day 1 
    // and the rest 7 days later
    if (block.timestamp < claimStart + 7 days) {
      require(lastTokensClaimed[msg.sender] == 0, "Cannot claim vested tokens yet");
      uint256 tokens = tokensUnclaimed[msg.sender] / 2;

      tokensUnclaimed[msg.sender] -= tokens;
      lastTokensClaimed[msg.sender] = block.number;
      safeToken.transfer(msg.sender, tokens);
      emit TokensClaimed(msg.sender, tokens);
    } else {
      // second claim
      uint256 rem = tokensUnclaimed[msg.sender];
      tokensUnclaimed[msg.sender] = 0;
      lastTokensClaimed[msg.sender] = block.number;
      safeToken.transfer(msg.sender, rem);
      emit TokensClaimed(msg.sender, rem);
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
