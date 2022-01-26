require("web3");
const process = require('process');

const TokenContract = artifacts.require("./../contracts/token/FocalPoint.sol");
module.exports = async function (deployer, network, accounts) {
  console.log(`Preparing to deploy FocalPoint to ${network}`);
  if (network == 'testnet') {
    var ROUTERADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
    var of = false;
  } else if (network == "forknet") {
    var ROUTERADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    var of = true;
  } else {
    console.log(`Network '${network}' not supported!`);
    return;
  }
  console.log(`Router: ${ROUTERADDRESS}`);

  var DEPLOYER = accounts[0];
  var MARKETING = accounts[1];
  var PLATFORM = accounts[2];
  await deployer.deploy(TokenContract, ROUTERADDRESS, MARKETING, PLATFORM, {from: DEPLOYER});
};

