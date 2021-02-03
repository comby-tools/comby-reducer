all:
	npx tsc 
	./build.sh

example:
	gcc -o program program.c
	node dist/index.js example/input -- ./program @@

watch:
	npx tsc -w

clean:
	rm -rf dist program

install:
	npm i typescript --save-dev
	npx tsc --init

dev:
	npm i typescript --save-dev
	npx tsc --init
	npm i eslint --save-dev
	./node_modules/.bin/eslint --init
	npm i --save-dev @types/node
	npm i --save-dev minimist
	npm i --save-dev @types/minimist
	npm install @iarna/toml --save-dev
	npm i --save-dev @types/iarna__toml

.PHONY: example
