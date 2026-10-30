#!/bin/sh
# Stackship: the runtime image has no bun. Remove bun lockfiles from the built image
# so the container starts with "npm start". The repo itself is unchanged.
rm -f bun.lock bun.lockb
