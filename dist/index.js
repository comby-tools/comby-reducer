#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._rewrite = exports._substitute = exports._match = void 0;
var fs = require("fs");
var exec = require("child_process");
var minimist = require("minimist");
var toml_1 = require("@iarna/toml");
var path = require("path");
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
            var content = fs.readFileSync("".concat(transformsDir, "/").concat(file), "utf8");
            var toml = (0, toml_1.parse)(content);
            for (var _i = 0, _a = Object.entries(toml); _i < _a.length; _i++) {
                var _b = _a[_i], value = _b[1];
                transform_1.push(value);
            }
        });
        console.error("[+] Loaded ".concat(transform_1.length, " transformation rules"));
        if (DEBUG) {
            console.error("[D] ".concat(JSON.stringify(transform_1)));
        }
        return transform_1;
    }
    catch (error) {
        console.error("[-] Could not parse file in ".concat(transformsDir, ": ").concat(error));
        throw "";
    }
};
var test = function (source, command, inFile, stdin) {
    if (DEBUG) {
        console.error("[D] Testing for crash:\n".concat(source));
    }
    if (!stdin) {
        fs.writeFileSync(inFile, source);
        command = command.replace('@@', inFile);
    }
    if (DEBUG) {
        console.error("[D] Running command: ".concat(command));
    }
    try {
        if (!stdin) {
            exec.execSync(command, { stdio: "ignore" }); // ignore "Segmentation fault" output.
        }
        else {
            exec.execSync(command, { input: source });
        }
    }
    catch (error) {
        if (error.status === 139 || error.status == 134) {
            if (DEBUG) {
                console.error("[D] Still crashing: ".concat(error));
                console.error("[D] Good for ".concat(source));
            }
            return Result.Good;
        }
        if (DEBUG) {
            console.error("[D] Other error: ".concat(error));
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
var transform = function (source, transform, command, inFile, stdin) {
    var matches = _match(source, transform.match);
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var m = matches_1[_i];
        var substituted = _substitute(transform.rewrite, m.environment);
        var result = replaceRange(source, m.range, substituted);
        if (result.length < source.length && test(result, command, inFile, stdin) === Result.Good) { // length test is redundant if transformations always reduce.
            if (DEBUG) {
                console.error("[D] Reduction for ".concat(transform.match, " ").concat(transform.rule || '', " -> ").concat(transform.rewrite, " @ ").concat(JSON.stringify(m.range), "\n").concat(result));
            }
            if (RECORD) {
                fs.writeFileSync("".concat(STEP.toString().padStart(3, '0'), ".step"), result);
            }
            STEP = STEP + 1;
            return result;
        }
    }
    return undefined;
};
var reduce = function (current, transforms, command, inFile, stdin) {
    if (transforms.length === 0) {
        return current; // Done.
    }
    var previous = current;
    var next = undefined;
    do {
        previous = next === undefined ? previous : next;
        next = transform(previous, transforms[0], command, inFile, stdin);
    } while (next !== undefined);
    return reduce(previous, transforms.slice(1, transforms.length), command, inFile, stdin);
};
var args = minimist(process.argv.slice(3), {
    default: {
        debug: false,
        file: '/tmp/85B6B886',
        transforms: 'transforms',
        language: 'lang',
        version: '1.0.0',
        record: false,
        stdin: false,
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
    var extension = '';
    try {
        input = fs.readFileSync(process.argv[2]).toString();
        extension = path.extname(process.argv[2]);
    }
    catch (e) {
        console.error("Could not read content from ".concat(process.argv[2]));
        process.exit(1);
    }
    if (input === '') {
        console.error('Empty input');
        process.exit(1);
    }
    var inFile = args.file === '/tmp/85B6B886' && extension.length > 0
        ? "".concat(args.file, ".").concat(extension)
        : args.file;
    var command = process.argv.slice(separatorIndex + 1, process.argv.length).join(' ');
    if (DEBUG) {
        console.error("Running command '".concat(command, "' on file '").concat(inFile));
    }
    if (test(input, command, inFile, args.stdin) === Result.Bad) {
        console.error("Program doesn't crash on this input (no exit status 139 or 134).");
        process.exit(1);
    }
    var transforms = loadRules(args.transforms);
    var previous = input;
    var pass = 0;
    do {
        console.error("[+] Did pass ".concat(pass));
        previous = input;
        input = reduce(input, transforms, command, inFile, args.stdin);
        pass = pass + 1;
    } while (input.length < previous.length);
    console.error('[+] Result:');
    console.log("".concat(input));
};
main();
