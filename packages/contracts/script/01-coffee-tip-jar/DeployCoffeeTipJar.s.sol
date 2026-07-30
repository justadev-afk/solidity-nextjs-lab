// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Foundry runs on the host. From the repo root, in two terminals:
//   bun run chain                # anvil on http://127.0.0.1:8545 (or `bun run chain:docker`)
//   bun run contracts:deploy     # this script, then `bun run sync`
//
// `PRIVATE_KEY` comes from the repo-root `.env` (`cp .env.example .env`), which both Bun and
// forge load from the working directory — anvil account #0 by default. `MINIMUM_TIP` is optional
// and may be overridden with any wei amount:
//   MINIMUM_TIP=5000000000000000 bun run contracts:deploy

import {CoffeeTipJar} from "../../src/01-coffee-tip-jar/CoffeeTipJar.sol";
import {Script, console2} from "forge-std/Script.sol";

contract DeployCoffeeTipJar is Script {
    uint256 internal constant DEFAULT_MINIMUM_TIP = 0.001 ether;

    function run() external returns (CoffeeTipJar jar) {
        uint256 minimumTip = vm.envOr("MINIMUM_TIP", DEFAULT_MINIMUM_TIP);
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        jar = new CoffeeTipJar(minimumTip);
        vm.stopBroadcast();

        console2.log("CoffeeTipJar deployed at:", address(jar));
        console2.log("owner:", jar.owner());
        console2.log("minimumTip (wei):", jar.minimumTip());
        console2.log("Next step: run `bun run sync` to refresh packages/abi.");
    }
}
