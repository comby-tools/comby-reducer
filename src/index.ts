import fs = require('fs')
import exec = require('child_process');
import minimist = require('minimist')
import { parse } from '@iarna/toml'

// eslint-disable-next-line no-var
declare var comby: any;

let DEBUG = false

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


export function _match(source: string, matchTemplate: string, matcher?: string, rule?: string): Match[] {
    if (matcher === undefined) {
        matcher = '.generic'
    }
    if (rule === undefined) {
        rule = 'where true'
    }
    return (JSON.parse(comby.match(source, matchTemplate, matcher, rule)) as Match[])
}

export function _substitute(template: string, environment: Environment): string {
    return comby.substitute(template, JSON.stringify(environment))
}

export function _rewrite(source: string, matchTemplate: string, rewriteTemplate: string, matcher?: string, rule?: string): string {
    if (matcher === undefined) {
        matcher = '.generic'
    }
    if (rule === undefined) {
        rule = 'where true'
    }
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
        console.log(`[+] Loaded ${transform.length} transformation rules`);
        if (DEBUG) {
            console.log(`[D] ${JSON.stringify(transform)}`)
        }
        return transform
    } catch (error) {
        console.log(`[-] Could not parse file in ${transformsDir}: ${error}`)
        throw ""
    }
}

const test = (source: string, command: string): Result => {
    if (DEBUG) {
        console.log(`[D] Testing for crash: ${source}`)
    }
    fs.writeFileSync('/tmp/in', source);
    command = command.replace('@@', '/tmp/in')
    if (DEBUG) {
        console.log(`[D] Running command: ${command}`)
    }
    try {
        exec.execSync(command, { stdio: "ignore" }) // ignore "Segmentation fault" output.
    } catch (error) {
        if (error.status === 139 || error.status == 134) {
            if (DEBUG) {
                console.log(`[D] Still crashing: ${error}`)
                console.log(`[D] Good for ${source}`)
            }
            return Result.Good
        }
        if (DEBUG) {
            console.log(`[D] Other error: ${error}`)
        }
    }
    if (DEBUG) {
        console.log(`[D] No crash.`)
    }
    return Result.Bad
}

const replaceRange = (source: string, { start, end }: Range, replacementFragment: string) => {
    const before = source.slice(0, start.offset);
    const after = source.slice(end.offset, source.length);
    return before + replacementFragment + after;
}

const transform = (source: string, transform: Transform, command: string): string | undefined => {
    const matches: Match[] = _match(source, transform.match)
    for (const m of matches) {
        const substituted = _substitute(transform.rewrite, m.environment)
        const result = replaceRange(source, m.range, substituted)
        if (result.length < source.length && test(result, command) === Result.Good) { // length test is redundant if transformations always reduce.
            return result
        }
    }
    return undefined
}

const reduce = (current: string, transforms: Transform[], command: string): string => {
    if (transforms.length === 0) {
        return current // Done.
    }

    let previous = current
    let next = undefined
    do {
        previous = next === undefined ? previous : next
        next = transform(previous, transforms[0], command)
    } while (next !== undefined)

    return reduce(previous, transforms.slice(1, transforms.length), command)
}


const args = minimist(process.argv.slice(3), {
    default: {
        debug: false,
        transformsDir: 'transforms',
    },
});


const main = (): void => {
    if (process.argv[2] == '--help' || process.argv[2] == '-h' || process.argv[2] == '-help') {
        console.log(`node reduce.js <file> -- command @@`)
        console.log('Arg defaults: ', args)
        process.exit(1)
    }

    const separatorIndex = process.argv.indexOf('--')
    if (separatorIndex < 0) {
        console.log('No -- seen. Enter a command like: node reduce.js <file> -- command @@')
        process.exit(1)
    }

    if (!process.argv[2]) {
        console.log(`No file. Invoke like: node reduce.js <file> -- command @@`)
        process.exit(1)
    }

    DEBUG = args.debug
    let input: string
    try {
        input = fs.readFileSync(process.argv[2]).toString()
    } catch (e) {
        console.log(`Could not read content from ${process.argv[2]}`)
        process.exit(1)
    }


    const command = process.argv.slice(separatorIndex + 1, process.argv.length).join(' ')
    const transforms = loadRules(args.transformsDir)

    let previous = input
    let pass = 0
    do {
        console.log(`[+] Did pass ${pass} pass`)
        previous = input
        input = reduce(input, transforms, command)
        pass = pass + 1
    } while (input.length < previous.length)
    console.log('[+] Result:')
    console.log(`${input}`)
}

main()
