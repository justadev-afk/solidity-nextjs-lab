// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Foundry runs on the host. From the repo root, in two terminals:
//   bun run chain                # anvil on http://127.0.0.1:8545 (or `bun run chain:docker`)
//   bun run contracts:deploy:03  # this script, then `bun run sync`
//
// `PRIVATE_KEY` comes from the repo-root `.env` (`cp .env.example .env`), which both Bun and
// forge load from the working directory — anvil account #0 by default. `Crowdfund` takes no
// constructor arguments: whoever deploys it becomes the protocol owner, and the only privilege
// that comes with it is sweeping the 2% fee taken from campaigns that succeed.

import {Crowdfund} from "../../src/03-crowdfund/Crowdfund.sol";
import {Script, console2} from "forge-std/Script.sol";

contract DeployCrowdfund is Script {
  function run() external returns (Crowdfund crowdfund) {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    vm.startBroadcast(deployerPrivateKey);
    crowdfund = new Crowdfund();
    vm.stopBroadcast();

    console2.log("Crowdfund deployed at:", address(crowdfund));
    console2.log("owner (fee recipient):", crowdfund.owner());
    console2.log("FEE_BPS (basis points):", crowdfund.FEE_BPS());
    console2.log("MIN_DURATION (seconds):", crowdfund.MIN_DURATION());
    console2.log("MAX_DURATION (seconds):", crowdfund.MAX_DURATION());
    console2.log("MAX_TITLE_LENGTH (bytes):", crowdfund.MAX_TITLE_LENGTH());
    console2.log("Next step: run `bun run sync` to refresh packages/abi.");
  }
}
