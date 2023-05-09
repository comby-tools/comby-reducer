#!/usr/bin/env node

import fs = require('fs')
import exec = require('child_process');
const readline = require('readline');

readline.emitKeypressEvents(process.stdin);

process.stdin.setRawMode(true);

let STEP = -1

const GITDIFF = exec.spawnSync('which', ['git']).status === 0;
const PATDIFF = exec.spawnSync('which', ['patdiff']).status === 0;
const COLORDIFF = exec.spawnSync('which', ['colordiff']).status === 0;
const DIFF = exec.spawnSync('which', ['diff']).status === 0;

const PREFERRED_DIFF = process.argv.slice(2).join(' ')

const command = (left:string, right:string, reverse?:boolean): string => {
    const gitdiff = `git --no-pager diff --color --no-index --unified=10 ${left} ${right}`
    const patdiff = `patdiff -context 10 -keep-whitespace ${reverse ? '-reverse' : ''} ${left} ${right}`
    const colordiff =  `colordiff -y ${reverse ? right + ' ' + left : left + ' ' + right }`
    const diff = `diff -y ${reverse ? right + ' ' + left : left + ' ' + right }`

    if (PREFERRED_DIFF.match(/^git$/i)) {
        return gitdiff
    }
    if (PREFERRED_DIFF.match(/^patdiff$/i)) {
        return patdiff
    }
    if (PREFERRED_DIFF.match(/^colordiff$/i)) {
        return colordiff
    }
    if (PREFERRED_DIFF.match(/^diff$/i)) {
        return diff
    }

    if (PREFERRED_DIFF.length > 0) {
        return `${PREFERRED_DIFF} ${left} ${right}`
    }

    if (GITDIFF) {
        return gitdiff
    }
    if (PATDIFF) {
        return patdiff
    }
    if (COLORDIFF) {
        return colordiff
    }
    if (DIFF) {
        return diff
    }
    throw "No diff tool detected. Try specifying one on the command line."
}

const getDiff = (reverse?:boolean) : string | undefined => {
    const left = `${STEP.toString().padStart(3, '0')}.step`
    const right = `${(STEP+1).toString().padStart(3, '0')}.step`
    if (!fs.existsSync(right)) {
        console.log(fs.readFileSync(left).toString())
        console.log('------------------------------------------------------------------')
        console.log('This is the end. Press <- or backspace to go back. Ctrl-c to exit.')
        return
    }

    try {
        exec.execSync(command(left,right,reverse))
    } catch (error: any) {
        console.log(error.stdout.toString())
    }
    return "valid"
}

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    process.exit();
  } else if (key.name === 'space' || key.name == 'right' || key.name == 'return') {
    console.clear()
    STEP = STEP + 1
    const diff = getDiff()
    if (!diff) {
        STEP = STEP - 1
        return
    }
  } else if (key.name === 'left' || key.name === 'backspace') {
    if (STEP <= 0) {
        STEP = 0
        return
    }
    console.clear()
    STEP = STEP - 1
    const diff = getDiff(true)
    if (!diff) {
        STEP = STEP + 1
        return
    }
  }
});

if (!fs.existsSync('000.step')) {
    console.log('Expecting a file 000.step to start replay. Use comby-reducer with --record to generate these files.')
    process.exit(1)
}
console.clear()
STEP = STEP + 1
const diff = getDiff()
