#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const usage = `Usage:
  node scripts/post-review.mjs check <PR-URL | [HOST/]OWNER/REPO#NUMBER> [--reviewer LOGIN]
  node scripts/post-review.mjs post  <PR-URL | [HOST/]OWNER/REPO#NUMBER> --findings FILE [--post]

check  Read-only. Reports whether CodeRabbit's latest word on the PR is a rate-limit or
       usage-limit notice, when it resets, and the current head SHA.
post   Publishes pre-pr-review findings as one GitHub review with event COMMENT (never
       APPROVE or REQUEST_CHANGES). Findings on lines in the PR diff become inline
       comments, with a suggestion block when given; others go to the review body.
       Findings already posted in an unresolved thread are skipped. Without --post it
       is a dry run that prints the exact payload and posts nothing.

Options:
  --findings FILE   JSON input for post (see references/pr-comments.md).
  --post            Actually publish the review.
  --reviewer LOGIN  CodeRabbit account to check (default: coderabbitai).

Prints one JSON document on stdout. Exit 0: done. Exit 1: error. Exit 2: usage.
Exit 3: the PR head no longer matches the reviewed head; review the new head first.`;

const EXIT_CODES = { ok: 0, error: 1, usage: 2, stale: 3 };
const MARKER = 'pre-pr-review';
// CodeRabbit marks its notice with an HTML comment; the heading is the fallback. Plain "rate limit"
// text is not enough: a walkthrough of a PR that implements rate limiting contains it too.
const RATE_LIMIT_NOTICE = /<!-- This is an auto-generated comment: rate limited by coderabbit\.ai -->|^>?\s*#+\s*Rate limit exceeded/im;
const OUT_OF_CREDITS = /run out of usage credits|out of (?:usage )?credits/i;
const LIMIT_TEXT = /rate[ -]limit|usage limit|usage credits/i;
const SEVERITY_ICONS = {
    blocker: '🔴', critical: '🔴', high: '🟠', major: '🟠', medium: '🟡', minor: '🟡', low: '🔵', nitpick: '🔵',
};

const TEXT = {
    en: {
        title: '## 🤖 Pre-PR review (CodeRabbit fallback)',
        note: (reason) => `> [!NOTE]\n> ${reason} This review was generated locally by an agent with the \`pre-pr-review\` skill. It is neither a CodeRabbit approval nor a human review.`,
        defaultReason: 'CodeRabbit could not review this revision.',
        stats: (head, inline, outside, duplicates) => `**Revision:** \`${head.slice(0, 12)}\` · **Inline findings:** ${inline} · **Outside the diff:** ${outside} · **Already reported:** ${duplicates}`,
        outside: (count) => `Findings outside the diff range (${count})`,
        proposed: 'Proposed change:',
        footer: '<sub>pre-pr-review · CodeRabbit fallback</sub>',
        retried: '> [!WARNING]\n> GitHub rejected the inline positions, so every finding is listed in this body.',
        approved: '### ✅ Approved by `pre-pr-review` (CodeRabbit substitute)\nNo open finding remains on this revision. The human review is still required.',
        pending: (count) => `### ⏳ Not approved yet\n${count} finding(s) of this fallback review are still open.`,
    },
    cs: {
        title: '## 🤖 Pre-PR review (náhrada za CodeRabbit)',
        note: (reason) => `> [!NOTE]\n> ${reason} Tuto review vytvořil agent lokálně skillem \`pre-pr-review\`. Není to schválení CodeRabbitem ani lidské review.`,
        defaultReason: 'CodeRabbit tuto revizi nezreviewoval.',
        stats: (head, inline, outside, duplicates) => `**Revize:** \`${head.slice(0, 12)}\` · **Inline nálezy:** ${inline} · **Mimo diff:** ${outside} · **Už nahlášeno:** ${duplicates}`,
        outside: (count) => `Nálezy mimo rozsah diffu (${count})`,
        proposed: 'Navržená změna:',
        footer: '<sub>pre-pr-review · náhrada za CodeRabbit</sub>',
        retried: '> [!WARNING]\n> GitHub odmítl pozice inline komentářů, proto jsou všechny nálezy v tomto těle.',
        approved: '### ✅ Schváleno skillem `pre-pr-review` (náhrada za CodeRabbit)\nNa této revizi nezůstal žádný otevřený nález. Lidské review je dál povinné.',
        pending: (count) => `### ⏳ Zatím neschváleno\nOtevřených nálezů této náhradní review: ${count}.`,
    },
};

class UsageError extends Error {}
class StaleError extends Error {}

export function parseTarget(value) {
    let match = value.match(/^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/);
    if (!match) match = value.match(/^(?:([^/#\s]+)\/)?([^/#\s]+)\/([^/#\s]+)#(\d+)$/);
    if (!match) throw new UsageError(`Unrecognized pull request: ${value}`);
    return { host: match[1] || 'github.com', owner: match[2], repo: match[3], number: Number(match[4]) };
}

/** REST reports bot logins as `name[bot]`, GraphQL as `name`; compare them in one form. */
function normalizeLogin(login) {
    return (login ?? 'ghost').replace(/\[bot\]$/i, '').toLowerCase();
}

function gh(target, args, input) {
    const result = spawnSync('gh', ['api', '--hostname', target.host, ...args], {
        encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024,
    });
    if (result.error?.code === 'ENOENT') throw new Error('GitHub CLI `gh` is not installed or not on PATH.');
    if (result.status !== 0) {
        const error = new Error(`gh api ${args.find((arg) => !arg.startsWith('-')) ?? ''} failed: ${(result.stderr || result.stdout).trim().slice(0, 500)}`);
        error.httpStatus = Number((result.stderr.match(/HTTP (\d{3})/) ?? [])[1]) || null;
        throw error;
    }
    return result.stdout ? JSON.parse(result.stdout) : null;
}

function restPages(target, path) {
    const items = [];
    for (let page = 1; ; page++) {
        const separator = path.includes('?') ? '&' : '?';
        const batch = gh(target, [`${path}${separator}per_page=100&page=${page}`]);
        items.push(...batch);
        if (batch.length < 100) return items;
    }
}

const THREADS_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { isResolved isOutdated path line comments(first: 1) { nodes { body url } } }
      }
    }
  }
}`;

function reviewThreads(target) {
    const threads = [];
    let cursor = null;
    do {
        const args = ['graphql', '-f', `query=${THREADS_QUERY}`, '-f', `owner=${target.owner}`, '-f', `repo=${target.repo}`, '-F', `number=${target.number}`];
        if (cursor) args.push('-f', `cursor=${cursor}`);
        const connection = gh(target, args).data.repository.pullRequest.reviewThreads;
        threads.push(...connection.nodes);
        cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
    } while (cursor);
    return threads;
}

/** Seconds from CodeRabbit's "Please wait **1 hour, 2 minutes and 3 seconds**" wording. */
export function parseWait(text) {
    const match = text.match(/wait\s+\**\s*((?:\d+\s+(?:hours?|minutes?|seconds?)[\s,and]*)+)/i);
    if (!match) return null;
    const units = { hour: 3600, minute: 60, second: 1 };
    let seconds = 0;
    for (const [, amount, unit] of match[1].matchAll(/(\d+)\s+(hour|minute|second)s?/gi)) seconds += Number(amount) * units[unit.toLowerCase()];
    return seconds;
}

/**
 * Decides from CodeRabbit's comments, reviews, and head status or check run whether it is
 * currently rate-limited. A notice counts while it is newer than CodeRabbit's latest review:
 * CodeRabbit removes it from its summary comment once a review goes through.
 */
export function rateLimitState({ comments, reviews, statuses = [], checkRuns = [], reviewer }) {
    const mine = (login) => normalizeLogin(login) === reviewer;
    const latestReviewAt = reviews.filter((review) => mine(review.user?.login) && review.submitted_at)
        .map((review) => review.submitted_at).sort().at(-1) ?? null;
    const latest = comments.filter((comment) => mine(comment.user?.login) && RATE_LIMIT_NOTICE.test(comment.body ?? ''))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at)).at(-1);
    let notice = null;
    if (latest && (!latestReviewAt || latest.updated_at > latestReviewAt)) {
        const wait = parseWait(latest.body);
        notice = {
            url: latest.html_url,
            updatedAt: latest.updated_at,
            resetAt: wait === null ? null : new Date(Date.parse(latest.updated_at) + wait * 1000).toISOString(),
            creditsExhausted: OUT_OF_CREDITS.test(latest.body),
        };
    }
    const status = statuses.find((entry) => /coderabbit/i.test(entry.context ?? '')) ?? null;
    const run = checkRuns.find((entry) => entry.app?.slug === 'coderabbitai' || /coderabbit/i.test(entry.name ?? '')) ?? null;
    const statusText = `${status?.description ?? ''}\n${run?.output?.title ?? ''}\n${run?.output?.summary ?? ''}`;
    return {
        rateLimited: Boolean(notice) || LIMIT_TEXT.test(statusText),
        creditsExhausted: Boolean(notice?.creditsExhausted) || OUT_OF_CREDITS.test(statusText),
        notice,
        latestReviewAt,
        status: status ? { state: status.state, description: status.description } : null,
        checkRun: run ? { status: run.status, conclusion: run.conclusion, title: run.output?.title ?? null } : null,
    };
}

function check(target, reviewer) {
    const base = `repos/${target.owner}/${target.repo}`;
    const pr = gh(target, [`${base}/pulls/${target.number}`]);
    const comments = restPages(target, `${base}/issues/${target.number}/comments`);
    const reviews = restPages(target, `${base}/pulls/${target.number}/reviews`);
    const statuses = gh(target, [`${base}/commits/${pr.head.sha}/status`]).statuses ?? [];
    const checkRuns = gh(target, [`${base}/commits/${pr.head.sha}/check-runs?per_page=100`]).check_runs ?? [];
    return { pr: pr.html_url, state: pr.state, head: pr.head.sha, base: pr.base.sha, reviewer, ...rateLimitState({ comments, reviews, statuses, checkRuns, reviewer }) };
}

/** Maps each file's right-side lines that GitHub accepts for review comments to their hunk. */
export function commentableLines(patch) {
    const lines = new Map();
    if (!patch) return lines;
    let hunk = -1;
    let right = 0;
    for (const text of patch.split('\n')) {
        const header = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (header) {
            hunk++;
            right = Number(header[1]);
        } else if (hunk >= 0 && (text.startsWith('+') || text.startsWith(' '))) {
            lines.set(right, hunk);
            right++;
        }
    }
    return lines;
}

export function findingId(finding) {
    if (finding.id) return String(finding.id);
    const title = finding.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return createHash('sha256').update(`${finding.path}\n${title}`).digest('hex').slice(0, 12);
}

const ID_PATTERN = /^[\w-]{1,64}$/;

function markerOf(body) {
    return (body ?? '').match(new RegExp(`<!-- ${MARKER}:finding:([\\w-]+) -->`))?.[1] ?? null;
}

/**
 * Keeps quoted review text from notifying people or addressing bots: inserts a zero-width
 * space after `@` outside code, where GitHub would turn it into a mention.
 */
export function defang(text) {
    return (text ?? '').split(/(`{3,}[\s\S]*?`{3,}|`[^`\n]+`)/).map((part, index) => (index % 2
        ? part
        : part.replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, '$1@\u200b'))).join('');
}

function validateInput(input) {
    if (!input || typeof input !== 'object') throw new UsageError('Findings file must contain a JSON object.');
    if (!/^[0-9a-f]{40}$/i.test(input.head ?? '')) throw new UsageError('Findings file needs "head": the full SHA that was reviewed.');
    if (!Array.isArray(input.findings)) throw new UsageError('Findings file needs a "findings" array (it may be empty).');
    for (const [index, finding] of input.findings.entries()) {
        for (const field of ['severity', 'title', 'path', 'body']) {
            if (typeof finding[field] !== 'string' || !finding[field].trim()) throw new UsageError(`findings[${index}].${field} must be a non-empty string.`);
        }
        if (!Number.isInteger(finding.line) || finding.line < 1) throw new UsageError(`findings[${index}].line must be a positive integer.`);
        if (finding.startLine !== undefined && (!Number.isInteger(finding.startLine) || finding.startLine > finding.line || finding.startLine < 1)) {
            throw new UsageError(`findings[${index}].startLine must be a positive integer not after line.`);
        }
        if (finding.suggestion !== undefined && typeof finding.suggestion !== 'string') throw new UsageError(`findings[${index}].suggestion must be a string.`);
        if (finding.id !== undefined && !ID_PATTERN.test(String(finding.id))) throw new UsageError(`findings[${index}].id may contain only letters, digits, _ and - (at most 64).`);
    }
    if (input.language && !TEXT[input.language]) throw new UsageError(`language must be one of: ${Object.keys(TEXT).join(', ')}.`);
}

function fence(content, info = '') {
    const longest = Math.max(2, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
    const ticks = '`'.repeat(longest + 1);
    return `${ticks}${info}\n${content.replace(/\n$/, '')}\n${ticks}`;
}

function heading(finding) {
    const icon = SEVERITY_ICONS[finding.severity.toLowerCase()] ?? '⚪';
    return `${icon} **${finding.severity}** · **${defang(finding.title)}**`;
}

function inlineBody(finding, id, text) {
    const parts = [heading(finding), defang(finding.body.trim())];
    if (finding.suggestion !== undefined) parts.push(fence(finding.suggestion, 'suggestion'));
    parts.push(`${text.footer}\n<!-- ${MARKER}:finding:${id} -->`);
    return parts.join('\n\n');
}

function outsideEntry(finding, id, text) {
    const location = finding.startLine ? `${finding.path}:${finding.startLine}-${finding.line}` : `${finding.path}:${finding.line}`;
    const parts = [`#### ${heading(finding)}\n\`${location}\``, defang(finding.body.trim())];
    if (finding.suggestion !== undefined) parts.push(`${text.proposed}\n\n${fence(finding.suggestion)}`);
    parts.push(`<!-- ${MARKER}:finding:${id} -->`);
    return parts.join('\n\n');
}

/**
 * Builds the review payload. Pure: takes the PR's files, existing threads, and earlier
 * fallback review bodies, and decides placement and deduplication.
 */
export function planReview({ input, files, threads, reviewBodies }) {
    const text = TEXT[input.language ?? 'en'];
    const patches = new Map(files.map((file) => [file.filename, commentableLines(file.patch)]));
    const openThreads = new Map();
    const existing = [];
    for (const thread of threads) {
        const first = thread.comments.nodes[0];
        const id = markerOf(first?.body);
        if (!id) continue;
        const title = (first.body.match(/\*\*[^*]+\*\* · \*\*(.+?)\*\*/) ?? [])[1] ?? null;
        existing.push({ id, path: thread.path, line: thread.line, title, resolved: thread.isResolved, outdated: thread.isOutdated, url: first.url });
        if (!thread.isResolved) openThreads.set(id, first.url);
    }
    const reportedInBodies = new Set(reviewBodies.flatMap((body) => [...(body ?? '').matchAll(new RegExp(`<!-- ${MARKER}:finding:([\\w-]+) -->`, 'g'))].map((match) => match[1])));
    const headsMarked = (kind) => new Set(reviewBodies.flatMap((body) => [...(body ?? '').matchAll(new RegExp(`<!-- ${MARKER}:${kind} head=([0-9a-f]{40}) -->`, 'g'))].map((match) => match[1])));
    const reviewedHeads = headsMarked('review');
    const approvedHeads = headsMarked('approved');

    const comments = [];
    const inline = [];
    const outside = [];
    const duplicates = [];
    for (const finding of input.findings) {
        const id = findingId(finding);
        if (openThreads.has(id)) {
            duplicates.push({ id, url: openThreads.get(id) });
            continue;
        }
        const lines = patches.get(finding.path);
        const start = finding.startLine ?? finding.line;
        const hunk = lines?.get(finding.line);
        // GitHub accepts a multi-line comment only when every line of the range is in one hunk.
        const fits = hunk !== undefined
            && Array.from({ length: finding.line - start + 1 }, (_, offset) => lines.get(start + offset) === hunk).every(Boolean);
        if (fits) {
            const comment = { path: finding.path, line: finding.line, side: 'RIGHT', body: inlineBody(finding, id, text) };
            if (finding.startLine && finding.startLine < finding.line) Object.assign(comment, { start_line: finding.startLine, start_side: 'RIGHT' });
            comments.push(comment);
            inline.push(id);
        } else if (reportedInBodies.has(id)) {
            duplicates.push({ id, url: null });
        } else {
            outside.push({ id, entry: outsideEntry(finding, id, text) });
        }
    }

    // The skill approves a head when its review found nothing and no fallback thread is still open.
    const approved = !input.findings.length && !openThreads.size;
    const openFindings = new Set([...openThreads.keys(), ...inline, ...outside.map((entry) => entry.id)]).size;
    const upToDate = !comments.length && !outside.length && reviewedHeads.has(input.head) && (!approved || approvedHeads.has(input.head));
    const body = renderBody({ input, text, inline: inline.length, outside, duplicates: duplicates.length, approved, openFindings });
    return {
        upToDate,
        approved,
        openFindings,
        payload: { commit_id: input.head, event: 'COMMENT', body, comments },
        inline,
        outside: outside.map((entry) => entry.id),
        duplicates,
        existing,
    };
}

function renderBody({ input, text, inline, outside, duplicates, retried = false, approved = false, openFindings = 0 }) {
    const parts = [
        `<!-- ${MARKER}:review head=${input.head} -->${approved ? `\n<!-- ${MARKER}:approved head=${input.head} -->` : ''}`,
        text.title,
        text.note(defang(input.reason?.trim()) || text.defaultReason),
    ];
    if (retried) parts.push(text.retried);
    parts.push(text.stats(input.head, inline, outside.length, duplicates));
    if (input.summary?.trim()) parts.push(defang(input.summary.trim()));
    if (outside.length) {
        parts.push(`<details>\n<summary>${text.outside(outside.length)}</summary>\n\n${outside.map((entry) => entry.entry).join('\n\n---\n\n')}\n\n</details>`);
    }
    if (input.verdict?.trim()) parts.push(defang(input.verdict.trim()));
    parts.push(approved ? text.approved : text.pending(openFindings));
    return parts.join('\n\n');
}

function post(target, findingsPath, publish) {
    const input = JSON.parse(readFileSync(findingsPath, 'utf8'));
    validateInput(input);
    const pr = gh(target, [`repos/${target.owner}/${target.repo}/pulls/${target.number}`]);
    if (pr.state !== 'open') throw new Error(`PR ${pr.html_url} is ${pr.state}; nothing is posted to a closed PR.`);
    if (pr.head.sha.toLowerCase() !== input.head.toLowerCase()) {
        throw new StaleError(`PR head is ${pr.head.sha} but the findings cover ${input.head}; review the new head first.`);
    }
    const files = restPages(target, `repos/${target.owner}/${target.repo}/pulls/${target.number}/files`);
    const threads = reviewThreads(target);
    const reviewBodies = restPages(target, `repos/${target.owner}/${target.repo}/pulls/${target.number}/reviews`).map((review) => review.body);
    const plan = planReview({ input, files, threads, reviewBodies });
    const summary = { pr: pr.html_url, head: pr.head.sha, approved: plan.approved, openFindings: plan.openFindings, inline: plan.inline, outside: plan.outside, duplicates: plan.duplicates, existing: plan.existing };

    if (plan.upToDate) return { ...summary, posted: false, reason: 'up-to-date: this head already has a fallback review and nothing changed' };
    if (!publish) return { ...summary, posted: false, dryRun: true, payload: plan.payload };

    const endpoint = `repos/${target.owner}/${target.repo}/pulls/${target.number}/reviews`;
    try {
        const review = gh(target, ['--method', 'POST', endpoint, '--input', '-'], JSON.stringify(plan.payload));
        return { ...summary, posted: true, url: review.html_url, reviewId: review.id };
    } catch (error) {
        if (error.httpStatus !== 422 || !plan.payload.comments.length) throw error;
        // A line GitHub does not accept for comments: keep every finding, all in the body.
        const text = TEXT[input.language ?? 'en'];
        const outside = input.findings.map((finding) => ({ id: findingId(finding), entry: outsideEntry(finding, findingId(finding), text) }))
            .filter((entry) => !plan.duplicates.some((duplicate) => duplicate.id === entry.id));
        const body = renderBody({ input, text, inline: 0, outside, duplicates: plan.duplicates.length, retried: true, openFindings: plan.openFindings });
        const review = gh(target, ['--method', 'POST', endpoint, '--input', '-'], JSON.stringify({ commit_id: input.head, event: 'COMMENT', body, comments: [] }));
        return { ...summary, inline: [], outside: outside.map((entry) => entry.id), posted: true, url: review.html_url, reviewId: review.id, retriedWithoutInline: true };
    }
}

function main() {
    let parsed;
    try {
        parsed = parseArgs({
            allowPositionals: true,
            options: {
                findings: { type: 'string' },
                post: { type: 'boolean', default: false },
                reviewer: { type: 'string', default: 'coderabbitai' },
                help: { type: 'boolean', short: 'h', default: false },
            },
        });
    } catch (error) {
        throw new UsageError(error.message);
    }
    const { values, positionals } = parsed;
    if (values.help) {
        process.stdout.write(`${usage}\n`);
        return;
    }
    const [command, pr] = positionals;
    if (!['check', 'post'].includes(command) || !pr || positionals.length !== 2) throw new UsageError('Expected `check <PR>` or `post <PR> --findings FILE`.');
    const target = parseTarget(pr);
    let result;
    if (command === 'check') {
        result = check(target, normalizeLogin(values.reviewer));
    } else {
        if (!values.findings) throw new UsageError('post needs --findings FILE.');
        result = post(target, values.findings, values.post);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
    try {
        main();
    } catch (error) {
        const code = error instanceof UsageError ? EXIT_CODES.usage : error instanceof StaleError ? EXIT_CODES.stale : EXIT_CODES.error;
        process.stderr.write(`post-review: ${error.message}${code === EXIT_CODES.usage ? `\n\n${usage}` : ''}\n`);
        process.exit(code);
    }
}
