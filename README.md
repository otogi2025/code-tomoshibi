# Code-Tomoshibi

**在浏览器里跑 Claude Code 和 Codex 的终端前台。** 服务器上开一份，iPad 打开网页就能干活。

## 它不是一个 VS Code 扩展

这是对 VS Code 和 code-server 的深度分叉 —— 改的是地基，不是往上挂插件。相对上游 VS Code `1.132.0`（`df53daab`）：

| | 文件数 |
| --- | ---: |
| 删除 | 11262 |
| 就地改掉的 VS Code 核心文件 | 1145 |
| Tomoshibi 新增 | 25 |

整块拆掉的子系统包括 Copilot 扩展、Chat、Notebook、调试器、MCP、测试框架、Git 扩展、TypeScript 语言服务等等。理由很简单：跑 agent 用不上，而每留一个，就多一份在 iPad 上出问题的面积。

## 现在有什么

**终端**

- 多个常驻 session，顶上一排胶囊直接切；可以分组，同时只展开一组
- 触屏长按选字，出选择手柄和复制菜单 —— iPad 上原生 VS Code 做不到这件事
- 左右分屏
- 活动栏常驻一个 Esc 软键（其余组合键走物理键盘，不假设你在用屏幕键盘）

**围绕 agent 的小工具**

- **剪贴板历史** —— 终端里复制过的东西都留着，随时回插
- **临时便签** —— 贴提示词、贴路径，不用为此另开一个编辑器
- **状态栏性能条** —— CPU / 内存 / 上下行 / 网络延迟，最快 0.25 秒刷新一次
- 上传 / 下载文件

**界面**

- 全中文，从源码层改的，不是套一个语言包
- 左边栏只剩五个入口：文件、搜索、剪贴板历史、临时便签、终端

## 这个仓库是什么

这是**编译用的快照仓库** —— GitHub Actions 在这里编出 linux-x64 的发行包。

- `lib/vscode/` —— VS Code 源码，Tomoshibi 的改动已经打进去了（不是 submodule）
- `src/` —— code-server 的 HTTP / CLI 层
- `.github/workflows/` —— 编译流水线

上游：[microsoft/vscode](https://github.com/microsoft/vscode) `1.132.0` · [coder/code-server](https://github.com/coder/code-server)

## 许可

上游部分按各自的 MIT 许可使用，见 `LICENSE`、`lib/vscode/LICENSE.txt`、`ThirdPartyNotices.txt`。

**使用、修改、部署或再发布本仓库中由 Tomoshibi 添加或修改的部分时，必须保留「Tomoshibi」标识** —— 见 [TOMOSHIBI-NOTICE.md](TOMOSHIBI-NOTICE.md)。

---

## English

**Code-Tomoshibi** is a browser front-end for running command-line coding agents — Claude Code, Codex — from an iPad. Run one instance on a server, open the page, and the terminal is already there; the agent keeps running server-side while the iPad sleeps, changes networks, or goes through a tunnel.

It is a deep fork of VS Code and code-server, not an extension. Against upstream VS Code `1.132.0` (`df53daab`): **11262 files deleted, 1145 core files modified in place, 25 files added.** Copilot, Chat, Notebook, the debugger, MCP, the test framework, the Git extension and the TypeScript language service are gone — an agent does not need them, and each one is one more thing that can misbehave on an iPad.

What is here: persistent terminal sessions with a pill switcher and collapsible groups; long-press text selection with real selection handles on touch; side-by-side splitting; clipboard history; a scratch-note view; a live status-bar meter for CPU / RAM / network / latency; file upload and download; a fully Chinese UI translated at the source level.

This repository is the **build snapshot** used by GitHub Actions to produce the linux-x64 release. Upstream code stays under its MIT licenses (`LICENSE`, `lib/vscode/LICENSE.txt`, `ThirdPartyNotices.txt`). If you use, modify, deploy or redistribute the parts added or changed by Tomoshibi, you must keep the "Tomoshibi" attribution — see [TOMOSHIBI-NOTICE.md](TOMOSHIBI-NOTICE.md).
