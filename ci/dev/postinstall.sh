#!/usr/bin/env bash
set -euo pipefail

# Install dependencies in $1.
install-deps() {
  local args=()
  if [[ ${CI-} ]]; then
    args+=(ci)
  else
    args+=(install)
  fi
  # If there is no package.json then npm will look upward and end up installing
  # from the root resulting in an infinite loop (this can happen with an
  # incomplete checkout).
  if [[ ! -f "$1/package.json" ]]; then
    echo "$1/package.json is missing."
    echo "This repository vendors lib/vscode as a plain directory, not a submodule,"
    echo "so a normal 'git clone' should already contain it. Check out the whole tree."
    exit 1
  fi
  pushd "$1"
  echo "Installing dependencies for $PWD"
  npm "${args[@]}"
  popd
}

main() {
  cd "$(dirname "$0")/../.."
  source ./ci/lib.sh

  install-deps test
  install-deps test/e2e/extensions/test-extension
  # We don't need these when running the integration tests
  # so you can pass SKIP_SUBMODULE_DEPS
  if [[ ! ${SKIP_SUBMODULE_DEPS-} ]]; then
    install-deps lib/vscode
  fi
}

main "$@"
