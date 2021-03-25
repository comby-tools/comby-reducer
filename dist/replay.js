#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var exec = require("child_process");
var readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
var STEP = -1;
var GITDIFF = exec.spawnSync('which', ['git']).status === 0;
var PATDIFF = exec.spawnSync('which', ['patdiff']).status === 0;
var COLORDIFF = exec.spawnSync('which', ['colordiff']).status === 0;
var DIFF = exec.spawnSync('which', ['diff']).status === 0;
var PREFERRED_DIFF = process.argv.slice(2).join(' ');
var command = function (left, right, reverse) {
    var gitdiff = "git --no-pager diff --color --no-index --unified=10 " + left + " " + right;
    var patdiff = "patdiff -context 10 -keep-whitespace " + (reverse ? '-reverse' : '') + " " + left + " " + right;
    var colordiff = "colordiff -y " + (reverse ? right + ' ' + left : left + ' ' + right);
    var diff = "diff -y " + (reverse ? right + ' ' + left : left + ' ' + right);
    if (PREFERRED_DIFF.match(/^git$/i)) {
        return gitdiff;
    }
    if (PREFERRED_DIFF.match(/^patdiff$/i)) {
        return patdiff;
    }
    if (PREFERRED_DIFF.match(/^colordiff$/i)) {
        return colordiff;
    }
    if (PREFERRED_DIFF.match(/^diff$/i)) {
        return diff;
    }
    if (PREFERRED_DIFF.length > 0) {
        return PREFERRED_DIFF + " " + left + " " + right;
    }
    if (GITDIFF) {
        return gitdiff;
    }
    if (PATDIFF) {
        return patdiff;
    }
    if (COLORDIFF) {
        return colordiff;
    }
    if (DIFF) {
        return diff;
    }
    throw "No diff tool detected. Try specifying one on the command line.";
};
var getDiff = function (reverse) {
    var left = STEP.toString().padStart(3, '0') + ".step";
    var right = (STEP + 1).toString().padStart(3, '0') + ".step";
    if (!fs.existsSync(right)) {
        console.log(fs.readFileSync(left).toString());
        console.log('------------------------------------------------------------------');
        console.log('This is the end. Press <- or backspace to go back. Ctrl-c to exit.');
        return;
    }
    try {
        exec.execSync(command(left, right, reverse));
    }
    catch (error) {
        console.log(error.stdout.toString());
    }
    return "valid";
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
    }
});
console.clear();
STEP = STEP + 1;
var diff = getDiff();
