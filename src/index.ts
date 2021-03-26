#!/usr/bin/env node

import fs = require('fs')
import exec = require('child_process');
import minimist = require('minimist')
import { parse } from '@iarna/toml'
import path = require('path')

// credits to the slimmest sag.
var comby = require('../js/comby.js')

let DEBUG = false
let LANGUAGE = '.generic'
let RECORD = false
let STEP = 0

export interface Match {
    range: Range
    environment: Environment
    matched: string
}

export interface Environment {
    entries: Entry[]
}

export interface Entry {
    variable: string,
    value: string,
    range: Range
}

export interface Location {
    line: number,
    column: number,
    offset: number,
}

export interface Range {
    start: Location,
    end: Location,
}


export function _match(source: string, matchTemplate: string, matcher: string = LANGUAGE, rule = 'where true'): Match[] {
    return (JSON.parse(comby.match(source, matchTemplate, matcher, rule)) as Match[])
}

export function _substitute(template: string, environment: Environment): string {
    return comby.substitute(template, JSON.stringify(environment))
}

export function _rewrite(source: string, matchTemplate: string, rewriteTemplate: string, matcher: string = LANGUAGE, rule = 'where true'): string {
    return comby.rewrite(source, matchTemplate, rewriteTemplate, matcher, rule)
}


interface Transform {
    match: string,
    rewrite: string,
    rule?: string
}

enum Result {
    Good = 'Good',
    Bad = 'Bad',
}

const loadRules = (transformsDir: string): Transform[] => {
    try {
        const transform: Transform[] = []
        const ruleFiles = fs.readdirSync(transformsDir);
        ruleFiles.forEach(file => {
            if (!file.endsWith('.toml')) {
                return
            }
            const content = fs.readFileSync(`${transformsDir}/${file}`, "utf8");
            const toml = parse(content);
            for (const [, value] of Object.entries(toml)) {
                transform.push((value as unknown) as Transform);
            }
        });
        console.error(`[+] Loaded ${transform.length} transformation rules`);
        if (DEBUG) {
            console.error(`[D] ${JSON.stringify(transform)}`)
        }
        return transform
    } catch (error) {
        console.error(`[-] Could not parse file in ${transformsDir}: ${error}`)
        throw ""
    }
}

const test = (source: string, command: string, inFile: string): Result => {
    if (DEBUG) {
        console.error(`[D] Testing for crash:\n${source}`)
    }
    fs.writeFileSync(inFile, source);
    command = command.replace('@@', inFile)
    if (DEBUG) {
        console.error(`[D] Running command: ${command}`)
    }
    try {
        exec.execSync(command, { stdio: "ignore" }) // ignore "Segmentation fault" output.
    } catch (error) {
        if (error.status === 139 || error.status == 134) {
            if (DEBUG) {
                console.error(`[D] Still crashing: ${error}`)
                console.error(`[D] Good for ${source}`)
            }
            return Result.Good
        }
        if (DEBUG) {
            console.error(`[D] Other error: ${error}`)
        }
    }
    if (DEBUG) {
        console.error(`[D] No crash.`)
    }
    return Result.Bad
}

const replaceRange = (source: string, { start, end }: Range, replacementFragment: string) => {
    const before = source.slice(0, start.offset);
    const after = source.slice(end.offset, source.length);
    return before + replacementFragment + after;
}

const transform = (source: string, transform: Transform, command: string, inFile: string): string | undefined => {
    const matches: Match[] = _match(source, transform.match)
    for (const m of matches) {
        const substituted = _substitute(transform.rewrite, m.environment)
        const result = replaceRange(source, m.range, substituted)
        if (result.length < source.length && test(result, command, inFile) === Result.Good) { // length test is redundant if transformations always reduce.
            if (DEBUG) {
                console.error(`[D] Reduction for ${transform.match} ${transform.rule || ''} -> ${transform.rewrite} @ ${JSON.stringify(m.range)}\n${result}`)
            }
            if (RECORD) {
                fs.writeFileSync(`${STEP.toString().padStart(3, '0')}.step`, result)
            }
            STEP = STEP + 1
            return result
        }
    }
    return undefined
}

const reduce = (current: string, transforms: Transform[], command: string, inFile: string): string => {
    if (transforms.length === 0) {
        return current // Done.
    }

    let previous = current
    let next = undefined
    do {
        previous = next === undefined ? previous : next
        next = transform(previous, transforms[0], command, inFile)
    } while (next !== undefined)

    return reduce(previous, transforms.slice(1, transforms.length), command, inFile)
}


const args = minimist(process.argv.slice(3), {
    default: {
        debug: false,
        file: '/tmp/85B6B886',
        transforms: 'transforms',
        language: 'lang',
        version: '1.0.0',
        record: false,
    },
});


const main = (): void => {
    if (process.argv[2] == '--help' || process.argv[2] == '-h' || process.argv[2] == '-help') {
        console.error(`comby-reduce <file-to-reduce> -- command @@`)
        console.error('Arg defaults: ', args)
        process.exit(1)
    }

    if (process.argv[2] == '--version' || process.argv[2] == '-v' || process.argv[2] == '-version') {
        console.log(args.version)
        process.exit(1)
    }

    const separatorIndex = process.argv.indexOf('--')
    if (separatorIndex < 0) {
        console.error('No -- seen. Enter a command like: comby-reduce <file-to-reduce> -- command @@')
        process.exit(1)
    }

    if (!process.argv[2]) {
        console.error(`No file. Invoke like: comby-reduce <file-to-reduce> -- command @@`)
        process.exit(1)
    }

    DEBUG = args.debug
    LANGUAGE = args.language
    RECORD = args.record
    let input: string = ''
    let extension: string = ''
    try {
        input = fs.readFileSync(process.argv[2]).toString()
        extension = path.extname(process.argv[2])
    } catch (e) {
        console.error(`Could not read content from ${process.argv[2]}`)
        process.exit(1)
    }
    if (input === '') {
        console.error('Empty input')
        process.exit(1)
    }

    const inFile = 
        args.file === '/tmp/85B6B886' && extension.length > 0
        ? `${args.file}.${extension}` 
        : args.file
    const command = process.argv.slice(separatorIndex + 1, process.argv.length).join(' ')
    if (DEBUG) {
        console.error(`Running command '${command}' on file '${inFile}`)
    }
    if (test(input, command, inFile) === Result.Bad) {
        console.error(`Program doesn't crash on this input (no exit status 139 or 134).`)
        process.exit(1)
    }

    const transforms = loadRules(args.transforms)
    let previous = input
    let pass = 0
    do {
        console.error(`[+] Did pass ${pass}`)
        previous = input
        input = reduce(input, transforms, command, inFile)
        pass = pass + 1
    } while (input.length < previous.length)
    console.error('[+] Result:')
    console.log(`${input}`)
}

main()
