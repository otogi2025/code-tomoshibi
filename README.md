# Code-Tomoshibi

[![build](https://github.com/otogi2025/code-tomoshibi/actions/workflows/build.yml/badge.svg)](https://github.com/otogi2025/code-tomoshibi/actions/workflows/build.yml)

**A terminal front-end for running Claude Code and Codex from an iPad.**

Run one instance on a Linux box. Open it in Safari. The terminal is already there, your agent is already in it, and it keeps working while the iPad goes to sleep, switches from Wi-Fi to 5G, or goes back into the bag.

Code-Tomoshibi is a deep fork of [VS Code](https://github.com/microsoft/vscode) and [code-server](https://github.com/coder/code-server). It is not an extension and not a theme. The workbench itself was cut down and rebuilt around one job: keeping several long-running agent sessions on a server and driving them comfortably with a finger, plus a keyboard when you have one.

English · [简体中文](README.zh-CN.md)

---

## Why a fork

VS Code in a browser on an iPad is *almost* what an agent operator needs, and it is wrong in a hundred small ways that add up every minute you use it. The terminal's scrollbar only shows on mouse hover. Text selection fights iPadOS. Most iPad keyboards have no Esc key. The status bar is full of things you never look at. And every subsystem that is not a terminal is one more thing that can eat memory on a small VPS or break in Safari.

So instead of patching around VS Code, this project cut into it. Against upstream VS Code `1.132.0` (`df53daab`):

| | files |
| --- | ---: |
| deleted | 11 262 |
| modified in place | 1 145 |
| added | 29 (25 of them Tomoshibi's own) |

Gone entirely: GitHub Copilot and Chat (inline chat, agent sessions, voice, feedback), Notebooks, Run and Debug, MCP, Testing, Source Control and the Git extension, the Problems and Output panels, the extension marketplace, GitHub and Microsoft authentication, Settings Sync and Edit Sessions, the TypeScript / HTML / CSS / JSON / PHP language features, Emmet, Markdown preview, media preview, the simple browser, npm / grunt / gulp / jake task detection, the Ports panel, and the welcome tours.

What stays is a text editor, a file explorer, a search view, and a terminal that has been taught to work with touch.

## What it does

### Sessions, not tabs

Every terminal is a **Session**: a persistent process on the server, shown as a pill in a single row across the top of the terminal panel.

- **Status at a glance.** Each pill carries a dot: green while the agent is working, yellow when it is waiting for you, red when the process died or the connection broke, a check when it finished. When an agent goes idle you get a toast (`<name> 已完成`), and a system notification if the page is hidden and the browser has notification permission. Detection is heuristic, tuned to Claude Code and Codex output.
- **Groups.** File Sessions into named, colored groups, Chrome-style. Only one group is expanded at a time, so the row never grows past one line. Tap a group to expand it and collapse the rest.
- **Reorder, pin, rename, close.** Long-press a pill (220 ms) and drag to reorder or to drop it into another group. Pin a Session to the front. Rename it in a small popover. A tree flyout lists every Session and group when the row gets crowded.
- **Split.** Two panes side by side, always horizontal regardless of where the panel is docked.
- **No keyboard pop-ups.** Every Session prompt (pick a group, rename, manage) is a custom popover with no search box, so the iPad keyboard stays down.
- **Survives the tab.** Close the page, sleep the iPad, change networks. Reopen and the same shells reattach with their scrollback, the one you were looking at first. A Session whose page was closed is kept on the server for 3 hours by default, or 5 minutes once another page has connected without picking it up (`--reconnection-grace-time` changes the first number).

### A terminal you can use with a finger

- **Long-press to select.** Hold on a word for 420 ms and it is selected, with iOS-style handles at each end, a loupe above your finger, and a menu: 复制 / 选择整行 / 全选 / 取消. Drag a handle near the top or bottom edge and the buffer auto-scrolls. Whatever you end up selecting also lands in the clipboard history.
- **Esc.** A permanent Esc key sits at the top-left, next to the activity bar. It sends Esc to the active terminal without stealing focus, so the soft keyboard stays up.
- **Shift+Enter is a newline.** On an iPad hardware keyboard it sends backslash + carriage return, which bash treats as line continuation and Claude Code treats as a new line in the prompt. The switch is `tomoshibi.terminal.shiftEnterNewline`, on the 终端 page of the settings overlay.
- **A wider scrollbar.** The terminal's vertical scrollbar is 20 px instead of xterm's 14, sized for a fingertip.

### Clipboard history and scratch notes

Two side views made for the copy-paste loop of driving an agent.

- **剪贴板历史.** Everything you copy inside the page (editor, terminal, long-press menu) is collected, newest first. Tap an entry to type it into the active terminal, without pressing Enter. `⧉` copies it back to the device clipboard. 粘贴到终端 inserts whatever the device clipboard holds right now. 清空 needs a second tap within 3 seconds.
  Keeps 50 entries by default (10 to 200), each cut at 8000 characters. Stored in the browser only, per device, never on the server. Text that looks like a private key, a `password=` / `api_key:` pair, or an `sk-…` token is not recorded.
- **临时便签.** Any number of free-form notes, saved automatically 0.8 s after you stop typing. By default they are written to a file on the server so they follow you across devices. A button pastes the note you are in into the terminal.

### A status bar with four things on it

Everything stock is gone, and extensions cannot add to it. What is left:

- **Left: a live server readout.** `C 12% M 1.8G ↓115K ↑8K ⏱ 41ms`: host CPU, memory, network down / up, and round-trip latency. Refreshes every 0.5 s by default (0.25 s to 5 s). Tap it for a popover with bars for CPU, memory, swap and disk, the network rates, latency, and the three processes using the most CPU.
  Sampling happens on the server only when a page asks for it. A hidden tab sends nothing. An idle server does nothing.
- **Right: 回到最新** scrolls the active terminal to the bottom, **上传文件** starts an upload, and **MADE BY ITSUKI** is the sign-out button.

### Upload straight into the command line

Tap 上传文件, pick one or more files. Images go to `~/上传图片` on the server, everything else to `~/上传`. The shell-quoted path is then typed into the terminal you were in, followed by a space and no Enter, so it is ready to be an argument for `claude` or whatever you are running. Download is the explorer's right-click 下载.

### One settings page

The gear opens a single overlay (not an editor tab) with seven pages: 外观 (Dark 2026 / Light 2026, font size, scrollbar thickness, sidebar side), 终端 (default shell, persistent Sessions, Shift+Enter, touch selection), 端口转发 (replaces the Ports panel: an auto-forward switch, a live table of listening ports, manual add), 剪贴板 / 便签, 上传, 性能监测, and 账户 (sign out, version). The nine `tomoshibi.*` keys behind it are ordinary settings and can also be edited in `settings.json`. The stock settings editor is still there on Ctrl+, if you need the long tail.

### A login page that fits a thumb

Six slots. The numeric keyboard opens by itself, the sixth digit submits. A wrong code shakes and turns red. The server rate-limits attempts to 2 per minute plus 12 per hour. With this page, the password has to be exactly six digits.

### Chinese, at the source

The interface is Simplified Chinese. Not through a language pack: the default strings in the VS Code source were rewritten, so there is nothing to download and nothing to configure. There is also no way to switch it back to English. If you need an English UI, this fork is not for you as it is.

### The rest of the shell

- Activity bar, top to bottom: a single `Code-Tomoshibi` menu, 文件, 搜索, 剪贴板历史, 临时便签, a 终端 toggle, and the settings gear. Nothing else appears there.
- The multi-menu menubar is replaced by that one flat menu (open explorer, search, upload, new Session, Session manager, settings).
- Telemetry is off at the product level. The extension marketplace is gone; extensions can still be installed from the server's command line.

## Getting it running

Every push to `main` builds a linux-x64 tarball on GitHub Actions. Grab it from the latest green run under **Actions → build-linux-x64 → Artifacts → `codet-release`** (artifacts expire after 14 days; there is no GitHub Release yet).

The tarball is the npm-package layout, not a self-contained bundle: it has no `node_modules` and no bundled Node. You need Node 24 (24.18.0 is pinned) and the usual toolchain for native modules (`build-essential pkg-config python3` on Ubuntu).

```bash
mkdir code-tomoshibi && tar -C code-tomoshibi -xzf codet-<sha>.tar.gz
cd code-tomoshibi
npm install --omit=dev            # as root, add --unsafe-perm
PASSWORD=123456 node . \
  --bind-addr 127.0.0.1:8080 \
  --app-name Code-Tomoshibi \
  --locale zh-cn \
  --disable-telemetry \
  --disable-workspace-trust \
  --disable-update-check \
  /path/to/your/workspace
```

The first start writes code-server's usual `config.yaml` (`bind-addr`, `auth`, `password`, `cert`). `PASSWORD` or `HASHED_PASSWORD` in the environment override it. Put the whole thing behind HTTPS (Caddy, nginx); Safari's clipboard and a few other APIs only work in a secure context.

Nothing in `settings.json` is required. The iPad-specific behaviour ships as the fork's own defaults: DOM terminal rendering instead of WebGL (Safari corrupts the glyph atlas after the file picker or a viewport change), the panel on the left, no command center or layout controls, 10 000 lines of scrollback with sessions revived after the tab is closed, copy on selection and paste on right click, a block cursor, reduced motion, and the Dark 2026 theme. Each of those is an ordinary setting, so `<user-data-dir>/User/settings.json` can override any of them.

## Building from source

```bash
# Ubuntu 22.04, Node 24.18.0
sudo apt-get install -y libkrb5-dev libsecret-1-dev libxkbfile-dev libx11-dev pkg-config

SKIP_SUBMODULE_DEPS=1 npm ci          # code-server deps
npm run build                          # code-server (tsc)
(cd lib/vscode && npm ci)              # VS Code deps

# VS Code itself. See the note below about the guard.
sudo systemd-run --scope --unit=tomoshibi-code-build -p MemoryMax=12G \
  -- runuser -u "$USER" -- env PATH="$PATH" HOME="$HOME" \
     VERSION=4.132.0-tomoshibi.2 VSCODE_TARGET=linux-x64 TOMOSHIBI_ISOLATED_BUILD=1 \
     bash -c "cd '$PWD' && npm run build:vscode"

npm run release                        # assembles ./release
tar -C release -czf codet.tar.gz .
```

**The guard.** The VS Code build needs well over 8 GB of RAM, and on a small VPS it takes everything else down with it. So `ci/build/build-vscode.sh` refuses to run unless it is inside a cgroup whose name contains `tomoshibi-code-build`, with a finite memory limit between 6 and 12 GiB, on a host with at least 12 GiB, and with `TOMOSHIBI_ISOLATED_BUILD=1` set. On macOS it only checks the variable and the 12 GiB. The GitHub workflow satisfies it with the `systemd-run` scope above. GitHub's free runners for public repositories (4 cores, 16 GB) pass; the ones for private repositories (2 cores, 7 GB) do not.

`lib/vscode/` is a plain vendored directory with the changes already applied, not a submodule. There is no patch step.

## Layout

| | |
| --- | --- |
| `lib/vscode/` | VS Code `1.132.0` with the Tomoshibi changes in place. New code lives under `src/vs/workbench/contrib/tomoshibi/`, `contrib/terminalContrib/tomoshibi*/` and `contrib/terminal/browser/tomoshibi*`. |
| `src/` | code-server: the HTTP / websocket layer, CLI, login page, and the `/_tomoshibi/performance` route. |
| `ci/build/` | Build scripts, including the memory guard. |
| `.github/workflows/build.yml` | The only workflow. |

There is no patch series. The Tomoshibi changes are plain commits on top of VS Code `1.132.0`; compare against upstream with `git diff` if you need the delta.

## Known gaps

Honest list, in the order they bite.

- Shift+Enter only works as a newline on an iPad. In a desktop browser xterm.js gets the key first and submits the line.
- The update check still points at upstream code-server's releases. Pass `--disable-update-check`.
- The PWA name and the error pages use `--app-name`, which defaults to `code-server`.
- Notes are stored on the server but not merged live: two devices editing at once overwrite each other.
- The status-bar network numbers are host-wide, not "to this device"; only the latency is measured from the browser.
- The watchdog overlay (`tomoshibiWatchdog`) is a client for an external gateway that is not part of this repository. Without one it never appears.
- Session status is string matching on agent output; other programs may get the wrong dot.

## License

The upstream parts stay under their MIT licenses: `LICENSE` (code-server), `lib/vscode/LICENSE.txt` and `ThirdPartyNotices.txt` (VS Code).

If you use, modify, deploy or redistribute the parts added or changed by Tomoshibi, you must keep the "Tomoshibi" attribution: the product name, the Tomoshibi marks in the UI, and the notice file. See [TOMOSHIBI-NOTICE.md](TOMOSHIBI-NOTICE.md).
