#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const usage = `Usage: node scripts/wait-pr.mjs <PR-URL | [HOST/]OWNER/REPO#NUMBER> [options]

Polls one pull request's CI and review state with bounded backoff until something needs
the agent's attention, then prints one JSON snapshot on stdout. Read-only: never posts,
pushes, reruns, or resolves anything. Progress lines go to stderr.

Options:
  --expect-head SHA      Stop with revision-changed when the PR head differs.
  --expect-base SHA      Stop with revision-changed when the PR base differs.
  --since ISO            Report discussion activity at or after this time. Pass the
                         previous run's observedAt or the time of your last full
                         inventory (default: first observation of this run).
  --reviewer LOGIN       Review account to track; repeatable (default: coderabbitai).
  --require-check NAME   Expected check/status context; repeatable. CI is not complete
                         until it is reported and finished.
  --ignore-check NAME    Check excluded from failure and completion; repeatable.
  --allow-no-checks      Treat an empty check rollup as complete (only after verifying
                         that no CI is expected).
  --include-self         Report activity by the authenticated account.
  --interval SEC         First poll delay and delay after progress (default: 30).
  --max-interval SEC     Backoff ceiling (default: 120).
  --stall-timeout SEC    Exit stalled after this long without observable change
                         (default: 1800).
  --last-progress ISO    Continue a stall window from a previous run's lastProgressAt.
  --timeout SEC          Exit with timeout after this wall-clock budget; run again with
                         --since and --last-progress to continue (default: none).
  --once                 Take one snapshot and exit.

Reasons (exit 0): pr-closed, revision-changed, ci-failed, review-check-failed, activity,
settled, snapshot (--once). Exit 3: stalled. Exit 4: timeout. Exit 1: error. Exit 2: usage.
"settled" means CI finished without failures and every tracked reviewer completed its review
of the current head: its status check on the head succeeded, or, for a reviewer that posts no
status, it submitted a review of the head. A reviewer that finds nothing new posts no new
review, so its decision may be on an earlier commit. "settled" is not the completion gate.`;

const EXIT_CODES = { event: 0, error: 1, usage: 2, stalled: 3, timeout: 4 };
const EVENT_PRIORITY = ['pr-closed', 'revision-changed', 'ci-failed', 'review-check-failed', 'activity', 'settled'];
const DECISIVE_REVIEW_STATES = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
const MAX_CONSECUTIVE_ERRORS = 5;
const RATE_LIMIT_FLOOR = 100;
const SECONDARY_RATE_LIMIT_WAIT = 60;

const CONTEXTS_FRAGMENT = `fragment Contexts on StatusCheckRollupContextConnection {
  pageInfo { hasNextPage endCursor }
  nodes {
    __typename
    ... on CheckRun {
      name status conclusion detailsUrl
      isRequired(pullRequestNumber: $number)
      checkSuite { app { slug } workflowRun { workflow { name } } }
    }
    ... on StatusContext {
      context state targetUrl
      isRequired(pullRequestNumber: $number)
      creator { login }
    }
  }
}`;

const SNAPSHOT_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      url number state isDraft headRefName headRefOid baseRefName baseRefOid reviewDecision mergeStateStatus
      commits(last: 1) { nodes { commit { oid statusCheckRollup { contexts(first: 100) { ...Contexts } } } } }
      reviews(last: 100) { totalCount nodes { author { login } state submittedAt updatedAt url commit { oid } } }
      comments(last: 100) { totalCount nodes { author { login } createdAt updatedAt url } }
      reviewThreads(last: 100) {
        totalCount
        nodes { isResolved path comments(last: 5) { nodes { author { login } createdAt updatedAt url } } }
      }
    }
  }
}
${CONTEXTS_FRAGMENT}`;

const CONTEXTS_PAGE_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $after: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      commits(last: 1) { nodes { commit { oid statusCheckRollup { contexts(first: 100, after: $after) { ...Contexts } } } } }
    }
  }
}
${CONTEXTS_FRAGMENT}`;

class UsageError extends Error {}
class FatalError extends Error {}

/** A failure that a later poll can plausibly recover from; waitSeconds overrides the backoff delay. */
class RetryableError extends Error {
    constructor(message, waitSeconds = null) {
        super(message);
        this.waitSeconds = waitSeconds;
    }
}

function parseTarget(value) {
    let match = value.match(/^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/);
    if (!match) match = value.match(/^(?:([^/#\s]+)\/)?([^/#\s]+)\/([^/#\s]+)#(\d+)$/);
    if (!match) throw new UsageError(`Unrecognized pull request: ${value}`);
    return { host: match[1] || 'github.com', owner: match[2], repo: match[3], number: Number(match[4]) };
}

function parseSeconds(name, value, fallback) {
    if (value === undefined) return fallback;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new UsageError(`--${name} must be a positive number of seconds.`);
    return seconds;
}

function parseTime(name, value) {
    if (value === undefined) return undefined;
    const time = Date.parse(value);
    if (Number.isNaN(time)) throw new UsageError(`--${name} must be an ISO 8601 timestamp.`);
    return new Date(time).toISOString();
}

function parseOptions(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            allowPositionals: true,
            options: {
                'expect-head': { type: 'string' },
                'expect-base': { type: 'string' },
                since: { type: 'string' },
                reviewer: { type: 'string', multiple: true },
                'require-check': { type: 'string', multiple: true },
                'ignore-check': { type: 'string', multiple: true },
                'allow-no-checks': { type: 'boolean' },
                'include-self': { type: 'boolean' },
                interval: { type: 'string' },
                'max-interval': { type: 'string' },
                'stall-timeout': { type: 'string' },
                'last-progress': { type: 'string' },
                timeout: { type: 'string' },
                once: { type: 'boolean' },
                help: { type: 'boolean', short: 'h' },
            },
        });
    } catch (error) {
        throw new UsageError(error.message);
    }
    const { values, positionals } = parsed;
    if (values.help) return null;
    if (positionals.length !== 1) throw new UsageError('Expected exactly one pull request.');
    const interval = parseSeconds('interval', values.interval, 30);
    const maxInterval = parseSeconds('max-interval', values['max-interval'], 120);
    if (maxInterval < interval) throw new UsageError('--max-interval must not be lower than --interval.');
    return {
        target: parseTarget(positionals[0]),
        expectHead: values['expect-head']?.toLowerCase(),
        expectBase: values['expect-base']?.toLowerCase(),
        since: parseTime('since', values.since),
        reviewers: (values.reviewer ?? ['coderabbitai']).map(normalizeLogin),
        requireChecks: values['require-check'] ?? [],
        ignoreChecks: new Set(values['ignore-check'] ?? []),
        allowNoChecks: values['allow-no-checks'] ?? false,
        includeSelf: values['include-self'] ?? false,
        interval,
        maxInterval,
        stallTimeout: parseSeconds('stall-timeout', values['stall-timeout'], 1800),
        lastProgress: parseTime('last-progress', values['last-progress']),
        timeout: parseSeconds('timeout', values.timeout, null),
        once: values.once ?? false,
    };
}

/** REST reports bot logins as `name[bot]`, GraphQL as `name`; compare them in one form. */
function normalizeLogin(login) {
    return (login ?? 'ghost').replace(/\[bot\]$/i, '').toLowerCase();
}

function runGh(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(chunk));
        child.stderr.on('data', chunk => stderr.push(chunk));
        child.on('error', error => reject(error.code === 'ENOENT'
            ? new FatalError('GitHub CLI `gh` is not installed or not on PATH.')
            : error));
        child.on('close', code => resolve({
            code,
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8').trim(),
        }));
    });
}

/** Split `gh api --include` output into HTTP status, lower-cased headers, and body. */
function parseIncludedResponse(output) {
    const match = output.match(/^HTTP\/[\d.]+ (\d{3})[^\r\n]*\r?\n([\s\S]*?)\r?\n\r?\n([\s\S]*)$/);
    if (!match) return null;
    const headers = {};
    for (const line of match[2].split(/\r?\n/)) {
        const separator = line.indexOf(':');
        if (separator > 0) headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return { status: Number(match[1]), headers, body: match[3] };
}

function serverTime(headers) {
    const time = Date.parse(headers.date ?? '');
    return Number.isNaN(time) ? Date.now() : time;
}

function rateLimitWait(headers, now) {
    const retryAfter = Number(headers['retry-after']);
    if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter;
    const reset = Number(headers['x-ratelimit-reset']);
    if (headers['x-ratelimit-remaining'] === '0' && Number.isFinite(reset)) return Math.max(1, reset - now / 1000 + 1);
    return null;
}

async function graphql(target, query, variables) {
    const args = ['api', 'graphql', '--include', '--hostname', target.host, '-f', `query=${query}`];
    for (const [name, value] of Object.entries(variables)) {
        args.push(typeof value === 'number' ? '-F' : '-f', `${name}=${value}`);
    }
    const result = await runGh(args);
    const response = parseIncludedResponse(result.stdout);
    if (!response) throw new RetryableError(result.stderr || `gh exited with code ${result.code} without an HTTP response.`);
    const now = serverTime(response.headers);
    const detail = result.stderr || response.body.slice(0, 300);
    if (response.status === 401) throw new FatalError(`GitHub authentication failed for ${target.host}: ${detail}`);
    if (response.status === 403 || response.status === 429) {
        const wait = rateLimitWait(response.headers, now);
        if (wait !== null) throw new RetryableError(`GitHub rate limit reached: ${detail}`, wait);
        if (/rate limit/i.test(response.body)) throw new RetryableError(`GitHub secondary rate limit: ${detail}`, SECONDARY_RATE_LIMIT_WAIT);
        throw new FatalError(`GitHub denied access (HTTP ${response.status}): ${detail}`);
    }
    if (response.status >= 500) throw new RetryableError(`GitHub returned HTTP ${response.status}.`);
    if (response.status !== 200) throw new FatalError(`GitHub returned HTTP ${response.status}: ${detail}`);
    let payload;
    try {
        payload = JSON.parse(response.body);
    } catch {
        throw new RetryableError('GitHub returned a response that is not JSON.');
    }
    if (payload.errors?.length) {
        const message = payload.errors.map(error => error.message).join('; ');
        if (payload.errors.some(error => error.type === 'RATE_LIMITED')) {
            throw new RetryableError(`GitHub rate limit reached: ${message}`, rateLimitWait(response.headers, now) ?? SECONDARY_RATE_LIMIT_WAIT);
        }
        if (payload.errors.every(error => !error.type && /timeout|something went wrong/i.test(error.message))) {
            throw new RetryableError(`GitHub query failed: ${message}`);
        }
        throw new FatalError(`GitHub query failed: ${message}`);
    }
    const remaining = Number(response.headers['x-ratelimit-remaining']);
    const reset = Number(response.headers['x-ratelimit-reset']);
    return {
        data: payload.data,
        now,
        rateLimit: Number.isFinite(remaining) && Number.isFinite(reset) ? { remaining, reset } : null,
    };
}

function headCommit(pullRequest) {
    return pullRequest?.commits?.nodes?.[0]?.commit ?? null;
}

/** Fetch one consistent observation, following check-context pagination for the same head commit. */
async function observe(target) {
    const variables = { owner: target.owner, repo: target.repo, number: target.number };
    const first = await graphql(target, SNAPSHOT_QUERY, variables);
    const pullRequest = first.data?.repository?.pullRequest;
    if (!pullRequest) throw new FatalError(`Pull request ${target.owner}/${target.repo}#${target.number} was not found on ${target.host}.`);
    const commit = headCommit(pullRequest);
    let connection = commit?.statusCheckRollup?.contexts;
    const contexts = [...(connection?.nodes ?? [])];
    let rateLimit = first.rateLimit;
    while (connection?.pageInfo?.hasNextPage) {
        const page = await graphql(target, CONTEXTS_PAGE_QUERY, { ...variables, after: connection.pageInfo.endCursor });
        const pageCommit = headCommit(page.data?.repository?.pullRequest);
        if (pageCommit?.oid !== commit.oid) throw new RetryableError('The PR head changed while reading checks.', 0);
        connection = pageCommit.statusCheckRollup?.contexts;
        contexts.push(...(connection?.nodes ?? []));
        rateLimit = page.rateLimit ?? rateLimit;
    }
    return { viewer: first.data.viewer.login, pullRequest, contexts, now: first.now, rateLimit };
}

const CHECK_RUN_BUCKETS = {
    SUCCESS: 'pass',
    NEUTRAL: 'skipping',
    SKIPPED: 'skipping',
    FAILURE: 'fail',
    TIMED_OUT: 'fail',
    CANCELLED: 'fail',
    ACTION_REQUIRED: 'fail',
    STARTUP_FAILURE: 'fail',
    STALE: 'fail',
};
const STATUS_BUCKETS = { SUCCESS: 'pass', FAILURE: 'fail', ERROR: 'fail', PENDING: 'pending', EXPECTED: 'pending' };

function normalizeContext(node) {
    if (node.__typename === 'CheckRun') {
        return {
            name: node.name,
            kind: 'check-run',
            actor: node.checkSuite?.app?.slug ?? null,
            workflow: node.checkSuite?.workflowRun?.workflow?.name ?? null,
            status: node.status,
            conclusion: node.conclusion,
            bucket: node.status === 'COMPLETED' ? CHECK_RUN_BUCKETS[node.conclusion] ?? 'fail' : 'pending',
            required: node.isRequired,
            url: node.detailsUrl,
        };
    }
    return {
        name: node.context,
        kind: 'status',
        actor: node.creator?.login ?? null,
        workflow: null,
        status: node.state,
        conclusion: null,
        bucket: STATUS_BUCKETS[node.state] ?? 'pending',
        required: node.isRequired,
        url: node.targetUrl,
    };
}

function summarizeReview(review) {
    if (!review) return null;
    return { state: review.state, commit: review.commit?.oid ?? null, submittedAt: review.submittedAt, url: review.url };
}

function latestTime(items) {
    return items.reduce((latest, item) => (item.at > latest ? item.at : latest), '');
}

function evaluate(observation, options, since) {
    const pr = observation.pullRequest;
    const head = headCommit(pr)?.oid ?? pr.headRefOid;
    const viewer = normalizeLogin(observation.viewer);
    const reviewers = new Set(options.reviewers);

    const checks = observation.contexts.map(normalizeContext).map(check => ({
        ...check,
        ignored: options.ignoreChecks.has(check.name),
        reviewer: reviewers.has(normalizeLogin(check.actor)),
    }));
    const ciChecks = checks.filter(check => !check.reviewer);
    const counted = ciChecks.filter(check => !check.ignored);
    const counts = { pass: 0, fail: 0, pending: 0, skipping: 0 };
    for (const check of counted) counts[check.bucket] += 1;
    const missing = options.requireChecks.filter(name => !ciChecks.some(check => check.name === name));
    let ciState = 'complete';
    if (counts.fail) ciState = 'failed';
    else if (counts.pending || missing.length) ciState = 'pending';
    else if (!counted.length && !options.allowNoChecks) ciState = 'none';

    const reviewerChecks = checks.filter(check => check.reviewer);
    const inProgress = reviewerChecks.some(check => check.bucket === 'pending');
    const failedReviewerChecks = reviewerChecks.filter(check => check.bucket === 'fail' && !check.ignored);
    const reviews = pr.reviews.nodes.filter(review => review.state !== 'PENDING');
    const byTime = (left, right) => (left.submittedAt ?? '').localeCompare(right.submittedAt ?? '');
    const reviewerStates = [...reviewers].map(login => {
        const own = reviews.filter(review => normalizeLogin(review.author?.login) === login).sort(byTime);
        const latestOnHead = own.filter(review => review.commit?.oid === head).at(-1);
        const headChecks = reviewerChecks.filter(check => normalizeLogin(check.actor) === login);
        return {
            login,
            reviewedHead: headChecks.length ? headChecks.every(check => check.bucket === 'pass') : Boolean(latestOnHead),
            decision: summarizeReview(own.filter(review => DECISIVE_REVIEW_STATES.has(review.state)).at(-1)),
            latest: summarizeReview(own.at(-1)),
            latestOnHead: summarizeReview(latestOnHead),
        };
    });
    const reviewSettled = !inProgress && reviewerStates.every(state => state.reviewedHead);

    const allActivity = [
        ...reviews.map(review => ({
            kind: 'review',
            author: review.author?.login ?? 'ghost',
            state: review.state,
            at: review.updatedAt ?? review.submittedAt,
            url: review.url,
        })),
        ...pr.comments.nodes.map(comment => ({
            kind: 'comment',
            author: comment.author?.login ?? 'ghost',
            at: comment.updatedAt ?? comment.createdAt,
            url: comment.url,
        })),
        ...pr.reviewThreads.nodes.flatMap(thread => thread.comments.nodes.map(comment => ({
            kind: 'review-comment',
            author: comment.author?.login ?? 'ghost',
            at: comment.updatedAt ?? comment.createdAt,
            url: comment.url,
            path: thread.path,
            threadResolved: thread.isResolved,
        }))),
    ];
    const activity = allActivity
        .filter(item => item.at >= since && (options.includeSelf || normalizeLogin(item.author) !== viewer))
        .map(item => ({ ...item, deferred: inProgress && reviewers.has(normalizeLogin(item.author)) }))
        .sort((left, right) => left.at.localeCompare(right.at));

    const events = [];
    if (pr.state !== 'OPEN') events.push('pr-closed');
    if ((options.expectHead && !head.startsWith(options.expectHead))
        || (options.expectBase && !pr.baseRefOid.startsWith(options.expectBase))) events.push('revision-changed');
    if (ciState === 'failed') events.push('ci-failed');
    if (failedReviewerChecks.length) events.push('review-check-failed');
    if (activity.some(item => !item.deferred)) events.push('activity');
    if (ciState === 'complete' && reviewSettled) events.push('settled');

    const fingerprint = JSON.stringify([
        head, pr.baseRefOid, pr.state, pr.isDraft, pr.reviewDecision,
        checks.map(check => [check.kind, check.name, check.actor, check.status, check.conclusion].join('\u0000')).sort(),
        pr.reviews.totalCount, pr.comments.totalCount, pr.reviewThreads.totalCount,
        pr.reviewThreads.nodes.filter(thread => thread.isResolved).length,
        latestTime(allActivity),
    ]);

    return {
        events,
        fingerprint,
        snapshot: {
            viewer: observation.viewer,
            pr: {
                url: pr.url,
                number: pr.number,
                state: pr.state,
                isDraft: pr.isDraft,
                headRefName: pr.headRefName,
                headSha: head,
                baseRefName: pr.baseRefName,
                baseSha: pr.baseRefOid,
                reviewDecision: pr.reviewDecision,
                mergeStateStatus: pr.mergeStateStatus,
            },
            ci: { state: ciState, counts, missing, checks: ciChecks.map(({ reviewer, ...check }) => check) },
            review: {
                inProgress,
                settled: reviewSettled,
                reviewers: reviewerStates,
                checks: reviewerChecks.map(({ reviewer, ...check }) => check),
            },
            activity,
            truncated: {
                reviews: pr.reviews.totalCount > pr.reviews.nodes.length,
                comments: pr.comments.totalCount > pr.comments.nodes.length,
                reviewThreads: pr.reviewThreads.totalCount > pr.reviewThreads.nodes.length,
            },
        },
    };
}

function describe(observedAt, snapshot, events, nextSeconds) {
    const { ci, review, pr } = snapshot;
    const reviewState = review.inProgress ? 'in-progress' : review.settled ? 'reviewed-head' : 'waiting';
    const next = nextSeconds === null ? '' : ` next=${Math.round(nextSeconds)}s`;
    return `wait-pr: ${observedAt} head=${pr.headSha.slice(0, 7)} ci=${ci.state} `
        + `(pass ${ci.counts.pass}, fail ${ci.counts.fail}, pending ${ci.counts.pending}, skipping ${ci.counts.skipping}`
        + `${ci.missing.length ? `, missing ${ci.missing.length}` : ''}) review=${reviewState} `
        + `events=${events.join(',') || '-'}${next}`;
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    if (!options) {
        console.log(usage);
        return EXIT_CODES.event;
    }
    const started = Date.now();
    const deadline = options.timeout === null ? null : started + options.timeout * 1000;
    let delay = options.interval;
    let polls = 0;
    let consecutiveErrors = 0;
    let since = options.since;
    let lastProgressAt = options.lastProgress;
    let fingerprint = null;
    let latest = null;

    const finish = (reason, code) => {
        const { snapshot, observedAt, rateLimit } = latest;
        const output = { reason, events: latest.events, observedAt, lastProgressAt, since, polls, rateLimit, ...snapshot };
        process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        return code;
    };

    for (;;) {
        let observation;
        try {
            observation = await observe(options.target);
            consecutiveErrors = 0;
        } catch (error) {
            if (!(error instanceof RetryableError)) throw error;
            consecutiveErrors += 1;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                throw new FatalError(`${error.message} (${consecutiveErrors} consecutive failed polls)`);
            }
            let wait = error.waitSeconds ?? delay;
            if (deadline !== null) {
                if (Date.now() >= deadline) {
                    if (latest) return finish('timeout', EXIT_CODES.timeout);
                    throw new FatalError(`${error.message} (timeout reached before the first observation)`);
                }
                wait = Math.min(wait, (deadline - Date.now()) / 1000);
            }
            process.stderr.write(`wait-pr: ${error.message} Retrying in ${Math.round(wait)}s.\n`);
            await sleep(wait * 1000);
            delay = Math.min(delay * 2, options.maxInterval);
            continue;
        }

        polls += 1;
        const observedAt = new Date(observation.now).toISOString();
        since ??= observedAt;
        const result = evaluate(observation, options, since);
        if (result.fingerprint !== fingerprint) {
            if (fingerprint !== null || lastProgressAt === undefined) lastProgressAt = observedAt;
            if (fingerprint !== null) delay = options.interval;
            fingerprint = result.fingerprint;
        } else {
            delay = Math.min(delay * 2, options.maxInterval);
        }
        const rateLimit = observation.rateLimit
            ? { remaining: observation.rateLimit.remaining, resetAt: new Date(observation.rateLimit.reset * 1000).toISOString() }
            : null;
        latest = { snapshot: result.snapshot, events: result.events, observedAt, rateLimit };

        if (result.events.length) {
            process.stderr.write(`${describe(observedAt, result.snapshot, result.events, null)}\n`);
            const reason = EVENT_PRIORITY.find(event => result.events.includes(event));
            return finish(reason, EXIT_CODES.event);
        }
        if (options.once) {
            process.stderr.write(`${describe(observedAt, result.snapshot, result.events, null)}\n`);
            return finish('snapshot', EXIT_CODES.event);
        }
        if ((observation.now - Date.parse(lastProgressAt)) / 1000 >= options.stallTimeout) {
            return finish('stalled', EXIT_CODES.stalled);
        }
        if (deadline !== null && Date.now() >= deadline) return finish('timeout', EXIT_CODES.timeout);

        let wait = delay;
        if (observation.rateLimit && observation.rateLimit.remaining < RATE_LIMIT_FLOOR) {
            wait = Math.max(wait, observation.rateLimit.reset - observation.now / 1000 + 1);
        }
        if (deadline !== null) wait = Math.min(wait, Math.max(0, (deadline - Date.now()) / 1000));
        process.stderr.write(`${describe(observedAt, result.snapshot, result.events, wait)}\n`);
        await sleep(wait * 1000);
    }
}

main().then(code => {
    process.exitCode = code;
}, error => {
    process.stderr.write(`wait-pr: ${error instanceof UsageError ? `${error.message}\n\n${usage}` : error.message}\n`);
    process.exitCode = error instanceof UsageError ? EXIT_CODES.usage : EXIT_CODES.error;
});
