# VS Code: "The terminal process failed to launch"

A macOS pseudo-terminal leak that shows up while editing `*.sol` in this repo. Diagnosed on
2026-07-31; kept here so it does not have to be investigated from scratch again.

## Symptom

Every so often, with VS Code open, any new integrated terminal refuses to start:

```text
The terminal process failed to launch: A native exception occurred during launch
(posix_openpt failed: Device not configured).
```

It correlates with opening or editing Solidity files, and it comes back a few minutes after a
restart. "Device not configured" is `ENXIO` from `posix_openpt()`, which on macOS means **there are
no free pseudo-terminals left**, not that a device is missing.

## Diagnosis

macOS caps the number of ptys system-wide:

```sh
sysctl kern.tty.ptmx_max          # 511 by default
ps -eo tty= | grep -c '^ttys'     # how many are taken right now
```

Find who is holding them:

```sh
lsof /dev/ptmx | awk 'NR>1{print $2}' | sort | uniq -c | sort -rn
```

When this was diagnosed, a single process — VS Code's **pty host**
(`Code Helper --type=utility --utility-sub-type=node.mojom.NodeService`) — held **505 of the 511**.

Then look at what is actually sitting on those ptys:

```sh
ps -eo tty=,command= | grep '^ttys' | awk '{$1="";print}' | sort | uniq -c | sort -rn | head
```

The answer was 505 identical entries:

```text
/bin/zsh -il      state Ss+      0 children
cwd: <repo>/packages/contracts
```

Two details make this conclusive:

- **`cwd` is `packages/contracts`** — the nearest ancestor holding a `foundry.toml`, i.e. where a
  Foundry command would be run from. VS Code's own default terminal cwd is the workspace root, so
  somebody is passing that cwd explicitly.
- **Zero children.** The command they ran has already exited, but the shell itself is still alive —
  an integrated terminal does not close after the command it was handed finishes.

Rate of growth while editing `.sol`: roughly 50 per minute.

The name of the culprit is in the extension host log,
`~/Library/Application Support/Code/logs/<session>/window1/exthost/exthost.log`:

```sh
grep -c 'at Xa (' exthost.log     # 560 occurrences against 505 leaked ptys
```

```text
[error] Error: forge lint --json <repo>/packages/contracts/src/03-crowdfund/Crowdfund.sol
        --out='out/lint' failed with exit code 1
    at Xa (.../runtimeverification.simbolik-15.0.1/build/extension.js:61:1612)
```

The renderer log shows the matching `jx.createTerminal` stack ending in the extension-host RPC
bridge, plus `potential listener LEAK detected` once the terminals pile up.

## Root cause

`runtimeverification.simbolik` (checked at 15.0.1), in `build/extension.js`:

```js
function EC(opts = {}) {
  let t = window.createTerminal(opts); // the pty is allocated here
  return new Promise((resolve, reject) => {
    let d = window.onDidChangeTerminalShellIntegration((e) => {
      e.terminal === t && (d.dispose(), resolve(t));
    });
  });
}
```

Every Foundry command the extension runs goes through `Xa`, which opens a **hidden terminal** for it:

```js
async function Xa(cmd, opts = {}, showOnError = false) {
  let term = await EC({ name: opts.name ?? cmd, hideFromUser: true, ...opts });
  let [res, out] = await bC(cmd, term);
  if (res.exitCode !== 0)
    throw (
      showOnError ? term.show() : opts.hideFromUser && term.dispose(),
      new Error(`${cmd} failed with exit code ${res.exitCode}`)
    );
  return (opts.hideFromUser && term.dispose(), out); // ← only reached on success
}
```

**`dispose()` is only called when the command succeeds.** With `showOnError`, a non-zero exit calls
`term.show()` and throws, and the pty is held until VS Code exits. `EC` is fragile too — it awaits
`onDidChangeTerminalShellIntegration` with no timeout and no `reject`, so a terminal whose shell
integration never fires is leaked before the command even runs.

Which puts the leak squarely on **this lab's normal state**. The command being run is
`forge lint --json <the open file> --out='out/lint'`, on every change to a `.sol` file, and it exits
1 for as long as the exercise under construction does not compile — which is the whole point of the
repo (see the hard rule in `CLAUDE.md` §0). One failing lint, one leaked pty, ~50 per minute while
typing. It also fires on any transient syntax error in a finished exercise.

## Fix

1. **Disable or uninstall `runtimeverification.simbolik`.** It is a paid debugger talking to
   `wss://code.simbolik.dev` and nothing in this lab depends on it. This is the only change that
   stops the leak.
2. **`"simbolik.autobuild": "never"` does not help.** It was tried; the leak continued unchanged.
   That setting governs the build path, and the linter is a separate one — the extension exposes no
   setting and no command to turn the linter off (its only knobs are `api-key`, `server`,
   `forge-path`, `autobuild`, `show-sourcemaps`, `auto-open-disassembly-view`, `json-rpc-url` and
   `sourcify-url`).
3. Raising `kern.tty.ptmx_max` is **not** a fix — it only moves the failure further out.

## Cleaning up without restarting VS Code

`SIGTERM` does not work: an interactive shell ignores it. Use `SIGHUP`, and only on shells that have
no child process, so a terminal that is actually running something is left alone:

```sh
PTYHOST=$(lsof /dev/ptmx | awk 'NR>1{print $2}' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
for p in $(pgrep -P "$PTYHOST"); do
  [ "$(ps -o command= -p "$p")" = "/bin/zsh -il" ] || continue
  [ -z "$(pgrep -P "$p")" ] && kill -HUP "$p"
done
```

The pty host closes its master file descriptors as soon as the shells exit, so the count drops
immediately — verify with `lsof -p "$PTYHOST" | grep -c /dev/ptmx`. Idle terminals you had open are
killed too and will show "process exited"; reopening them is enough.

## Unrelated observation from the same investigation

Both `juanblanco.solidity` and `nomicfoundation.hardhat-solidity` were running their language
servers at the same time (~940 MB combined). They also both contribute the `solidity.formatter`
setting, which is why `.vscode/settings.json` pins it — see the comments in that file. Only one of
them needs to be enabled.
