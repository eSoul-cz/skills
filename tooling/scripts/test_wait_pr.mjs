import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../../skills/final-pr-review/scripts/wait-pr.mjs', import.meta.url));
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

/** Fake `gh` that replays scripted `gh api --include` responses in order and logs its arguments. */
const FAKE_GH = `#!/usr/bin/env node
const fs = require('node:fs');
const dir = process.env.FAKE_GH_DIR;
const responses = JSON.parse(fs.readFileSync(dir + '/responses.json', 'utf8'));
const counter = dir + '/counter';
const index = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
fs.writeFileSync(counter, String(index + 1));
fs.appendFileSync(dir + '/calls.log', JSON.stringify(process.argv.slice(2)) + '\\n');
const response = responses[Math.min(index, responses.length - 1)];
const headers = Object.entries(response.headers ?? {}).map(([name, value]) => name + ': ' + value).join('\\r\\n');
process.stdout.write('HTTP/2.0 ' + response.status + ' X\\r\\n' + headers + '\\r\\n\\r\\n' + JSON.stringify(response.body));
if (response.status !== 200) process.stderr.write('gh: HTTP ' + response.status + '\\n');
process.exitCode = response.status === 200 ? 0 : 1;
`;

function checkRun(name, status, conclusion = null, app = 'github-actions') {
    return {
        __typename: 'CheckRun', name, status, conclusion, detailsUrl: `https://ci/${name}`, isRequired: true,
        checkSuite: { app: { slug: app }, workflowRun: null },
    };
}

function status(context, state, creator) {
    return { __typename: 'StatusContext', context, state, targetUrl: null, isRequired: false, creator: { login: creator } };
}

function review(author, state, at, commit = HEAD) {
    return { author: { login: author }, state, submittedAt: at, updatedAt: at, url: `https://pr/review/${at}`, commit: { oid: commit } };
}

function comment(author, at) {
    return { author: { login: author }, createdAt: at, updatedAt: at, url: `https://pr/comment/${at}` };
}

function snapshot({ contexts = [], nextPage = null, reviews = [], comments = [], head = HEAD, state = 'OPEN' } = {}) {
    return {
        status: 200,
        headers: { 'X-Ratelimit-Remaining': '4000', 'X-Ratelimit-Reset': '4102444800' },
        body: {
            data: {
                viewer: { login: 'agent' },
                repository: {
                    pullRequest: {
                        url: 'https://github.com/o/r/pull/7', number: 7, state, isDraft: false,
                        headRefName: 'feature', headRefOid: head, baseRefName: 'main', baseRefOid: BASE,
                        reviewDecision: null, mergeStateStatus: 'BLOCKED',
                        commits: { nodes: [{ commit: { oid: head, statusCheckRollup: { contexts: {
                            pageInfo: { hasNextPage: nextPage !== null, endCursor: nextPage }, nodes: contexts,
                        } } } }] },
                        reviews: { totalCount: reviews.length, nodes: reviews },
                        comments: { totalCount: comments.length, nodes: comments },
                        reviewThreads: { totalCount: 0, nodes: [] },
                    },
                },
            },
        },
    };
}

function contextsPage(contexts, head = HEAD) {
    return {
        status: 200,
        headers: {},
        body: { data: { repository: { pullRequest: { commits: { nodes: [{ commit: { oid: head, statusCheckRollup: { contexts: {
            pageInfo: { hasNextPage: false, endCursor: null }, nodes: contexts,
        } } } }] } } } } },
    };
}

async function run(responses, args) {
    const dir = await mkdtemp(join(tmpdir(), 'wait-pr-test-'));
    try {
        await writeFile(join(dir, 'gh'), FAKE_GH);
        await chmod(join(dir, 'gh'), 0o755);
        await writeFile(join(dir, 'responses.json'), JSON.stringify(responses));
        const child = spawn(process.execPath, [script, 'o/r#7', '--interval', '0.05', '--max-interval', '0.1', ...args], {
            env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, FAKE_GH_DIR: dir },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        const code = await new Promise(resolve => child.on('close', resolve));
        const calls = (await readFile(join(dir, 'calls.log'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(JSON.parse);
        return { code, output: stdout ? JSON.parse(stdout) : null, stderr, calls };
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

const coderabbitPending = status('CodeRabbit', 'PENDING', 'coderabbitai');
const coderabbitDone = status('CodeRabbit', 'SUCCESS', 'coderabbitai');

test('CI failure returns immediately even while review is still running', async () => {
    const { code, output } = await run([
        snapshot({ contexts: [checkRun('build', 'COMPLETED', 'FAILURE'), checkRun('lint', 'IN_PROGRESS'), coderabbitPending] }),
    ], ['--since', '2026-01-01T00:00:00Z']);
    assert.equal(code, 0);
    assert.equal(output.reason, 'ci-failed');
    assert.equal(output.ci.state, 'failed');
    assert.deepEqual(output.ci.checks.filter(check => check.bucket === 'fail').map(check => check.name), ['build']);
    assert.equal(output.review.inProgress, true);
});

test('waits until CI completes and the reviewer has reviewed the current head', async () => {
    const { code, output } = await run([
        snapshot({ contexts: [checkRun('build', 'IN_PROGRESS'), coderabbitPending] }),
        snapshot({ contexts: [checkRun('build', 'COMPLETED', 'SUCCESS'), coderabbitPending] }),
        snapshot({
            contexts: [checkRun('build', 'COMPLETED', 'SUCCESS'), coderabbitDone],
            reviews: [review('coderabbitai', 'COMMENTED', '2025-12-01T00:00:00Z', 'c'.repeat(40)), review('coderabbitai', 'APPROVED', '2025-12-02T00:00:00Z')],
        }),
    ], ['--since', '2026-01-01T00:00:00Z']);
    assert.equal(code, 0);
    assert.equal(output.reason, 'settled');
    assert.equal(output.polls, 3);
    assert.equal(output.review.reviewers[0].latestOnHead.state, 'APPROVED');
    assert.equal(output.ci.checks.some(check => check.name === 'CodeRabbit'), false, 'reviewer status is not CI');
});

test('a completed reviewer check on the head settles review with an earlier-commit approval', async () => {
    const { code, output } = await run([
        snapshot({
            contexts: [checkRun('build', 'COMPLETED', 'SUCCESS'), coderabbitDone],
            reviews: [
                review('coderabbitai', 'APPROVED', '2025-12-01T00:00:00Z', 'c'.repeat(40)),
                review('coderabbitai', 'COMMENTED', '2025-12-02T00:00:00Z', 'c'.repeat(40)),
            ],
        }),
    ], ['--since', '2026-01-01T00:00:00Z']);
    assert.equal(code, 0);
    assert.equal(output.reason, 'settled');
    assert.equal(output.review.reviewers[0].reviewedHead, true);
    assert.equal(output.review.reviewers[0].latestOnHead, null);
    assert.equal(output.review.reviewers[0].decision.state, 'APPROVED');
});

test('a failed reviewer check is reported instead of counting the head as reviewed', async () => {
    const { output } = await run([
        snapshot({
            contexts: [checkRun('build', 'COMPLETED', 'SUCCESS'), status('CodeRabbit', 'ERROR', 'coderabbitai')],
            reviews: [review('coderabbitai', 'APPROVED', '2025-12-01T00:00:00Z')],
        }),
    ], []);
    assert.equal(output.reason, 'review-check-failed');
    assert.equal(output.review.settled, false);
});

test('without a reviewer status, only a review of the head settles review', async () => {
    const { output } = await run([
        snapshot({
            contexts: [checkRun('build', 'COMPLETED', 'SUCCESS')],
            reviews: [review('coderabbitai', 'APPROVED', '2025-12-01T00:00:00Z', 'c'.repeat(40))],
        }),
    ], ['--once']);
    assert.equal(output.reason, 'snapshot');
    assert.equal(output.review.settled, false);
});

test('reviewer activity waits for the review to finish; own comments never trigger', async () => {
    const reviewerComment = comment('coderabbitai', '2026-01-02T00:00:00Z');
    const ownComment = comment('agent', '2026-01-02T00:00:01Z');
    const { output } = await run([
        snapshot({ contexts: [checkRun('build', 'IN_PROGRESS'), coderabbitPending], comments: [reviewerComment, ownComment] }),
        snapshot({ contexts: [checkRun('build', 'IN_PROGRESS'), coderabbitDone], comments: [reviewerComment, ownComment] }),
    ], ['--since', '2026-01-01T00:00:00Z']);
    assert.equal(output.reason, 'activity');
    assert.equal(output.polls, 2);
    assert.deepEqual(output.activity.map(item => [item.author, item.deferred]), [['coderabbitai', false]]);
});

test('human activity is reported without waiting for the reviewer', async () => {
    const { output } = await run([
        snapshot({ contexts: [coderabbitPending], comments: [comment('octocat', '2026-01-02T00:00:00Z'), comment('octocat', '2025-01-01T00:00:00Z')] }),
    ], ['--since', '2026-01-01T00:00:00Z']);
    assert.equal(output.reason, 'activity');
    assert.deepEqual(output.activity.map(item => item.at), ['2026-01-02T00:00:00Z']);
});

test('a moved head is reported before any other event', async () => {
    const { output } = await run([
        snapshot({ head: 'd'.repeat(40), contexts: [checkRun('build', 'COMPLETED', 'FAILURE')] }),
    ], ['--expect-head', HEAD.slice(0, 7)]);
    assert.equal(output.reason, 'revision-changed');
    assert.deepEqual(output.events, ['revision-changed', 'ci-failed']);
});

test('a failure on a later check page is not missed', async () => {
    const { output, calls } = await run([
        snapshot({ contexts: [checkRun('build', 'COMPLETED', 'SUCCESS')], nextPage: 'cursor-1' }),
        contextsPage([checkRun('e2e', 'COMPLETED', 'TIMED_OUT')]),
    ], []);
    assert.equal(output.reason, 'ci-failed');
    assert.ok(calls[1].includes('after=cursor-1'));
});

test('missing required checks and empty rollups keep CI pending until stalled', async () => {
    const missing = await run([
        snapshot({ contexts: [checkRun('build', 'COMPLETED', 'SUCCESS')], reviews: [review('coderabbitai', 'APPROVED', '2025-12-02T00:00:00Z')] }),
    ], ['--require-check', 'deploy-preview', '--stall-timeout', '0.3']);
    assert.equal(missing.code, 3);
    assert.equal(missing.output.reason, 'stalled');
    assert.deepEqual(missing.output.ci.missing, ['deploy-preview']);

    const empty = await run([
        snapshot({ reviews: [review('coderabbitai', 'APPROVED', '2025-12-02T00:00:00Z')] }),
    ], ['--stall-timeout', '0.3']);
    assert.equal(empty.output.ci.state, 'none');
    assert.equal(empty.output.reason, 'stalled');
});

test('ignored checks and explicit empty CI allow settling', async () => {
    const { output } = await run([
        snapshot({ contexts: [checkRun('flaky-baseline', 'COMPLETED', 'FAILURE')], reviews: [review('coderabbitai', 'APPROVED', '2025-12-02T00:00:00Z')] }),
    ], ['--ignore-check', 'flaky-baseline', '--allow-no-checks']);
    assert.equal(output.reason, 'settled');
    assert.equal(output.ci.checks[0].ignored, true);
});

test('rate limiting is waited out instead of failing', async () => {
    const { code, output, stderr } = await run([
        { status: 403, headers: { 'Retry-After': '0.1' }, body: { message: 'You have exceeded a secondary rate limit.' } },
        snapshot({ contexts: [checkRun('build', 'COMPLETED', 'FAILURE')] }),
    ], []);
    assert.equal(code, 0);
    assert.equal(output.reason, 'ci-failed');
    assert.match(stderr, /rate limit/);
});

test('persistent outages and authentication failures exit with an error', async () => {
    const outage = await run([{ status: 502, headers: {}, body: {} }], []);
    assert.equal(outage.code, 1);
    assert.equal(outage.calls.length, 5);

    const auth = await run([{ status: 401, headers: {}, body: { message: 'Bad credentials' } }], []);
    assert.equal(auth.code, 1);
    assert.equal(auth.calls.length, 1);
    assert.match(auth.stderr, /authentication failed/);
});

test('timeout exits with the latest snapshot so the caller can resume', async () => {
    const { code, output } = await run([snapshot({ contexts: [checkRun('build', 'IN_PROGRESS')] })], ['--timeout', '0.2']);
    assert.equal(code, 4);
    assert.equal(output.reason, 'timeout');
    assert.equal(output.ci.state, 'pending');
    assert.ok(output.lastProgressAt);
});
