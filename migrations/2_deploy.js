require("web3");
require("readline");
const TokenContract = artifacts.require("./../contracts/token/FocalPoint.sol");
module.exports = async function (deployer, network, accounts) {
  if (network != 'testnet') {
    return;
  }

  var DEPLOYER = accounts[0];
  var MARKETING = accounts[1];
  var PLATFORM = accounts[2];
  var ROUTERADDRESS = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'; 
  await deployer.deploy(TokenContract, ROUTERADDRESS, MARKETING, PLATFORM);
};

