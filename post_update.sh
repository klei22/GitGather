#!/usr/bin/env bash
# Example post-update script that also updates a nested repo
set -e

pushd nanogpt >/dev/null
  git fetch --all
  git pull --ff-only
popd >/dev/null

