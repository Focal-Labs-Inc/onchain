// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";

import { useEnvironment } from "./helpers";

describe("Integration tests examples", function () {
  describe("HardhatConfig extension", function () {
    useEnvironment("hardhat-project");

    it("Should have an empty metadata field in network", function () {
      assert.equal(typeof this.hre.config.networks.hardhat.metadata, "object");
    });
    it("Should have metadata in runtime", function () {
      assert.equal(typeof this.hre.network.config.metadata, "object");
    });
  });
});
