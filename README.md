# comby-reducer

A reducer for arbitrary language syntax that produces human comprehensible
programs. Define declarative transformations with ease.

## Example

Let's say you just ran a program that crashed a compiler and want to find a
smaller example program that triggers the same crash. Let's simulate how
to find a smaller example program with `comby-reduce`.

In [`example/program.c`](./example/program.c) you'll find the program we'll reduce:

```
#include<string.h>

void main(int argc, char **argv) {
  if (argv[1]) {
      printf("I can't believe it's not butter");
  }
  // But I want to believe it's not butter...
  memset(NULL, 1, 1);
}
```

The `memset` statement causes a crash when we run this program. There's some junk in there
that we don't need to understand the crash. Let's get started.

**Step 1**: `cd example` 

Next, we'll use a "pretend compiler" that crashes when it "compiles" our
program (in reality, our "compiler" crashes when it runs the program, not
when actually compiling it, but let's suspend our greater knowledge for now).

**Step 2**: run `./compiler.sh program.c`. to see the compiler crash. You'll see something like this at the end:

```bash
...
./compiler.sh: line 7: 41936 Segmentation fault: 11  ./program
```

**Step 3**: run `node ../dist/index.js program.c --file /tmp/in.c --debug --transforms ../transforms -- ./compiler.sh @@`

KomodoHype! Our program is smaller, `comby-reduce` found  that a smaller
program keeps crashing our "compiler", but without the cruft:

```
[+] Loaded 19 transformation rules
[+] Did pass 0 pass
[+] Did pass 1 pass
[+] Did pass 2 pass
[+] Did pass 3 pass
[+] Result:
#include<string.h>
void main() {
  memset(NULL, 1, 1);
}
```

Let's break down some of the command:

- The part after `--` is the command we want to run that causes a crash. In our case, `./compiler.sh @@`
  - The `@@` part is substituted with a file containing a program (like `program.c`)

- `--file /tmp/in.c` says that the `@@` we substitute should be `/tmp/in.c`. The `.c` extension may matter if ourcompiler expects this extesion, for example.

- `--transforms ../transforms` points to our directory containing transformations that attempt to reduce the program

- `--language .c` says that the language we want to reduce is C-like. This matters so that our transforms can accurately match strictly code blocks and avoid bother with not-actually-code-syntax that come up in comments and strings. This may not be a big deal. You can use `--language .generic` if you have some DSL or smart contract language, or define your own syntax (more on that later).

## Usage 

### Development

- Install `npm`.
- Install `npx`.

```
npm i typescript @types/node minimist @types/minimist @iarna/toml @types/iarna__toml
npx tsc
```
