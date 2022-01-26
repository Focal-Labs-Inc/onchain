import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract Presale is ReentrancyGuard, Ownable {
    // Maps user to the number of tokens owned
    mapping (address => uint256) public tokensOwned;
    // The block when the user claimed tokens prevously
    mapping (address => uint256) public lastTokensClaimed;
    // The number of unclaimed tokens the user has
    mapping (address => uint256) public tokensUnclaimed;
    // Whitelisted addresses
    mapping (address => bool) public whitelisted;

    bool public onlyWhitelister = true;
    uint256 public whitelisterHardcap = 500 ether;

    IERC20 safeToken;

    // Sale ended
    bool isSaleActive;
    // Starting timestamp normal
    uint256 public totalTokensSold = 0;
    uint256 public tokensPerBNB = 10000;
    uint256 public bnbReceived = 0;
    bool public claimEnabled;

    uint256 whiteListDuration = 30 minutes;
    uint256 public timestampStarted;

    event TokenBuy(address user, uint256 tokens);
    event TokenClaim(address user, uint256 tokens);

    constructor () {
        isSaleActive = false;
        claimEnabled = false;
    }

    receive() external payable {
        buy(msg.sender);
    }

    function buy (address beneficiary) public payable nonReentrant {
        require(isSaleActive, "Sale is not active yet");

        if (whiteListDuration + timestampStarted > block.timestamp) {
            require(whitelisted[msg.sender] == true, "You are not whitelisted, wait for the general presale to start.");
            require(address(this).balance <= whitelisterHardcap, "Hardcap for whitelist reached");
        }

        address _buyer = beneficiary;
        uint256 _bnbSent = msg.value;
        uint256 tokens = _bnbSent / 1e9 * tokensPerBNB;

        require (_bnbSent >= 0.1 ether, "BNB is lesser than min value");
        require (_bnbSent <= 2 ether, "BNB is greater than max value");
        require (bnbReceived <= 499.91 ether, "Hardcap reached");

        tokensOwned[_buyer] = tokensOwned[_buyer]+(tokens);

        // Changed to prevent botting of presale
        require(tokensOwned[_buyer] <= tokensPerBNB * 2 ether, "Can't buy more than 2 BNB worth of tokens");

        tokensUnclaimed[_buyer] = tokensUnclaimed[_buyer]+(tokens);
        totalTokensSold = totalTokensSold+(tokens);
        bnbReceived = bnbReceived+(msg.value);
        emit TokenBuy(beneficiary, tokens);
    }

    function setStartTime(uint256 _startTime) external onlyOwner{
        timestampStarted = _startTime;
    }

    function setSaleActive(bool _isSaleActive) external onlyOwner {
        isSaleActive = _isSaleActive;
    }

    function getTokensOwned () external view returns (uint256) {
        return tokensOwned[msg.sender];
    }

    function getTokensUnclaimed () external view returns (uint256) {
        return tokensUnclaimed[msg.sender];
    }

    function getLastTokensClaimed () external view returns (uint256) {
        return lastTokensClaimed[msg.sender];
    }

    function getSafeTokensLeft() external view returns (uint256) {
        return safeToken.balanceOf(address(this));
    }

    function setClaimEnabled(bool _enabled) external onlyOwner {
        claimEnabled = _enabled;
    }

    function addWhitelisters(address[] calldata accounts) external onlyOwner {
        for(uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = true;
        }
    }

    function claimTokens() external nonReentrant {
        require (claimEnabled == true, "Claiming tokens not yet enabled.");
        require (isSaleActive == false, "Sale is still active");
        require (tokensOwned[msg.sender] > 0, "User should own some FOCAL tokens");
        require (tokensUnclaimed[msg.sender] > 0, "User should have unclaimed FOCAL tokens");
        require (safeToken.balanceOf(address(this)) >= tokensOwned[msg.sender], "There are not enough FOCAL tokens to transfer, wtf?");

        tokensUnclaimed[msg.sender] = tokensUnclaimed[msg.sender]-(tokensOwned[msg.sender]);
        lastTokensClaimed[msg.sender] = block.number;

        safeToken.transfer(msg.sender, tokensOwned[msg.sender]);
        emit TokenClaim(msg.sender, tokensOwned[msg.sender]);
    }

    function setToken(IERC20 safeEarnToken) public onlyOwner {
        safeToken = safeEarnToken;
    }

    function withdrawFunds () external onlyOwner {
        payable((msg.sender)).transfer(address(this).balance);
    }
    function withdrawUnsoldTokens() external onlyOwner {
        safeToken.transfer(msg.sender, safeToken.balanceOf(address(this)));
    }
}
