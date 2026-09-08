# Code-Tomoshibi

[![build](https://github.com/otogi2025/code-tomoshibi/actions/workflows/build.yml/badge.svg)](https://github.com/otogi2025/code-tomoshibi/actions/workflows/build.yml)

**在 iPad 上跑 Claude Code 和 Codex 的终端前台。**

在一台 Linux 机器上开一份，用 Safari 打开。终端已经在那儿，agent 已经在里面跑着；iPad 睡了、从 Wi-Fi 切到 5G、塞回包里，它都接着干。

Code-Tomoshibi 是对 [VS Code](https://github.com/microsoft/vscode) 和 [code-server](https://github.com/coder/code-server) 的深度分叉。它不是扩展，也不是主题：工作台本身被拆掉重组，只围着一件事转 —— 在服务器上养几个长时间运行的 agent session，然后用手指（有键盘的话再加上键盘）舒服地驱动它们。

[English](README.md) · 简体中文

---

## 为什么要分叉

iPad 浏览器里的 VS Code 离「跑 agent 的人需要的东西」只差一点点，但这一点点每分钟都在硌你：终端滚动条只在鼠标悬停时出现；选字跟 iPadOS 自带的选字打架；大多数 iPad 键盘没有 Esc；状态栏塞满了你从来不看的东西；而每一个跟终端无关的子系统，都是小 VPS 上多一份内存、Safari 里多一处会出事的地方。

所以这个项目没有绕着 VS Code 打补丁，而是直接往里切。相对上游 VS Code `1.132.0`（`df53daab`）：

| | 文件数 |
| --- | ---: |
| 删除 | 11 262 |
| 就地改掉 | 1 145 |
| 新增 | 29（其中 25 个是 Tomoshibi 自己的） |

整块拆掉的：GitHub Copilot 和 Chat（含 inline chat、agent sessions、语音、反馈）、Notebook、运行与调试、MCP、测试、源代码管理和 Git 扩展、问题面板和输出面板、扩展商店、GitHub / Microsoft 登录、设置同步和 Edit Sessions、TypeScript / HTML / CSS / JSON / PHP 语言服务、Emmet、Markdown 预览、媒体预览、内置浏览器、npm / grunt / gulp / jake 任务探测、端口面板、欢迎引导。

留下的：一个文本编辑器、一个文件树、一个搜索、一个学会了触屏的终端。

## 它有什么

### 是 Session，不是标签页

每个终端都是一个 **Session**：服务器上的一个常驻进程，在终端面板顶上以一颗胶囊显示，所有胶囊排成一行。

- **一眼看状态。** 每颗胶囊带一个点：绿色是 agent 在干活，黄色是它在等你回答，红色是进程死了或连接断了，对勾是做完了。agent 停下来时弹一条提示（`<名字> 已完成`）；页面在后台且浏览器给了通知权限的话，还会发系统通知。判断靠的是对 Claude Code 和 Codex 输出的字符串识别。
- **分组。** 像 Chrome 标签组那样，把 Session 放进带颜色、带名字的组。同一时刻只展开一组，所以这一行永远不会变成两行。点一下组名展开它、收起其他的。
- **拖、钉、改名、关。** 长按胶囊（220 毫秒）拖动可以排序，也可以拖进别的组。可以把一个 Session 钉到最前面。改名在一个小浮层里做。胶囊多到放不下时，有一个树状列表把所有 Session 和分组列出来。
- **分屏。** 左右两块，不管面板停在哪一边都是左右。
- **不弹键盘。** 所有跟 Session 有关的提示（选分组、改名、管理）都是自定义浮层，里面没有搜索框，iPad 的软键盘不会跳出来。
- **关掉网页也不死。** 关掉页面、让 iPad 睡觉、换网络，回来重新打开，还是原来那几个 shell，回滚缓冲区也在，你刚才看着的那个先回来。页面被关闭的 Session，服务器默认保留 3 小时；如果这期间有别的页面连上来却没接手它，就只保留 5 分钟（`--reconnection-grace-time` 可以改前一个数）。

### 手指能用的终端

- **长按选字。** 在一个词上按住 420 毫秒，它就被选中：两头是 iOS 风格的手柄，手指上方有放大镜，旁边一条菜单：复制 / 选择整行 / 全选 / 取消。把手柄拖到上下边缘，缓冲区自动滚动。最后选中的内容会顺手记进剪贴板历史。
- **Esc。** 左上角、活动栏旁边有一个常驻的 Esc 键。它把 Esc 发给当前终端但不抢焦点，软键盘不会缩回去。
- **Shift+回车是换行。** 接 iPad 硬件键盘时，发的是反斜杠加回车，bash 当作续行，Claude Code 当作提示词里的换行。开关是 `tomoshibi.terminal.shiftEnterNewline`，在设置浮层的「终端」页。
- **更宽的滚动条。** 终端竖向滚动条 20 像素，不是 xterm 默认的 14，按指尖的尺寸来的。

### 剪贴板历史和临时便签

两个侧边视图，专为「跟 agent 来回复制粘贴」这件事做的。

- **剪贴板历史。** 在这个页面里复制过的所有东西（编辑器、终端、长按菜单）都收在这里，最新的在最上面。点一条，就把它打进当前终端，不按回车。`⧉` 把它复制回设备剪贴板。「粘贴到终端」把设备剪贴板此刻的内容插进去。「清空」要在 3 秒内点第二下才生效。
  默认保留 50 条（10 到 200 可调），每条最多 8000 字。只存在浏览器里，一台设备一份，从不上服务器。长得像私钥、`password=` / `api_key:` 这类键值、或 `sk-…` 令牌的内容不会被记录。
- **临时便签。** 想写几条写几条，停手 0.8 秒后自动保存。默认写到服务器上的一个文件里，换台设备也在。有一个按钮把当前便签粘贴到终端。

### 只有四样东西的状态栏

原版的全去掉了，扩展也加不进来。剩下的：

- **左边：服务器实时读数。** `C 12% M 1.8G ↓115K ↑8K ⏱ 41ms`：主机 CPU、内存、网络下行 / 上行、往返延迟。默认每 0.5 秒刷新（0.25 到 5 秒可选）。点开是一个浮层：CPU、内存、交换区、磁盘的条形图，网络速率，延迟，还有占 CPU 最多的三个进程。
  采样只在有页面来问的时候才在服务器上做。页面在后台就不发请求。没人看，服务器什么也不干。
- **右边：「回到最新」** 把当前终端滚到底，**「上传文件」** 开始上传，**「MADE BY ITSUKI」** 是退出登录的按钮。

### 上传直接进命令行

点「上传文件」，选一个或多个文件。图片放到服务器的 `~/上传图片`，其他放到 `~/上传`。然后 shell 转义过的路径会被打进你刚才所在的终端，后面跟一个空格、不按回车 —— 直接就是 `claude` 或者随便哪个命令的参数。下载是文件树里的右键「下载」。

### 一页设置

齿轮打开的是一个浮层（不是编辑器标签页），七页：外观（Dark 2026 / Light 2026、字号、滚动条粗细、侧栏位置）、终端（默认 shell、持久 Session、Shift+回车、长按选字）、端口转发（顶替原来的端口面板：自动转发开关、正在监听的端口表、手动添加）、剪贴板 / 便签、上传、性能监测、账户（退出、版本）。背后那九个 `tomoshibi.*` 键是普通设置，也可以在 `settings.json` 里改。原版的设置编辑器还在，Ctrl+, 打开，要翻长尾设置时用。

### 一只拇指够得着的登录页

六个格子。数字键盘自己弹出来，第六位输完自动提交。密码错了格子抖一下变红。服务端限速：每分钟 2 次加每小时 12 次。用这个页面，密码必须正好是六位数字。

### 中文，改在源码上

界面是简体中文。不是语言包：VS Code 源码里的默认字符串被直接重写了，所以没有东西要下载、没有东西要配置。同样，也没有办法切回英文。需要英文界面的话，这个分叉现在这个样子不适合你。

### 外壳的其他部分

- 活动栏从上到下：一个单独的 `Code-Tomoshibi` 菜单、文件、搜索、剪贴板历史、临时便签、一个终端开关、设置齿轮。别的都不会出现。
- 原来那排文件 / 编辑 / 视图 / … 菜单换成了那一个扁平菜单（打开文件树、搜索、上传、新建 Session、Session 管理中心、设置）。
- 遥测在产品层面关掉了。扩展商店没了；扩展还是可以在服务器命令行里装。

## 怎么跑起来

每次推到 `main`，GitHub Actions 就编一份 linux-x64 的压缩包。到最近一次绿色的运行里拿：**Actions → build-linux-x64 → Artifacts → `codet-release`**（产物 14 天过期；目前还没有 GitHub Release）。

这个压缩包是 npm 包的布局，不是自带一切的整包：里面没有 `node_modules`，也没有捆绑的 Node。你需要 Node 24（锁定的是 24.18.0）和编译原生模块的常规工具链（Ubuntu 上是 `build-essential pkg-config python3`）。

```bash
mkdir code-tomoshibi && tar -C code-tomoshibi -xzf codet-<sha>.tar.gz
cd code-tomoshibi
npm install --omit=dev            # root 用户要加 --unsafe-perm
PASSWORD=123456 node . \
  --bind-addr 127.0.0.1:8080 \
  --app-name Code-Tomoshibi \
  --locale zh-cn \
  --disable-telemetry \
  --disable-workspace-trust \
  --disable-update-check \
  /你的/工作区/路径
```

第一次启动会写出 code-server 常规的 `config.yaml`（`bind-addr`、`auth`、`password`、`cert`）。环境变量 `PASSWORD` 或 `HASHED_PASSWORD` 优先于它。整个东西放到 HTTPS 后面（Caddy、nginx 都行）：Safari 的剪贴板和另外几个 API 只在安全上下文里工作。

`settings.json` 里没有必填项。iPad 相关的行为已经是分叉自己的默认值：终端用 DOM 渲染而不是 WebGL（Safari 在文件选择器返回或视口变化后会弄坏字形贴图）、面板在左边、没有命令中心和布局按钮、10000 行回滚且关掉标签页后 Session 还能续上、选中即复制、右键粘贴、方块光标、少动画、Dark 2026 主题。这些都是普通设置，`<user-data-dir>/User/settings.json` 里想改哪个都能改。

## 从源码编译

```bash
# Ubuntu 22.04，Node 24.18.0
sudo apt-get install -y libkrb5-dev libsecret-1-dev libxkbfile-dev libx11-dev pkg-config

SKIP_SUBMODULE_DEPS=1 npm ci          # code-server 的依赖
npm run build                          # code-server（tsc）
(cd lib/vscode && npm ci)              # VS Code 的依赖

# VS Code 本体。闸门的事见下面。
sudo systemd-run --scope --unit=tomoshibi-code-build -p MemoryMax=12G \
  -- runuser -u "$USER" -- env PATH="$PATH" HOME="$HOME" \
     VERSION=4.132.0-tomoshibi.2 VSCODE_TARGET=linux-x64 TOMOSHIBI_ISOLATED_BUILD=1 \
     bash -c "cd '$PWD' && npm run build:vscode"

npm run release                        # 组装 ./release
tar -C release -czf codet.tar.gz .
```

**闸门。** VS Code 的编译要吃远超 8 GB 的内存，在小 VPS 上会把别的一起拖死。所以 `ci/build/build-vscode.sh` 拒绝在以下条件之外运行：在一个名字含 `tomoshibi-code-build` 的 cgroup 里、有 6 到 12 GiB 之间的有限内存上限、宿主机至少 12 GiB、并且设了 `TOMOSHIBI_ISOLATED_BUILD=1`。macOS 上只查环境变量和 12 GiB。GitHub 工作流用上面那条 `systemd-run` 满足它。GitHub 给公开仓库的免费 runner（4 核 16 GB）过得了；给私有仓库的（2 核 7 GB）过不了。

`lib/vscode/` 是普通的内嵌目录，改动已经打在里面，不是子模块。没有打补丁这一步。

## 目录

| | |
| --- | --- |
| `lib/vscode/` | VS Code `1.132.0`，Tomoshibi 的改动已在其中。新代码在 `src/vs/workbench/contrib/tomoshibi/`、`contrib/terminalContrib/tomoshibi*/` 和 `contrib/terminal/browser/tomoshibi*`。 |
| `src/` | code-server：HTTP / websocket 层、命令行、登录页，以及 `/_tomoshibi/performance` 路由。 |
| `ci/build/` | 编译脚本，包括内存闸门。 |
| `.github/workflows/build.yml` | 唯一的工作流。 |

没有补丁序列。Tomoshibi 的改动就是叠在 VS Code `1.132.0` 上的普通提交，要看差异直接跟上游 `git diff`。

## 已知的坑

按硌人的程度排。

- Shift+回车只在 iPad 上是换行。桌面浏览器里 xterm.js 先拿到按键，直接把这一行提交了。
- 更新检查还指向上游 code-server 的发布页。传 `--disable-update-check`。
- PWA 名称和错误页用的是 `--app-name`，默认值是 `code-server`。
- 便签存在服务器上，但不做实时合并：两台设备同时编辑会互相覆盖。
- 状态栏里的网络数字是整机的，不是「到这台设备」的；只有延迟是从浏览器量的。
- 看门狗浮层（`tomoshibiWatchdog`）是给一个外部网关用的客户端，那个网关不在这个仓库里。没有它，浮层永远不会出现。
- Session 状态靠匹配 agent 输出的字符串，跑别的程序可能显示错误的点。

## 许可

上游部分按各自的 MIT 许可：`LICENSE`（code-server）、`lib/vscode/LICENSE.txt` 和 `ThirdPartyNotices.txt`（VS Code）。

使用、修改、部署或再发布本仓库中由 Tomoshibi 添加或修改的部分时，必须保留「Tomoshibi」标识：产品名、界面里的 Tomoshibi 字样、以及声明文件。见 [TOMOSHIBI-NOTICE.md](TOMOSHIBI-NOTICE.md)。
