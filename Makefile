.DEFAULT_GOAL := help

BUN ?= bun

.PHONY: help install build typecheck test test-js validate coverage bump pack-release

help:
	@printf '%s\n' \
	  'Common tasks:' \
	  '  make install       Install dependencies' \
	  '  make build         Build extension pages and scripts' \
	  '  make typecheck     Check TypeScript types' \
	  '  make test          Run Bun tests' \
	  '  make test-js       Run Node tests for the URL prompt codec' \
	  '  make validate      Run typecheck, Bun tests, and build in order' \
	  '  make coverage      Collect Bun and Node test coverage' \
	  '  make bump          Increment the manifest patch version' \
	  '  make pack-release  Build without debug logging and create a release ZIP (requires 7z)'

install:
	$(BUN) install

build:
	$(BUN) run build

typecheck:
	$(BUN) run typecheck

test:
	$(BUN) test

test-js:
	$(BUN) run test:js

# Keep the validation steps sequential, including when make runs with -j.
validate:
	$(BUN) run validate

coverage:
	$(BUN) run coverage

bump:
	$(BUN) run bump

pack-release:
	$(BUN) run pack:release
