# comby-reducer

A program and data format reducer for arbitrary language syntax. Produces
human comprehensible output. Define declarative transformations with ease.

https://user-images.githubusercontent.com/888624/112451623-f4262380-8d12-11eb-81d9-a3b645f5b8f8.mp4

## Install

Install the `comby-reducer` binary on your path with
[npm](https://www.npmjs.com/get-npm):

```
npm install -g @comby-tools/comby-reducer
```

Alternatively, install `comby-reducer` in a local directory at
`./node_modules/.bin/comby-reducer`. If you see some warnings just ignore them.

```
npm install @comby-tools/comby-reducer
```

## Example

Let's say you just ran a program that crashed a compiler and want to find a
smaller example program that triggers the same crash. We'll simulate how to
find a smaller example program with `comby-reducer`.

**Step 1.** Clone the repository

| `git clone https://github.com/comby-tools/comby-reducer` |
|----------------------------------------------------------|


In [`example/program.c`](./example/program.c) you'll find the program we'll reduce:

```c
#include<stdio.h>
#include<string.h>

int main(int argc, char **argv) {
  if (argv[1]) {
      printf("I can't believe it's not butter");
  }
  // But I want to believe it's not butter...
  memset(NULL, 1, 1);
}
```

The `memset` statement causes a crash when we run this program. There's some
junk in there that we don't need to trigger the crash. Let's get started.

**Step 2.** Go into the `example` directory

| `cd example` |
|--------------|

Next, we'll use a "pretend compiler" that crashes when it "compiles" our
program (in reality, our "compiler" crashes when it runs a valid C program, not
when actually compiling it, but we'll suspend our greater knowledge for now).

**Step 3**: Run this command to crash the compiler

| `./compiler.sh program.c` |
|---------------------------|

You'll see something like this at the end:

```bash
./compiler.sh: line 7: 41936 Segmentation fault: 11  ./program
```

**Step 4**: Reduce the program

| `comby-reducer program.c --file /tmp/in.c --lang .c --transforms ../transforms -- ./compiler.sh @@` |
|-----------------------------------------------------------------------------------------------------|

You should see:

```
[+] Loaded 22 transformation rules
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

Nice, our program is smaller! `comby-reduce` found  that a smaller valid
program keeps crashing our "compiler", but without the cruft.

Let's break down the command invocation:

- The part after `--` is the command we want to run that causes a crash. In our case, `./compiler.sh @@`
  - The `@@` part is substituted with a file containing a program (like `program.c`)

- `--file /tmp/in.c` says that the `@@` we substitute should be `/tmp/in.c`. The `.c` extension may matter if our compiler expects a file with a `.c` extesion, for example.

- `--lang .c` says that the language we want to reduce is C-like. `comby-reducer` uses language definitions to parse input according to some language. This matters so that our transforms can accurately match strictly code blocks and avoids bothering with not-actually-code-syntax that come up in comments and strings. This may not be a big deal. You can use `--lang .generic` if you have some DSL or smart contract language. Here's the list of [specific language parsers](https://comby.dev/docs/overview#does-it-work-on-my-language).

- `--transforms ../transforms` points to our directory of transformations that attempt to reduce the program. Transformations are specified with in a [TOML format](https://comby.dev/docs/configuration#toml-format) using [`comby` syntax](https://comby.dev/docs/syntax-reference). See [Usage](#Usage) below for more details.

## Usage

### Transformations

`comby-reducer` makes it easy to write rules for transformation using [comby syntax](https://comby.dev/docs/syntax-reference).
A handful of defaults are included in
[`transforms/config.toml`](transforms/config.toml) that will probably get you
very far already. Here are some examples.

```toml
[empty_paren]
match='(:[1])'
rewrite='()'
rule='where nested'
```

This transform matches any content between balanced parentheses (including
newlines) and deletes the content. The `:[1]` is a variable that can be used in
the rewrite part. By default, `comby-reducer` will try to apply this
transformation at the top-level of a file, wherever it sees `(...)`. The
`rule='where nested'` tells `comby-reducer` that it should also attempt to
reduce nested matches of `(...)` inside other matched `(...)`. In general,
parentheses are a common syntax to nest expressions in programs, so it makes
sense to add `rule='where nested'.

Another transform removes the first element from some syntax:

```toml
[preserve_first_paren_element]
match='(:[1],:[2])'
rewrite='(:[1])'
```

Program syntax often use call or function-like syntax that comma-separate
parameters or arguments inside parenthes. This transformation attempts to remove
elements in such syntax. This transform doesn't have a `rule` part, since it
might not be as fruitful to attempt nested reductions inside of `:[1]` or
`:[2]`. But, we could easily add it.

A last example uses a special form `:[var:e]` which matches "expression-like"
syntax.

```toml
[remove_first_expression_for_colon_sep_space]
match=':[1:e], :[2:e]'
rewrite=':[2]'
```

Expression-like syntax matches contiguous non-whitespace characters like `foo`
or `foo.bar`, as well as contiguous character sequences that include valid code
block structures like balanced parentheses in `function(foo, bar)` (notice how
whitespace is allowed inside the parentheses). The transform above will attempt
to remove expression-like syntax between commas, which often separate
expressions inside objects, records, or lists.

**More info.** You can learn more about the underlying matching engine at
[comby.dev](https://comby.dev/docs/basic-usage). You can try out
transformations on [comby.live](bit.ly/3lOmS4W) to check that a transformation
behaves the way you want it to.

**Limitations.** Although regular expression matching is possible with `:[...]`
syntax in [`comby`](https:/github.com/comby-tools/comby), it's **not yet
possible to write regular expression holes in `comby-reducer` transforms.**

### Tips

#### Customize crash criteria with scripts

`comby-reducer` expects a program to exit with signal `139` or `134` to consider
it a crash. Many programs that crash won't exit with these values, however. For
example, the [Solidity compiler](https://github.com/ethereum/solidity) exits
with a signal `1`. Even more challenging, the exit signal `1` may mean that the
program crashes, or that the program doesn't compile (and we want the program to
still compile). The exit signal `1` is not a reliable way to know that the
program crashed "for real". What to do?

It'll depend on your program, but you generally want to define some criteria that
constitutes a valid crash, and wrap that logic in a script. For Solidity, a valid program
that crashes the compiler will emit something like:

```
Internal compiler error during compilation:
/solidity/libsolidity/ast/Types.h(797): Throw in function virtual std::unique_ptr<ReferenceType>
```

We can use this information in a script, and exit with the expected crash code
to signal a crash. Here's one I used before, called `compile.sh`, that will exit the script with
signal `139` when it sees the `Internal compiler error` message:

```bash
#!/bin/bash

RESULT=$(~/solidity/build/solc/solc $1 2>&1)
MATCH=$(echo $RESULT | grep -c "Internal compiler error")
if [ $MATCH == 0 ]; then
        exit 0 # no match, program doesn't cause expected crash
fi

exit 139
```

You can get very fancy with your script, and can use it further refine program
reduction. For more inspiration read up on [interestingness tests](https://embed.cs.utah.edu/creduce/using/) covered by
[C-reduce](https://github.com/csmith-project/creduce).

#### Output

Output the final reduced program by piping the `comby-reducer` command to a
file. The final program is sent to `stdout`, the informative messages are
printed to `stderr`.

### Options

Some additional command line flags:

**`--record`** is an optional flag that emits the program at each step of a
successful reduction, in the form `<num>.step`, in the current directory. You
can replay the transformations by running `comby-reducer-replay` in the current
directory. See more on [comby-reducer-replay](#comby-reducer-replay) below.

**`--lang <extension>`** is a flag that determines how the source file is
  parsed. Using an extension like `.c` or `.go` will make `comby-reducer` parse
  the input according to that language.


<details>
  <summary>click to expand the list of accepted extensions</summary>

```
.s        Assembly
.sh       Bash
.c        C
.cs       C#
.css      CSS
.dart     Dart
.dyck     Dyck
.clj      Clojure
.elm      Elm
.erl      Erlang
.ex       Elixir
.f        Fortran
.fsx      F#
.go       Go
.html     HTML
.hs       Haskell
.java     Java
.js       JavaScript
.jsx      JSX
.json     JSON
.jsonc    JSONC
.gql      GraphQL
.dhall    Dhall
.jl       Julia
.kt       Kotlin
.tex      LaTeX
.lisp     Lisp
.nim      Nim
.ml       OCaml
.paren    Paren
.pas      Pascal
.php      PHP
.py       Python
.re       Reason
.rb       Ruby
.rs       Rust
.scala    Scala
.sql      SQL
.swift    Swift
.txt      Text
.ts       TypeScript
.tsx      TSX
.xml      XML
.generic  Generic
```

</details>

**`--debug`** will emit the reduced program after each step, and the transformation that succeeded to `stderr`.

### comby-reducer-replay

`comby-reducer-replay` is the answer to "How was my program reduced?".
`comby-reducer-replay` is installed along with `comby-reducer` and should be
available based on how you installed it.

After running `comby-reducer` with `--record`, simply run `comby-reducer-replay`
in the current directory, and step through the transformed program at each step
(left and right arrow keys). Try running `comby-reducer-replay` inside
[replay-example](./replay-example) to step through a recording of a previous
crash reduction for a Solidity compiler bug.

By default replays will use `git diff` to render changes. To override the
default, a custom diff command can be entered on the command-line like this:

```bash
comby-reducer-replay colordiff -y
```

where `colordiff -y` shows a side-by-side colored diff of changes. Underneath
the hood, the `.step` files will be appended to the command, like `colordiff -y
000.step 001.step`

Some sensible default flags are included for common diff tools, which you can
explore by entering only the name of the tool and no other extra command line
flags:

```bash
comby-reducer-replay git               # the default
comby-reducer-replay patdiff           # an enhanced patience diff tool
comby-reducer-replay colordiff         # colordiff, configured to render side-by-side
comby-reducer-replay diff              # plain old diff, configured to render side-by-side
```

I recommend installing [`patdiff`](https://github.com/janestreet/patdiff) for
an enhanced viewing experience. `patdiff` simply understands diffs a bit
better. To get `patdiff`, you'll have to:

- [Install opam](https://opam.ocaml.org/doc/Install.html) with

  `sh <(curl -sL https://raw.githubusercontent.com/ocaml/opam/master/shell/install.sh)`

- Run `eval $(opam env)`
- Run `opam install patdiff`

And `patdiff` should now be available on your path.

### Development

- Install `npm`.
- Install `npx`.

```
npm i typescript @types/node minimist @types/minimist @iarna/toml @types/iarna__toml
npx tsc
```
