#!/usr/bin/env bash
set -euo pipefail

# Builds vscode into lib/vscode/out-vscode.

# MINIFY controls whether a minified version of vscode is built.
MINIFY=${MINIFY-true}

fix-bin-script() {
  local script="lib/vscode-reh-web-$VSCODE_TARGET/bin/$1"
  sed -i.bak "s/@@VERSION@@/$(vscode_version)/g" "$script"
  sed -i.bak "s/@@COMMIT@@/$BUILD_SOURCEVERSION/g" "$script"
  sed -i.bak "s/@@APPNAME@@/code-server/g" "$script"

  # Fix Node path on Darwin and Linux.
  # We do not want expansion here; this text should make it to the file as-is.
  # shellcheck disable=SC2016
  sed -i.bak 's/^ROOT=\(.*\)$/VSROOT=\1\nROOT="$(dirname "$(dirname "$VSROOT")")"/g' "$script"
  sed -i.bak 's/ROOT\/out/VSROOT\/out/g' "$script"
  # We do not want expansion here; this text should make it to the file as-is.
  # shellcheck disable=SC2016
  sed -i.bak 's/$ROOT\/node/${NODE_EXEC_PATH:-$ROOT\/lib\/node}/g' "$script"

  # Fix Node path on Windows.
  sed -i.bak 's/^set ROOT_DIR=\(.*\)$/set ROOT_DIR=%~dp0..\\..\\..\\..\r\nset VSROOT_DIR=\1/g' "$script"
  sed -i.bak 's/%ROOT_DIR%\\out/%VSROOT_DIR%\\out/g' "$script"

  chmod +x "$script"
  rm "$script.bak"
}

copy-bin-script() {
  cp "lib/vscode/resources/server/bin/$1" "lib/vscode-reh-web-$VSCODE_TARGET/bin/$1"
  fix-bin-script "$1"
}

main() {
  cd "$(dirname "${0}")/../.."

  # A full VS Code typecheck can use several gigabytes. Fail closed unless the
  # process is inside the dedicated, memory-limited Tomoshibi build service.
  # Tomoshibi: macOS has no cgroup v2, no /proc/meminfo and no /sys/fs/cgroup,
  # so the Linux guard below can never pass there. Verify physical RAM with
  # sysctl instead, and still require the build to be declared deliberate.
  if [[ $(uname -s) == Darwin ]]; then
    local tomoshibi_darwin_mem_bytes
    tomoshibi_darwin_mem_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    if [[ ${TOMOSHIBI_ISOLATED_BUILD-} != 1 ]] ||
      [[ ! $tomoshibi_darwin_mem_bytes =~ ^[0-9]+$ ]] ||
      (( tomoshibi_darwin_mem_bytes < 12884901888 )); then
      echo "Refusing to build VS Code on macOS without TOMOSHIBI_ISOLATED_BUILD=1 and at least 12 GiB RAM."
      exit 1
    fi
  else
  local tomoshibi_build_cgroup
  local tomoshibi_build_cgroup_dir
  local tomoshibi_build_cgroup_root="/sys/fs/cgroup"
  local tomoshibi_build_mem_total_kib
  local tomoshibi_build_memory_max
  local tomoshibi_build_memory_max_file
  tomoshibi_build_cgroup=$(awk -F: '$1 == "0" { print $3 }' /proc/self/cgroup)
  tomoshibi_build_mem_total_kib=$(awk '$1 == "MemTotal:" { print $2 }' /proc/meminfo)
  tomoshibi_build_cgroup_dir="${tomoshibi_build_cgroup_root}${tomoshibi_build_cgroup}"
  tomoshibi_build_memory_max_file="${tomoshibi_build_cgroup_dir}/memory.max"
  if [[ ${TOMOSHIBI_ISOLATED_BUILD-} != 1 ]] ||
    [[ $tomoshibi_build_cgroup != *tomoshibi-code-build* ]] ||
    [[ $tomoshibi_build_cgroup == *code-server* ]] ||
    [[ ! $tomoshibi_build_mem_total_kib =~ ^[0-9]+$ ]] ||
    (( tomoshibi_build_mem_total_kib < 12582912 )) ||
    [[ ! -r $tomoshibi_build_memory_max_file ]]; then
    echo "Refusing to build VS Code outside a dedicated builder with at least 12 GiB RAM."
    exit 1
  fi
  read -r tomoshibi_build_memory_max < "$tomoshibi_build_memory_max_file"
  if [[ ! $tomoshibi_build_memory_max =~ ^[0-9]+$ ]] ||
    (( tomoshibi_build_memory_max < 6442450944 )) ||
    (( tomoshibi_build_memory_max > 12884901888 )); then
    echo "Refusing a Tomoshibi build cgroup without a 6-12 GiB finite memory limit."
    exit 1
  fi

  # A child's memory.max cannot raise an ancestor's effective limit. Check the
  # complete cgroup v2 ancestry so a 4 GiB parent cannot masquerade as an 8 GiB
  # dedicated builder. Unknown values and unreadable ancestors fail closed.
  while [[ $tomoshibi_build_cgroup_dir != "$tomoshibi_build_cgroup_root" ]]; do
    tomoshibi_build_memory_max_file="${tomoshibi_build_cgroup_dir}/memory.max"
    if [[ ! -r $tomoshibi_build_memory_max_file ]]; then
      echo "Refusing a builder whose effective cgroup v2 memory limit cannot be verified."
      exit 1
    fi
    read -r tomoshibi_build_memory_max < "$tomoshibi_build_memory_max_file"
    if [[ $tomoshibi_build_memory_max != max ]] &&
      { [[ ! $tomoshibi_build_memory_max =~ ^[0-9]+$ ]] ||
        (( tomoshibi_build_memory_max < 6442450944 )); }; then
      echo "Refusing a builder with an ancestor cgroup limited below 6 GiB."
      exit 1
    fi
    tomoshibi_build_cgroup_dir=${tomoshibi_build_cgroup_dir%/*}
    if [[ $tomoshibi_build_cgroup_dir != "$tomoshibi_build_cgroup_root" ]] &&
      [[ $tomoshibi_build_cgroup_dir != "$tomoshibi_build_cgroup_root"/* ]]; then
      echo "Refusing a builder with an invalid cgroup path."
      exit 1
    fi
  done
  fi

  source ./ci/lib.sh

  # Set the commit Code will embed into the product.json.  We need to do this
  # since Code looks for a `.git` directory inside lib/vscode, and there is none:
  # lib/vscode is a plain vendored directory of this repository.
  #
  # Also, we use code-server's commit rather than VS Code's otherwise it would
  # not update when only our patch files change, and that will cause caching
  # issues where the browser keeps using outdated code.
  export BUILD_SOURCEVERSION
  BUILD_SOURCEVERSION=$(git rev-parse HEAD)

  pushd lib/vscode

  if [[ ! ${VERSION-} ]]; then
    echo "VERSION not set. Please set before running this script:"
    echo "VERSION='0.0.0' npm run build:vscode"
    exit 1
  fi

  # Add the date, Tomoshibi display name and product defaults.
  #
  # This needs to be done before building as Code will read this file and embed
  # it into the client-side code.
  git checkout product.json             # Reset in case the script exited early.
  cp product.json product.original.json # Since jq has no inline edit.
  jq --slurp '.[0] * .[1] | del(.aiConfig, .trustedExtensionAuthAccess)' product.original.json <(
    cat << EOF
  {
    "enableTelemetry": false,
    "quality": "stable",
    "codeServerVersion": "$VERSION",
    "nameShort": "Code-Tomoshibi",
    "nameLong": "Code-Tomoshibi",
    "applicationName": "code-server",
    "dataFolderName": ".tomoshibi-code",
    "urlProtocol": "tomoshibi-code",
    "win32MutexName": "codeserver",
    "licenseUrl": "https://github.com/coder/code-server/blob/main/LICENSE",
    "win32DirName": "code-server",
    "win32NameVersion": "code-server",
    "win32AppUserModelId": "coder.code-server",
    "win32ShellNameShort": "c&ode-server",
    "darwinBundleIdentifier": "com.coder.code.server",
    "linuxIconName": "com.coder.code.server",
    "reportIssueUrl": "https://github.com/coder/code-server/issues/new",
    "documentationUrl": "https://go.microsoft.com/fwlink/?LinkID=533484#vscode",
    "keyboardShortcutsUrlMac": "https://go.microsoft.com/fwlink/?linkid=832143",
    "keyboardShortcutsUrlLinux": "https://go.microsoft.com/fwlink/?linkid=832144",
    "keyboardShortcutsUrlWin": "https://go.microsoft.com/fwlink/?linkid=832145",
    "introductoryVideosUrl": "https://go.microsoft.com/fwlink/?linkid=832146",
    "tipsAndTricksUrl": "https://go.microsoft.com/fwlink/?linkid=852118",
    "newsletterSignupUrl": "https://www.research.net/r/vsc-newsletter",
    "linkProtectionTrustedDomains": [],
    "builtInExtensions": [],
    "builtInExtensionsEnabledWithAutoUpdates": []
  }
EOF
  ) > product.json

  npm run gulp core-ci
  npm run gulp "vscode-reh-web-$VSCODE_TARGET${MINIFY:+-min}-ci"

  # Reset so if you develop after building you will not be stuck with the wrong
  # commit (the dev client will use `oss-dev` but the dev server will still use
  # product.json which will have `stable-$commit`).
  git checkout product.json

  popd

  pushd "lib/vscode-reh-web-$VSCODE_TARGET"
  # Make sure Code took the version we set in the environment variable.  Not
  # having a version will break display languages.
  if ! jq -e .commit product.json; then
    echo "'commit' is missing from product.json"
    exit 1
  fi
  popd

  # Set vars and fix paths.
  case $OS in
    windows)
      fix-bin-script remote-cli/code.cmd
      fix-bin-script helpers/browser.cmd
      ;;
    *)
      fix-bin-script remote-cli/code-server
      fix-bin-script helpers/browser.sh
      ;;
  esac

  # Include bin scripts for other platforms so we can use the right one in the
  # NPM post-install.

  # These provide a `code-server` command in the integrated terminal to open
  # files in the current instance.
  copy-bin-script remote-cli/code-darwin.sh
  copy-bin-script remote-cli/code-linux.sh
  copy-bin-script remote-cli/code.cmd

  # These provide a way for terminal applications to open browser windows.
  copy-bin-script helpers/browser-darwin.sh
  copy-bin-script helpers/browser-linux.sh
  copy-bin-script helpers/browser.cmd
}

main "$@"
