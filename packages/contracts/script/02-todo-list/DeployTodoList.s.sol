// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Foundry runs on the host. From the repo root, in two terminals:
//   bun run chain                # anvil on http://127.0.0.1:8545 (or `bun run chain:docker`)
//   bun run contracts:deploy:02  # this script, then `bun run sync`
//
// `PRIVATE_KEY` comes from the repo-root `.env` (`cp .env.example .env`), which both Bun and
// forge load from the working directory — anvil account #0 by default. `TodoList` has no
// constructor arguments and no owner: whoever deploys it gets no privileges whatsoever.

import {TodoList} from "../../src/02-todo-list/TodoList.sol";
import {Script, console2} from "forge-std/Script.sol";

contract DeployTodoList is Script {
  function run() external returns (TodoList list) {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    vm.startBroadcast(deployerPrivateKey);
    list = new TodoList();
    vm.stopBroadcast();

    console2.log("TodoList deployed at:", address(list));
    console2.log("MAX_CONTENT_LENGTH:", list.MAX_CONTENT_LENGTH());
    console2.log("MAX_TASKS_PER_OWNER:", list.MAX_TASKS_PER_OWNER());
    console2.log("Next step: run `bun run sync` to refresh packages/abi.");
  }
}
