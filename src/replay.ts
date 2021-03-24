#!/usr/bin/env node

import fs = require('fs')
import exec = require('child_process');
const readline = require('readline');

readline.emitKeypressEvents(process.stdin);

process.stdin.setRawMode(true);

let STEP = -1

const getDiff = (reverse?:boolean) : string | undefined => {
    const left = `${STEP.toString().padStart(3, '0')}.step`
    const right = `${(STEP+1).toString().padStart(3, '0')}.step`
    if (!fs.existsSync(left) && !fs.existsSync(right)) {
        console.log("That's all folks. Press <- or backspace to go back.")
        return
    }

    try {
        exec.execSync(`patdiff -keep-whitespace ${reverse ? '-reverse' : ''} ${left} ${right}`)
    } catch (error) {
        console.log(error.stdout.toString())
    }
    return "asdf"
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
    // console.log(diff)
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
    // console.log(diff)
  }
});

console.clear()
STEP = STEP + 1
const diff = getDiff()