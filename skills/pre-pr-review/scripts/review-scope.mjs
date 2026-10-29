#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const usage = `Usage: node scripts/review-scope.mjs --base REF [options]

Resolves exactly which changes a pre-PR review covers and prints one JSON document on
stdout. Read-only: never fetches, stages, commits, or sends anything anywhere.

Options:
  --base REF             Base branch, remote-tracking ref, or commit the PR targets.
                         Required; the script never guesses it.
  --type TYPE            all (default): committed since the merge base, staged,
                         unstaged, and untracked changes. committed: merge base..HEAD.
                         uncommitted: staged, unstaged, and untracked changes only.
  --no-untracked         Leave untracked files out of all/uncommitted scopes.
  --config FILE          CodeRabbit configuration (default: .coderabbit.yaml or
                         .coderabbit.yml at the repository root, when present).
  --exclude GLOB         Extra exclusion, repeatable.
  --no-default-filters   Do not exclude lockfiles, build output, and minified files.
  --repo DIR             Repository directory (default: current directory).

Every changed text file is scanned for credentials, including excluded ones. Secret
previews are redacted. Exit 0: scope printed. Exit 1: error. Exit 2: usage.`;

const EXIT_CODES = { ok: 0, error: 1, usage: 2 };
const SCAN_LIMIT_BYTES = 2 * 1024 * 1024;
const SPLIT_FILE_THRESHOLD = 30;
const SPLIT_LINE_THRESHOLD = 1500;

/** Paths CodeRabbit also skips by default: generated, vendored, or lock content. */
const DEFAULT_FILTERS = [
    '!**/package-lock.json', '!**/pnpm-lock.yaml', '!**/yarn.lock', '!**/bun.lockb', '!**/composer.lock',
    '!**/Gemfile.lock', '!**/poetry.lock', '!**/Cargo.lock', '!**/go.sum',
    '!**/node_modules/**', '!**/vendor/**', '!**/dist/**', '!**/build/**', '!**/.next/**', '!**/.nuxt/**',
    '!**/.output/**', '!**/*.min.js', '!**/*.min.css', '!**/*.map',
];

const SECRET_RULES = [
    { rule: 'private-key', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
    { rule: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { rule: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/ },
    { rule: 'gitlab-token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
    { rule: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
    { rule: 'stripe-live-key', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
    { rule: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { rule: 'llm-api-key', pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/ },
    { rule: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
    { rule: 'url-credentials', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"]+:([^\s@/'"]{6,})@/i, group: 1 },
    {
        rule: 'hardcoded-secret',
        pattern: /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)[\w-]*["']?\s*(?:=>|[:=])\s*["']([^"'\s]{8,})["']/i,
        group: 1,
    },
    {
        // define('DB_PASSWORD', '...'); a plain lowercase word after a comma is a list of keys.
        rule: 'hardcoded-secret',
        pattern: /(?:password|passwd|secret|api[_-]?key|token|private[_-]?key)[\w-]*["']\s*,\s*["'](?=[^"'\s]*[^a-z_"'\s])([^"'\s]{8,})["']/i,
        group: 1,
    },
    {
        rule: 'env-secret',
        pattern: /^\s*(?:export\s+|-\s+)?[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[:=]\s*([^\s"'#$]{8,})\s*$/,
        group: 1,
    },
];

/**
 * Values that look like references, validation rules, translation keys, or field and column
 * names (password_hash, remember_token) rather than secrets.
 */
const PLACEHOLDER = /\$\{|\{\{|<[^>]*>|%[a-z_]+%|example|sample|changeme|change[_-]?me|placeholder|dummy|your[_-]|xxxx|\*\*\*\*|^(?:secret|password|null|true|false)$|env\(|getenv|process\.env|\||^(?:required|nullable|sometimes|confirmed)|^[a-z_]+(?:\.[a-z_]+)+$/i;
const IDENTIFIER = /^[a-z]+(?:_[a-z]+)+$|^(?:password|passwd|secret|token)[a-z_]*$/;

const SENSITIVE_FILES = [
    { rule: 'env-file', pattern: /(?:^|\/)\.env(?:\.(?!example$|dist$|sample$|template$|testing\.example$)[^/]+)?$/ },
    { rule: 'key-file', pattern: /(?:^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/ },
    { rule: 'database-dump', pattern: /(?:^|\/)[^/]*(?:dump|backup|export)[^/]*\.sql(?:\.gz)?$|\.sql\.gz$/i },
];

/** Test code, where credential-shaped values are usually throwaway fixtures. */
const TEST_PATH = /(?:^|\/)(?:tests?|specs?|__tests__|fixtures?|e2e|cypress)\/|(?:^|\/)test_[^/]+$|_test\.[^/]+$|\.(?:test|spec|cy)\.[^/]+$|Tests?\.(?:php|java|cs|kt)$/;

function fail(message, code = EXIT_CODES.error) {
    process.stderr.write(`review-scope: ${message}\n`);
    process.exit(code);
}

function git(repo, args, { allowFailure = false } = {}) {
    try {
        return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
            cwd: repo, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (error) {
        if (allowFailure) return null;
        const detail = String(error.stderr ?? error.message).trim().split('\n')[0];
        throw new Error(`git ${args[0]} failed: ${detail}`);
    }
}

/** Converts a CodeRabbit/minimatch-style glob to an anchored regular expression source. */
function globSource(glob) {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === '*') {
            const atSegmentStart = i === 0 || glob[i - 1] === '/';
            if (glob[i + 1] === '*' && atSegmentStart && glob[i + 2] === '/') {
                source += '(?:[^/]*/)*';
                i += 2;
            } else if (glob[i + 1] === '*' && atSegmentStart && i + 2 === glob.length) {
                source += '.*';
                i += 1;
            } else {
                while (glob[i + 1] === '*') i++;
                source += '[^/]*';
            }
        } else if (char === '?') {
            source += '[^/]';
        } else if (char === '{') {
            const end = glob.indexOf('}', i);
            if (end === -1) {
                source += '\\{';
                continue;
            }
            source += `(?:${glob.slice(i + 1, end).split(',').map(globSource).join('|')})`;
            i = end;
        } else if (char === '[') {
            const end = glob.indexOf(']', i + 1);
            if (end === -1) {
                source += '\\[';
                continue;
            }
            const body = glob.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\');
            source += `[${body}]`;
            i = end;
        } else {
            source += char.replace(/[.+^$()|\\/]/g, '\\$&');
        }
    }
    return source;
}

export function globToRegExp(glob) {
    return new RegExp(`^${globSource(glob.replace(/^\.\//, ''))}$`);
}

function unquote(value) {
    const trimmed = value.trim();
    if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1);
    return trimmed;
}

function stripComment(value) {
    let quote = null;
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (quote) {
            if (char === quote) quote = null;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
            return value.slice(0, i).trimEnd();
        }
    }
    return value.trimEnd();
}

/** Splits a one-line YAML flow sequence, keeping commas inside quotes and brace globs. */
function flowList(value) {
    const items = [];
    let current = '';
    let quote = null;
    let depth = 0;
    for (const char of value.trim().slice(1, -1)) {
        if (quote) {
            if (char === quote) quote = null;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
        } else if (char === ',' && depth === 0) {
            items.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    items.push(current);
    return items.map(unquote).filter(Boolean);
}

/**
 * Reads the review-relevant subset of a CodeRabbit configuration without a YAML dependency:
 * reviews.path_filters, reviews.path_instructions, reviews.profile, language, and inheritance.
 */
export function parseCodeRabbitConfig(text) {
    const config = { pathFilters: [], pathInstructions: [], profile: null, language: null, inheritance: false, warnings: [] };
    const stack = [];
    let block = null;
    let item = null;

    const finishBlock = () => {
        const lines = block.lines;
        while (lines.length && lines.at(-1).trim() === '') lines.pop();
        const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length));
        block.item.instructions = lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
        block = null;
    };

    for (const raw of text.split(/\r?\n/)) {
        const indentOf = raw.match(/^ */)[0].length;
        if (block) {
            if (raw.trim() === '' || indentOf > block.keyIndent) {
                block.lines.push(raw);
                continue;
            }
            finishBlock();
        }
        if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;

        let indent = indentOf;
        let content = raw.slice(indent);
        const isItem = content === '-' || content.startsWith('- ');
        if (isItem) {
            while (stack.length && stack.at(-1).indent > indent) stack.pop();
            const rest = content.slice(1).trimStart();
            indent += content.length - rest.length;
            content = rest;
        } else {
            while (stack.length && stack.at(-1).indent >= indent) stack.pop();
        }
        const parent = stack.map((entry) => entry.key).join('.');
        const keyMatch = content.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);

        if (isItem && parent === 'reviews.path_instructions') {
            item = { path: null, instructions: '' };
            config.pathInstructions.push(item);
        }
        if (isItem && !keyMatch) {
            if (parent !== 'reviews.path_filters') continue;
            const pattern = stripComment(content);
            if (pattern.startsWith('!')) {
                config.warnings.push(`.coderabbit.yaml path filter ${pattern} is unquoted, so YAML reads it as a tag and CodeRabbit ignores it; quote it. Not applied here either.`);
            } else {
                config.pathFilters.push(unquote(pattern));
            }
            continue;
        }
        if (!keyMatch) continue;

        const [, key, rawValue = ''] = keyMatch;
        const value = stripComment(rawValue);
        const fullKey = parent ? `${parent}.${key}` : key;

        if (parent === 'reviews.path_instructions' && item) {
            if (key === 'path') item.path = unquote(value);
            if (key === 'instructions') {
                if (/^[|>][+-]?$/.test(value)) block = { item, keyIndent: indent, lines: [] };
                else item.instructions = unquote(value);
            }
            continue;
        }
        if (fullKey === 'reviews.profile') config.profile = unquote(value);
        if (fullKey === 'language') config.language = unquote(value);
        if (fullKey === 'inheritance') config.inheritance = unquote(value) === 'true';
        if (fullKey === 'reviews.path_filters' && value.startsWith('[')) config.pathFilters.push(...flowList(value));
        if (value.startsWith('{') && (fullKey === 'reviews' || fullKey.startsWith('reviews.'))) {
            config.warnings.push(`.coderabbit.yaml ${fullKey} uses a flow mapping, which this script does not read; check it by hand.`);
        }
        if (value === '') stack.push({ indent, key });
    }
    if (block) finishBlock();
    config.pathInstructions = config.pathInstructions.filter((entry) => entry.path);
    return config;
}

/**
 * Applies CodeRabbit path filter semantics: `!glob` excludes, plain globs form an allow-list.
 * A configured include overrides a default exclusion (vendor/my-package/** beats !**\/vendor/**).
 */
export function filterVerdict(path, filters) {
    const includes = filters.filter((filter) => !filter.pattern.startsWith('!'));
    const explicitlyIncluded = includes.some((filter) => filter.regex.test(path));
    const exclusion = filters.find((filter) => filter.pattern.startsWith('!') && filter.regex.test(path)
        && !(filter.source === 'default' && explicitlyIncluded));
    if (exclusion) return { excluded: true, reason: `${exclusion.source}: ${exclusion.pattern}` };
    if (includes.length && !includes.some((filter) => filter.regex.test(path))) {
        return { excluded: true, reason: `${includes[0].source}: outside included paths` };
    }
    return { excluded: false };
}

function compileFilters(patterns, source) {
    return patterns.map((pattern) => ({ pattern, source, regex: globToRegExp(pattern.replace(/^!/, '')) }));
}

/** Keeps a token's public prefix (AKIA, ghp_, eyJ) but nothing of a captured password. */
function redact(value, captured) {
    return captured ? `…(${value.length} chars)` : `${value.slice(0, 4)}…(${value.length} chars)`;
}

export function scanLine(line) {
    const hits = [];
    for (const { rule, pattern, group } of SECRET_RULES) {
        const match = line.match(pattern);
        if (!match) continue;
        const value = match[group ?? 0];
        if (group && (PLACEHOLDER.test(value) || IDENTIFIER.test(value))) continue;
        hits.push({ rule, preview: redact(value, Boolean(group)) });
    }
    return hits;
}

function parseZList(output) {
    return output.split('\0');
}

/** Parses `git diff --name-status -z` into {path, oldPath, status}. */
function parseNameStatus(output) {
    const entries = [];
    const parts = parseZList(output);
    const names = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'typechange' };
    for (let i = 0; i < parts.length && parts[i]; ) {
        const code = parts[i++];
        const letter = code[0];
        if (letter === 'R' || letter === 'C') {
            entries.push({ status: names[letter], oldPath: parts[i], path: parts[i + 1] });
            i += 2;
        } else {
            entries.push({ status: names[letter] ?? 'unknown', path: parts[i] });
            i += 1;
        }
    }
    return entries;
}

/** Parses `git diff --numstat -z` into a map of path → {added, deleted, binary}. */
function parseNumstat(output) {
    const stats = new Map();
    const parts = parseZList(output);
    for (let i = 0; i < parts.length && parts[i]; ) {
        const [added, deleted, inlinePath] = parts[i++].split('\t');
        let path = inlinePath;
        if (!path) {
            path = parts[i + 1];
            i += 2;
        }
        const binary = added === '-';
        stats.set(path, { added: binary ? 0 : Number(added), deleted: binary ? 0 : Number(deleted), binary });
    }
    return stats;
}

/** Decodes a path git printed in C-style quotes (names with quotes, backslashes, or control characters). */
function unquoteGitPath(value) {
    if (!value.startsWith('"')) return value;
    const escapes = { n: '\n', t: '\t', '"': '"', '\\': '\\', a: '\x07', b: '\b', f: '\f', r: '\r', v: '\v' };
    return value.slice(1, -1).replace(/\\([0-7]{3}|.)/g, (_, code) => escapes[code] ?? String.fromCharCode(parseInt(code, 8)));
}

/** Collects the added lines of a zero-context diff as path → [{line, text}]. */
function addedLines(diff) {
    const result = new Map();
    let current = null;
    let inHeader = false;
    let line = 0;
    for (const text of diff.split('\n')) {
        if (text.startsWith('diff --git ')) {
            inHeader = true;
            current = null;
        } else if (inHeader && text.startsWith('+++ ')) {
            const target = unquoteGitPath(text.slice(4).replace(/\t$/, ''));
            current = target === '/dev/null' ? null : target.replace(/^b\//, '');
            if (current && !result.has(current)) result.set(current, []);
        } else if (text.startsWith('@@')) {
            inHeader = false;
            const match = text.match(/\+(\d+)/);
            line = match ? Number(match[1]) : 0;
        } else if (current && text.startsWith('+')) {
            result.get(current).push({ line, text: text.slice(1) });
            line++;
        }
    }
    return result;
}

function readText(path) {
    const size = statSync(path).size;
    const buffer = Buffer.alloc(Math.min(size, SCAN_LIMIT_BYTES));
    const fd = openSync(path, 'r');
    try {
        readSync(fd, buffer, 0, buffer.length, 0);
    } finally {
        closeSync(fd);
    }
    const binary = buffer.subarray(0, 8000).includes(0);
    return { size, binary, text: binary ? '' : buffer.toString('utf8'), truncated: size > SCAN_LIMIT_BYTES };
}

function withoutWarnings({ warnings, ...rest }) {
    return rest;
}

function countLines(text) {
    if (!text) return 0;
    return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

function generatedMarker(text) {
    return /@generated|do not edit|auto-?generated|generated by/i.test(text.split('\n', 5).join('\n'));
}

function main() {
    let parsed;
    try {
        parsed = parseArgs({
            allowPositionals: false,
            options: {
                base: { type: 'string' },
                type: { type: 'string', default: 'all' },
                'no-untracked': { type: 'boolean', default: false },
                config: { type: 'string' },
                exclude: { type: 'string', multiple: true, default: [] },
                'no-default-filters': { type: 'boolean', default: false },
                repo: { type: 'string', default: process.cwd() },
                help: { type: 'boolean', short: 'h', default: false },
            },
        });
    } catch (error) {
        fail(`${error.message}\n\n${usage}`, EXIT_CODES.usage);
    }
    const options = parsed.values;
    if (options.help) {
        process.stdout.write(`${usage}\n`);
        return;
    }
    if (!options.base) fail(`--base is required\n\n${usage}`, EXIT_CODES.usage);
    if (!['all', 'committed', 'uncommitted'].includes(options.type)) {
        fail(`--type must be all, committed, or uncommitted\n\n${usage}`, EXIT_CODES.usage);
    }

    const root = git(options.repo, ['rev-parse', '--show-toplevel']).trim();
    const baseSha = git(root, ['rev-parse', '--verify', '--quiet', `${options.base}^{commit}`], { allowFailure: true })?.trim();
    if (!baseSha) fail(`base ${options.base} does not resolve to a commit; fetch it first`);
    const headSha = git(root, ['rev-parse', 'HEAD']).trim();
    const headRef = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    const mergeBase = git(root, ['merge-base', baseSha, headSha], { allowFailure: true })?.trim();
    if (!mergeBase) fail(`HEAD shares no history with ${options.base}`);

    const warnings = [];
    if (mergeBase !== baseSha) {
        const behind = git(root, ['rev-list', '--count', `${mergeBase}..${baseSha}`]).trim();
        warnings.push(`Branch is ${behind} commit(s) behind ${options.base}; the review compares with the merge base ${mergeBase.slice(0, 12)}.`);
    }

    const range = { all: [mergeBase], committed: [mergeBase, headSha], uncommitted: ['HEAD'] }[options.type];
    // Fixed prefixes: diff.mnemonicPrefix or diff.noprefix in the user's config would otherwise change them.
    const diffArgs = ['diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '-M', ...range];
    const entries = parseNameStatus(git(root, [...diffArgs, '--name-status', '-z']));
    const stats = parseNumstat(git(root, [...diffArgs, '--numstat', '-z']));
    const added = addedLines(git(root, [...diffArgs, '-U0']));

    const dirty = git(root, ['status', '--porcelain', '--untracked-files=normal']).trim() !== '';
    if (options.type === 'committed' && dirty) warnings.push('Uncommitted or untracked changes exist and are not part of this committed-only scope.');

    const includeUntracked = options.type !== 'committed' && !options['no-untracked'];
    const untracked = parseZList(git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).filter(Boolean);
    if (!includeUntracked && options.type !== 'committed' && untracked.length) {
        warnings.push(`${untracked.length} untracked file(s) left out by --no-untracked.`);
    }

    let configPath = options.config ? resolve(root, options.config) : null;
    if (!configPath) configPath = ['.coderabbit.yaml', '.coderabbit.yml'].map((name) => join(root, name)).find(existsSync) ?? null;
    if (options.config && !existsSync(configPath)) fail(`config ${options.config} not found`);
    const config = configPath ? parseCodeRabbitConfig(readFileSync(configPath, 'utf8')) : null;

    const filters = [
        ...compileFilters(options['no-default-filters'] ? [] : DEFAULT_FILTERS, 'default'),
        ...compileFilters(config?.pathFilters ?? [], '.coderabbit.yaml'),
        ...compileFilters(options.exclude.map((glob) => `!${glob.replace(/^!/, '')}`), '--exclude'),
    ];
    const instructionMatchers = (config?.pathInstructions ?? []).map((entry) => globToRegExp(entry.path));

    const files = [];
    const excluded = [];
    const secrets = [];
    const record = (file, lines, text) => {
        const verdict = filterVerdict(file.path, filters);
        for (const { rule, pattern } of SENSITIVE_FILES) {
            if (file.status !== 'deleted' && pattern.test(file.path)) secrets.push({ path: file.path, line: null, rule, preview: 'sensitive file name' });
        }
        const inTests = TEST_PATH.test(file.path);
        for (const { line, text: content } of lines) {
            for (const hit of scanLine(content)) secrets.push({ path: file.path, line, ...hit, ...(inTests && { test: true }) });
        }
        if (text && generatedMarker(text)) file.generated = true;
        const instructions = instructionMatchers.flatMap((regex, index) => (regex.test(file.path) ? [index] : []));
        if (instructions.length) file.instructions = instructions;
        if (verdict.excluded) excluded.push({ path: file.path, reason: verdict.reason });
        else if (file.binary) excluded.push({ path: file.path, reason: 'binary' });
        else files.push(file);
    };

    for (const entry of entries) {
        const stat = stats.get(entry.path) ?? { added: 0, deleted: 0, binary: false };
        const file = { ...entry, ...stat };
        let head = '';
        const absolute = join(root, entry.path);
        const link = entry.status === 'deleted' ? null : lstatSync(absolute, { throwIfNoEntry: false });
        if (link?.isSymbolicLink()) file.symlink = true;
        else if (link?.isFile()) head = readText(absolute).text;
        record(file, added.get(entry.path) ?? [], head);
    }
    if (includeUntracked) {
        for (const path of untracked) {
            const absolute = join(root, path);
            const link = lstatSync(absolute, { throwIfNoEntry: false });
            if (!link?.isFile()) {
                const reason = link?.isSymbolicLink() ? 'untracked symlink (target not scanned)' : 'not a regular file (directory or nested repository)';
                excluded.push({ path, reason });
                continue;
            }
            const content = readText(absolute);
            const lines = content.text.split('\n').map((text, index) => ({ line: index + 1, text }));
            if (content.truncated) warnings.push(`${path} is larger than 2 MB; only its first 2 MB were scanned.`);
            record({ path, status: 'untracked', added: countLines(content.text), deleted: 0, binary: content.binary }, lines, content.text);
        }
    }

    const totals = files.reduce((sum, file) => ({ files: sum.files + 1, added: sum.added + file.added, deleted: sum.deleted + file.deleted }), { files: 0, added: 0, deleted: 0 });
    if (totals.files > SPLIT_FILE_THRESHOLD || totals.added + totals.deleted > SPLIT_LINE_THRESHOLD) {
        warnings.push(`Large change (${totals.files} files, +${totals.added}/-${totals.deleted}); review in groups and consider splitting the PR.`);
    }
    warnings.push(...(config?.warnings ?? []));
    if (config?.inheritance) warnings.push('inheritance: true — organization-level CodeRabbit settings also apply and are not visible here.');

    const result = {
        repository: root,
        type: options.type,
        base: { ref: options.base, sha: baseSha },
        mergeBase,
        head: { ref: headRef, sha: headSha, dirty },
        diffCommand: `git diff -M ${range.join(' ')} -- <path>`,
        config: config ? { path: configPath, ...withoutWarnings(config) } : null,
        totals,
        files,
        excluded,
        secrets,
        warnings,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
    try {
        main();
    } catch (error) {
        fail(error.message);
    }
}
