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
  Foundry command would be run from.
- **Zero children.** No command ever ran inside them. They were created and abandoned _before_
  anything was executed, which rules out `forge` itself, and rules out the formatter path
  (`forge fmt --raw -`, which `JuanBlanco.solidity` runs through `child_process`, not through a pty).

Rate of growth while editing `.sol`: roughly 50 per minute.

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

It opens a hidden terminal and waits for VS Code's shell-integration event — with **no timeout, no
`reject`, and no `dispose()` on any failure path**. If shell integration never activates for that
terminal, the promise never settles, the `dispose()` further down never runs, and the pty is held
until VS Code exits. That is exactly the observed state: a live shell with nothing in it.

The caller leaks on a second path too:

```js
if (res.exitCode !== 0)
  throw (showOnError ? term.show() : opts.hideFromUser && term.dispose()), new Error(...);
```

With `showOnError`, a failing `forge` invocation also skips `dispose()`.

Why it fires on Solidity files specifically: the extension declares `activationEvents: ["*"]`,
defaults `simbolik.autobuild` to `"always"`, and watches `**/*.sol`. One leaked pty per change.

## Fix

1. **Disable or uninstall `runtimeverification.simbolik`.** It is a paid debugger talking to
   `wss://code.simbolik.dev` and nothing in this lab depends on it. This is the only change that
   stops the leak completely.
2. If it has to stay: `"simbolik.autobuild": "never"`. That stops the continuous leak, but every
   manual debug session still leaks one pty.
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
