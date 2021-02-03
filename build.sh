#!/bin/sh

# Fix up dependency on comby, couldn't figure this out in TypeScript, probably need some tsconfig option to make it work.
cp js/comby.js dist
comby 'var toml_1 = require(:[1]);' 'var toml_1 = require(:[1]); var comby = require("./comby");' dist/index.js -i
