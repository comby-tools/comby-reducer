#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._rewrite = exports._substitute = exports._match = void 0;
var fs = require("fs");
var exec = require("child_process");
var minimist = require("minimist");
var toml_1 = require("@iarna/toml");
// credits to the slimmest sag.
var comby = require('../js/comby.js');
var DEBUG = false;
var LANGUAGE = '.generic';
var RECORD = false;
var STEP = 0;
function _match(source, matchTemplate, matcher, rule) {
    if (matcher === void 0) { matcher = LANGUAGE; }
    if (rule === void 0) { rule = 'where true'; }
    return JSON.parse(comby.match(source, matchTemplate, matcher, rule));
}
exports._match = _match;
function _substitute(template, environment) {
    return comby.substitute(template, JSON.stringify(environment));
}
exports._substitute = _substitute;
function _rewrite(source, matchTemplate, rewriteTemplate, matcher, rule) {
    if (matcher === void 0) { matcher = LANGUAGE; }
    if (rule === void 0) { rule = 'where true'; }
    return comby.rewrite(source, matchTemplate, rewriteTemplate, matcher, rule);
}
exports._rewrite = _rewrite;
var Result;
(function (Result) {
    Result["Good"] = "Good";
    Result["Bad"] = "Bad";
})(Result || (Result = {}));
var loadRules = function (transformsDir) {
    try {
        var transform_1 = [];
        var ruleFiles = fs.readdirSync(transformsDir);
        ruleFiles.forEach(function (file) {
            if (!file.endsWith('.toml')) {
                return;
            }
            var content = fs.readFileSync(transformsDir + "/" + file, "utf8");
            var toml = toml_1.parse(content);
            for (var _i = 0, _a = Object.entries(toml); _i < _a.length; _i++) {
                var _b = _a[_i], value = _b[1];
                transform_1.push(value);
            }
        });
        console.error("[+] Loaded " + transform_1.length + " transformation rules");
        if (DEBUG) {
            console.error("[D] " + JSON.stringify(transform_1));
        }
        return transform_1;
    }
    catch (error) {
        console.error("[-] Could not parse file in " + transformsDir + ": " + error);
        throw "";
    }
};
var test = function (source, command, inFile) {
    if (DEBUG) {
        console.error("[D] Testing for crash:\n" + source);
    }
    fs.writeFileSync(inFile, source);
    command = command.replace('@@', inFile);
    if (DEBUG) {
        console.error("[D] Running command: " + command);
    }
    try {
        exec.execSync(command, { stdio: "ignore" }); // ignore "Segmentation fault" output.
    }
    catch (error) {
        if (error.status === 139 || error.status == 134) {
            if (DEBUG) {
                console.error("[D] Still crashing: " + error);
                console.error("[D] Good for " + source);
            }
            return Result.Good;
        }
        if (DEBUG) {
            console.error("[D] Other error: " + error);
        }
    }
    if (DEBUG) {
        console.error("[D] No crash.");
    }
    return Result.Bad;
};
var replaceRange = function (source, _a, replacementFragment) {
    var start = _a.start, end = _a.end;
    var before = source.slice(0, start.offset);
    var after = source.slice(end.offset, source.length);
    return before + replacementFragment + after;
};
var transform = function (source, transform, command, inFile) {
    var matches = _match(source, transform.match);
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var m = matches_1[_i];
        var substituted = _substitute(transform.rewrite, m.environment);
        var result = replaceRange(source, m.range, substituted);
        if (result.length < source.length && test(result, command, inFile) === Result.Good) { // length test is redundant if transformations always reduce.
            if (DEBUG) {
                console.error("[D] Reduction for " + transform.match + " " + (transform.rule || '') + " -> " + transform.rewrite + " @ " + JSON.stringify(m.range) + "\n" + result);
            }
            if (RECORD) {
                fs.writeFileSync(STEP.toString().padStart(3, '0') + ".step", result);
            }
            STEP = STEP + 1;
            return result;
        }
    }
    return undefined;
};
var reduce = function (current, transforms, command, inFile) {
    if (transforms.length === 0) {
        return current; // Done.
    }
    var previous = current;
    var next = undefined;
    do {
        previous = next === undefined ? previous : next;
        next = transform(previous, transforms[0], command, inFile);
    } while (next !== undefined);
    return reduce(previous, transforms.slice(1, transforms.length), command, inFile);
};
var args = minimist(process.argv.slice(3), {
    default: {
        debug: false,
        file: '/tmp/in',
        transforms: 'transforms',
        language: 'language',
        version: '1.0.0',
        record: false,
    },
});
var main = function () {
    if (process.argv[2] == '--help' || process.argv[2] == '-h' || process.argv[2] == '-help') {
        console.error("comby-reduce <file-to-reduce> -- command @@");
        console.error('Arg defaults: ', args);
        process.exit(1);
    }
    if (process.argv[2] == '--version' || process.argv[2] == '-v' || process.argv[2] == '-version') {
        console.log(args.version);
        process.exit(1);
    }
    var separatorIndex = process.argv.indexOf('--');
    if (separatorIndex < 0) {
        console.error('No -- seen. Enter a command like: comby-reduce <file-to-reduce> -- command @@');
        process.exit(1);
    }
    if (!process.argv[2]) {
        console.error("No file. Invoke like: comby-reduce <file-to-reduce> -- command @@");
        process.exit(1);
    }
    DEBUG = args.debug;
    LANGUAGE = args.language;
    RECORD = args.record;
    var input = '';
    try {
        input = fs.readFileSync(process.argv[2]).toString();
    }
    catch (e) {
        console.error("Could not read content from " + process.argv[2]);
        process.exit(1);
    }
    if (input === '') {
        console.error('Empty input');
        process.exit(1);
    }
    var inFile = args.file;
    var command = process.argv.slice(separatorIndex + 1, process.argv.length).join(' ');
    if (test(input, command, inFile) === Result.Bad) {
        console.error("Program doesn't crash on this input (no exit status 139 or 134).");
        process.exit(1);
    }
    var transforms = loadRules(args.transforms);
    var previous = input;
    var pass = 0;
    do {
        console.error("[+] Did pass " + pass);
        previous = input;
        input = reduce(input, transforms, command, inFile);
        pass = pass + 1;
    } while (input.length < previous.length);
    console.error('[+] Result:');
    console.log("" + input);
};
main();
