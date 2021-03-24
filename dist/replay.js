#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var exec = require("child_process");
var readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
var STEP = -1;
var getDiff = function (reverse) {
    var left = STEP.toString().padStart(3, '0') + ".step";
    var right = (STEP + 1).toString().padStart(3, '0') + ".step";
    if (!fs.existsSync(left) && !fs.existsSync(right)) {
        console.log("That's all folks. Press <- or backspace to go back.");
        return;
    }
    try {
        exec.execSync("patdiff -keep-whitespace " + (reverse ? '-reverse' : '') + " " + left + " " + right);
    }
    catch (error) {
        console.log(error.stdout.toString());
    }
    return "asdf";
};
process.stdin.on('keypress', function (str, key) {
    if (key.ctrl && key.name === 'c') {
        process.exit();
    }
    else if (key.name === 'space' || key.name == 'right' || key.name == 'return') {
        console.clear();
        STEP = STEP + 1;
        var diff_1 = getDiff();
        if (!diff_1) {
            STEP = STEP - 1;
            return;
        }
        // console.log(diff)
    }
    else if (key.name === 'left' || key.name === 'backspace') {
        if (STEP <= 0) {
            STEP = 0;
            return;
        }
        console.clear();
        STEP = STEP - 1;
        var diff_2 = getDiff(true);
        if (!diff_2) {
            STEP = STEP + 1;
            return;
        }
        // console.log(diff)
    }
});
console.clear();
STEP = STEP + 1;
var diff = getDiff();
