// This import is needed to let the TypeScript compiler know that it should
// include your type extensions in your npm package's types file.
import "./type-extensions";

import { extendConfig } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const networkMetadata = userConfig.networks?.hardhat?.metadata;

    let metadata: Object;
    if (networkMetadata === undefined) {
      metadata = {};
    } else {
      metadata = networkMetadata;
    }

    config.networks.hardhat.metadata = metadata;
  }
);
