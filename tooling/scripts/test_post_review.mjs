import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
    commentableLines,
    findingId,
    parseTarget,
    parseWait,
    planReview,
    rateLimitState,
} from '../../skills/pre-pr-review/scripts/post-review.mjs';

const script = fileURLToPath(new URL('../../skills/pre-pr-review/scripts/post-review.mjs', import.meta.url));
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const PR_URL = 'https://github.com/o/r/pull/7';

/** Fake `gh` that answers by the first route whose pattern matches its arguments, and logs calls and stdin. */
// The shebang names the running Node binary, so the fake uses the same runtime as the test.
const FAKE_GH = `#!${process.execPath}
const fs = require('node:fs');
const dir = process.env.FAKE_GH_DIR;
const args = process.argv.slice(2);
const stdin = args.includes('--input') ? fs.readFileSync(0, 'utf8') : null;
fs.appendFileSync(dir + '/calls.log', JSON.stringify({ args, stdin }) + '\\n');
const routes = JSON.parse(fs.readFileSync(dir + '/routes.json', 'utf8'));
const counter = dir + '/counter.json';
const counts = fs.existsSync(counter) ? JSON.parse(fs.readFileSync(counter, 'utf8')) : {};
const joined = args.join(' ');
const index = routes.findIndex((route) => new RegExp(route.match).test(joined) && (route.times === undefined || (counts[route.match] ?? 0) < route.times));
if (index === -1) { process.stderr.write('gh: no route for ' + joined + ' (HTTP 404)'); process.exit(1); }
const route = routes[index];
counts[route.match] = (counts[route.match] ?? 0) + 1;
fs.writeFileSync(counter, JSON.stringify(counts));
if (route.status && route.status !== 200) { process.stderr.write('gh: Unprocessable Entity (HTTP ' + route.status + ')'); process.exit(1); }
process.stdout.write(JSON.stringify(route.body));
`;

const PATCH = [
    '@@ -1,3 +1,4 @@',
    ' <?php',
    '-$a = 1;',
    '+$a = 2;',
    '+$b = 3;',
    ' return $a;',
    '@@ -20,2 +21,2 @@',
    ' function x() {}',
    '+function y() {}',
].join('\n');

function pr(head = HEAD, state = 'open') {
    return { html_url: PR_URL, state, head: { sha: head }, base: { sha: BASE } };
}

function threadsResponse(nodes = []) {
    return { data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } } };
}

async function fakeGh(t, routes) {
    const dir = await mkdtemp(join(tmpdir(), 'post-review-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await writeFile(join(dir, 'gh'), FAKE_GH);
    await chmod(join(dir, 'gh'), 0o755);
    await writeFile(join(dir, 'routes.json'), JSON.stringify(routes));
    await writeFile(join(dir, 'calls.log'), '');
    return {
        dir,
        run: (...args) => {
            const result = spawnSync(process.execPath, [script, ...args], {
                encoding: 'utf8', env: { ...process.env, FAKE_GH_DIR: dir, PATH: `${dir}${delimiter}${process.env.PATH}` },
            });
            return { ...result, json: result.status === 0 ? JSON.parse(result.stdout) : null };
        },
        calls: async () => (await readFile(join(dir, 'calls.log'), 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)),
    };
}

function finding(overrides = {}) {
    return {
        severity: 'Major', title: 'Value is overwritten', path: 'src/a.php', line: 3,
        body: '**Evidence:** `$b` shadows `$a`.', ...overrides,
    };
}

const ROUTES = (extra = []) => [
    ...extra,
    { match: 'pulls/7/files', body: [{ filename: 'src/a.php', patch: PATCH }, { filename: 'logo.png' }] },
    { match: 'graphql', body: threadsResponse() },
    { match: 'pulls/7/reviews\\?', body: [] },
    { match: '--method POST .*pulls/7/reviews', body: { id: 99, html_url: `${PR_URL}#pullrequestreview-99` } },
    { match: 'pulls/7$', body: pr() },
];

test('parses PR references and CodeRabbit wait times', () => {
    assert.deepEqual(parseTarget(PR_URL), { host: 'github.com', owner: 'o', repo: 'r', number: 7 });
    assert.deepEqual(parseTarget('ghe.example/o/r#3'), { host: 'ghe.example', owner: 'o', repo: 'r', number: 3 });
    assert.equal(parseWait('Please wait **21 minutes and 3 seconds** before requesting another review.'), 1263);
    assert.equal(parseWait('Please wait **1 hour, 2 minutes and 5 seconds**'), 3725);
    assert.equal(parseWait('No timing here'), null);
});

test('maps commentable right-side lines to hunks', () => {
    const lines = commentableLines(PATCH);
    assert.deepEqual([...lines.entries()], [[1, 0], [2, 0], [3, 0], [4, 0], [21, 1], [22, 1]]);
    assert.equal(commentableLines(undefined).size, 0);
});

test('finding ids are stable across wording noise and overridable', () => {
    assert.equal(findingId(finding()), findingId(finding({ title: '  value IS overwritten!' })));
    assert.notEqual(findingId(finding()), findingId(finding({ path: 'src/b.php' })));
    assert.equal(findingId(finding({ id: 'FE-1' })), 'FE-1');
});

// Shape of CodeRabbit's real notice (eSoul-cz/eywo#2), shortened.
const NOTICE = `<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->

> [!WARNING]
> ## Rate limit exceeded
>
> \`@someone\` has exceeded the limit for the number of commits that can be reviewed per hour. Please wait **10 minutes and 0 seconds** before requesting another review.
>
> You’ve run out of usage credits. Purchase more in the billing tab.`;

test('detects a CodeRabbit rate-limit notice newer than its last review', () => {
    const comments = [
        { user: { login: 'coderabbitai[bot]' }, updated_at: '2026-10-29T10:00:00Z', html_url: 'u1', body: NOTICE },
        { user: { login: 'someone' }, updated_at: '2026-10-29T11:00:00Z', html_url: 'u2', body: NOTICE },
        { user: { login: 'coderabbitai[bot]' }, updated_at: '2026-10-29T12:00:00Z', html_url: 'u3', body: '## Walkthrough\nAdds API rate limit middleware (rate limit exceeded → 429).' },
    ];
    const limited = rateLimitState({ comments, reviews: [{ user: { login: 'coderabbitai[bot]' }, submitted_at: '2026-10-29T09:00:00Z' }], reviewer: 'coderabbitai' });
    assert.equal(limited.rateLimited, true);
    assert.equal(limited.creditsExhausted, true);
    assert.deepEqual(limited.notice, { url: 'u1', updatedAt: '2026-10-29T10:00:00Z', resetAt: '2026-10-29T10:10:00.000Z', creditsExhausted: true });

    const recovered = rateLimitState({ comments, reviews: [{ user: { login: 'coderabbitai[bot]' }, submitted_at: '2026-10-29T10:30:00Z' }], reviewer: 'coderabbitai' });
    assert.equal(recovered.rateLimited, false, 'a later review clears the notice; a walkthrough about rate limiting is not a notice');

    const byStatus = rateLimitState({ comments: [], reviews: [], statuses: [{ context: 'CodeRabbit', state: 'failure', description: 'Review rate limit exceeded' }], reviewer: 'coderabbitai' });
    assert.equal(byStatus.rateLimited, true);
    const byCheckRun = rateLimitState({ comments: [], reviews: [], checkRuns: [{ name: 'CodeRabbit', app: { slug: 'coderabbitai' }, status: 'completed', conclusion: 'failure', output: { title: 'Review rate limit exceeded' } }], reviewer: 'coderabbitai' });
    assert.equal(byCheckRun.rateLimited, true);
    assert.equal(byCheckRun.checkRun.conclusion, 'failure');
    const finished = rateLimitState({ comments: [], reviews: [], checkRuns: [{ name: 'CodeRabbit', app: { slug: 'coderabbitai' }, output: { title: 'Finished' } }], reviewer: 'coderabbitai' });
    assert.equal(finished.rateLimited, false);
});

test('places findings inline, outside the diff, or skips them as duplicates', () => {
    const input = {
        head: HEAD,
        language: 'cs',
        reason: 'CodeRabbit narazil na limit.',
        summary: 'Shrnutí změn.',
        findings: [
            finding({ suggestion: '$b = $a + 1;' }),
            finding({ title: 'Range across hunks', startLine: 4, line: 21 }),
            finding({ title: 'Multi-line', startLine: 2, line: 4 }),
            finding({ title: 'Binary file', path: 'logo.png', line: 1 }),
            finding({ title: 'Already open' }),
            finding({ title: 'Was resolved' }),
            finding({ title: 'In earlier body', path: 'src/z.php', line: 9 }),
        ],
    };
    const threads = [
        { isResolved: false, isOutdated: false, path: 'src/a.php', line: 3, comments: { nodes: [{ url: 'open-url', body: `🟠 **Major** · **Already open**\n\n<!-- pre-pr-review:finding:${findingId(finding({ title: 'Already open' }))} -->` }] } },
        { isResolved: true, isOutdated: false, path: 'src/a.php', line: 3, comments: { nodes: [{ url: 'resolved-url', body: `x\n<!-- pre-pr-review:finding:${findingId(finding({ title: 'Was resolved' }))} -->` }] } },
        { isResolved: false, isOutdated: false, path: 'src/a.php', line: 2, comments: { nodes: [{ url: 'human', body: 'A human comment' }] } },
    ];
    const earlier = `<!-- pre-pr-review:finding:${findingId(finding({ title: 'In earlier body', path: 'src/z.php' }))} -->`;
    const plan = planReview({ input, files: [{ filename: 'src/a.php', patch: PATCH }, { filename: 'logo.png' }], threads, reviewBodies: [earlier, null] });

    assert.equal(plan.upToDate, false);
    assert.equal(plan.payload.event, 'COMMENT');
    assert.equal(plan.payload.commit_id, HEAD);
    assert.deepEqual(plan.payload.comments.map(({ path, line, start_line }) => [path, line, start_line]), [
        ['src/a.php', 3, undefined], ['src/a.php', 4, 2], ['src/a.php', 3, undefined],
    ]);
    assert.match(plan.payload.comments[0].body, /^🟠 \*\*Major\*\* · \*\*Value is overwritten\*\*/);
    assert.match(plan.payload.comments[0].body, /```suggestion\n\$b = \$a \+ 1;\n```/);
    assert.match(plan.payload.comments[0].body, /<!-- pre-pr-review:finding:[0-9a-f]{12} -->$/);
    assert.equal(plan.outside.length, 2, 'cross-hunk range and binary file go to the body');
    assert.deepEqual(plan.duplicates.map((duplicate) => duplicate.url), ['open-url', null]);
    assert.deepEqual(plan.existing.map((entry) => [entry.title, entry.resolved]), [['Already open', false], [null, true]]);

    const { body } = plan.payload;
    assert.ok(body.startsWith(`<!-- pre-pr-review:review head=${HEAD} -->\n\n## 🤖 Pre-PR review (náhrada za CodeRabbit)`));
    assert.match(body, /CodeRabbit narazil na limit\. Tuto review vytvořil agent/);
    assert.match(body, /\*\*Inline nálezy:\*\* 3 · \*\*Mimo diff:\*\* 2 · \*\*Už nahlášeno:\*\* 2/);
    assert.match(body, /<summary>Nálezy mimo rozsah diffu \(2\)<\/summary>/);
    assert.match(body, /`src\/a\.php:4-21`/);
});

test('approves a head only when nothing was found and no fallback thread is open', () => {
    const files = [{ filename: 'src/a.php', patch: PATCH }];
    const openThread = { isResolved: false, isOutdated: false, path: 'src/a.php', line: 3, comments: { nodes: [{ url: 'u', body: `<!-- pre-pr-review:finding:${findingId(finding())} -->` }] } };
    const resolvedThread = { ...openThread, isResolved: true };

    const clean = planReview({ input: { head: HEAD, language: 'cs', findings: [] }, files, threads: [resolvedThread], reviewBodies: [] });
    assert.equal(clean.approved, true);
    assert.ok(clean.payload.body.startsWith(`<!-- pre-pr-review:review head=${HEAD} -->\n<!-- pre-pr-review:approved head=${HEAD} -->`));
    assert.match(clean.payload.body, /✅ Schváleno skillem `pre-pr-review` \(náhrada za CodeRabbit\)/);
    assert.equal(clean.payload.event, 'COMMENT', 'never a GitHub approval');

    const stillOpen = planReview({ input: { head: HEAD, findings: [] }, files, threads: [openThread], reviewBodies: [] });
    assert.equal(stillOpen.approved, false);
    assert.equal(stillOpen.openFindings, 1);
    assert.match(stillOpen.payload.body, /⏳ Not approved yet\n1 finding\(s\)/);
    assert.ok(!stillOpen.payload.body.includes(':approved head='));

    const withFindings = planReview({ input: { head: HEAD, findings: [finding({ title: 'New problem' })] }, files, threads: [], reviewBodies: [] });
    assert.equal(withFindings.approved, false);
    assert.equal(withFindings.openFindings, 1);

    const reviewedBefore = [`<!-- pre-pr-review:review head=${HEAD} -->`];
    const nowResolved = planReview({ input: { head: HEAD, findings: [] }, files, threads: [resolvedThread], reviewBodies: reviewedBefore });
    assert.equal(nowResolved.upToDate, false, 'threads resolved since the last review: post the approval');
    const alreadyApproved = planReview({ input: { head: HEAD, findings: [] }, files, threads: [resolvedThread], reviewBodies: [`${reviewedBefore[0]}\n<!-- pre-pr-review:approved head=${HEAD} -->`] });
    assert.equal(alreadyApproved.upToDate, true);
});

test('a body-only finding blocks approval until a later review records its resolution', () => {
    const files = [{ filename: 'src/a.php', patch: PATCH }];
    const id = findingId(finding({ title: 'Outside', path: 'src/z.php' }));
    const earlier = `<!-- pre-pr-review:review head=${'c'.repeat(40)} -->\n<!-- pre-pr-review:finding:${id} -->`;

    const blocked = planReview({ input: { head: HEAD, findings: [] }, files, threads: [], reviewBodies: [earlier] });
    assert.equal(blocked.approved, false);
    assert.deepEqual(blocked.openInBodies, [id]);
    assert.equal(blocked.openFindings, 1);

    const resolving = planReview({ input: { head: HEAD, language: 'cs', findings: [], resolved: [{ id, note: 'Opraveno v abc1234, ověřeno testem; ping @someone' }] }, files, threads: [], reviewBodies: [earlier] });
    assert.equal(resolving.approved, true);
    assert.match(resolving.payload.body, /<summary>Vyřešené nálezy mimo diff \(1\)<\/summary>/);
    assert.match(resolving.payload.body, new RegExp(`- \`${id}\`: Opraveno v abc1234, ověřeno testem; ping @​someone <!-- pre-pr-review:resolved:${id} -->`));

    const later = planReview({ input: { head: HEAD, findings: [] }, files, threads: [], reviewBodies: [earlier, resolving.payload.body] });
    assert.deepEqual(later.openInBodies, [], 'a recorded resolution persists across reviews');
    assert.equal(later.upToDate, true);

    const reappears = planReview({ input: { head: HEAD, findings: [finding({ title: 'Outside', path: 'src/z.php' })] }, files, threads: [], reviewBodies: [earlier, resolving.payload.body] });
    assert.deepEqual(reappears.outside, [id], 'a resolved body finding found again is reported again');

    const history = [earlier, resolving.payload.body, reappears.payload.body];
    const afterReopen = planReview({ input: { head: HEAD, findings: [] }, files, threads: [], reviewBodies: history });
    assert.equal(afterReopen.approved, false, 'the newer report reopens it despite the older resolution');
    assert.deepEqual(afterReopen.openInBodies, [id]);
    const resolvedAgain = planReview({ input: { head: HEAD, findings: [], resolved: [{ id, note: 'Opraveno znovu v def5678.' }] }, files, threads: [], reviewBodies: history });
    assert.equal(resolvedAgain.approved, true);
    assert.equal(resolvedAgain.upToDate, false);

    assert.deepEqual(planReview({ input: { head: HEAD, findings: [], resolved: [{ id: 'nope', note: 'x' }] }, files, threads: [], reviewBodies: [] }).unknownResolved, ['nope']);
});

test('defangs mentions in published text but not in code or suggestions', () => {
    const plan = planReview({
        input: {
            head: HEAD, reason: 'Limit hit, @coderabbitai review later', summary: 'Thanks @alice', verdict: 'cc @bob',
            findings: [finding({ title: 'Ask @carol', body: 'See `@scope/pkg` and @dave', suggestion: '$x = "@keep";' })],
        },
        files: [{ filename: 'src/a.php', patch: PATCH }], threads: [], reviewBodies: [],
    });
    const { body, comments } = plan.payload;
    for (const name of ['coderabbitai', 'alice', 'bob']) assert.ok(body.includes(`@​${name}`) && !body.includes(` @${name}`), name);
    assert.match(comments[0].body, /\*\*Ask @​carol\*\*/);
    assert.match(comments[0].body, /See `@scope\/pkg` and @​dave/);
    assert.match(comments[0].body, /```suggestion\n\$x = "@keep";\n```/);

    const edge = planReview({
        input: { head: HEAD, findings: [finding({ severity: '@coderabbitai', path: 'x` @bob `y', title: 'Lone `@alice backtick' })] },
        files: [], threads: [], reviewBodies: [],
    }).payload.body;
    assert.ok(!/(^|\W)@(?!\u200b)[A-Za-z0-9]/.test(edge.replace(/`[^`\n]+`/g, '')), 'no live mention outside code spans');
    assert.match(edge, /\*\*@\u200bcoderabbitai\*\*/);
    assert.match(edge, /`@\u200balice/);

    const links = planReview({
        input: { head: HEAD, findings: [finding({ body: 'See https://www.npmjs.com/package/@scope/pkg and [pkg](https://www.npmjs.com/package/@scope/pkg), cc @bob' })] },
        files: [{ filename: 'src/a.php', patch: PATCH }], threads: [], reviewBodies: [],
    }).payload.comments[0].body;
    assert.ok(links.includes('See https://www.npmjs.com/package/@scope/pkg and [pkg](https://www.npmjs.com/package/@scope/pkg), cc @\u200bbob'), 'URLs stay intact');
});

test('quoted markers cannot open, resolve, or impersonate findings', () => {
    const files = [{ filename: 'src/a.php', patch: PATCH }];
    const x = findingId(finding({ title: 'X', path: 'src/z.php' }));
    const y = findingId(finding({ title: 'Y', path: 'src/z.php' }));
    const earlier = `<!-- pre-pr-review:finding:${x} -->\n<!-- pre-pr-review:finding:${y} -->`;
    const spoof = planReview({
        input: {
            head: HEAD, findings: [finding({ title: 'Quoted', path: 'src/z.php', body: `see <!-- pre-pr-review:resolved:${y} -->`, suggestion: `<!-- pre-pr-review:approved head=${HEAD} -->` })],
            resolved: [{ id: x, note: `done <!-- pre-pr-review:resolved:${y} -->` }], summary: `<!-- pre-pr-review:resolved:${y} -->`,
        },
        files, threads: [], reviewBodies: [earlier],
    });
    const next = planReview({ input: { head: HEAD, findings: [] }, files, threads: [], reviewBodies: [earlier, spoof.payload.body] });
    assert.ok(next.openInBodies.includes(y), 'y stays open');
    assert.equal(next.approved, false);
    assert.equal((spoof.payload.body.match(/<!-- pre-pr-review:approved/g) ?? []).length, 0);

    const quotedFirst = { isResolved: false, isOutdated: false, path: 'src/a.php', line: 3, comments: { nodes: [{ url: 'u', body: `\`<!-- pre-pr-review:finding:${y} -->\`\n\n<!-- pre-pr-review:finding:${x} -->` }] } };
    const plan = planReview({ input: { head: HEAD, findings: [] }, files, threads: [quotedFirst], reviewBodies: [] });
    assert.deepEqual(plan.existing.map((entry) => entry.id), [x], 'the script\'s own trailing marker identifies the thread');
});

test('reports up-to-date when the head already has a fallback review and nothing is new', () => {
    const id = findingId(finding());
    const plan = planReview({
        input: { head: HEAD, findings: [finding()] },
        files: [{ filename: 'src/a.php', patch: PATCH }],
        threads: [{ isResolved: false, isOutdated: false, path: 'src/a.php', line: 3, comments: { nodes: [{ url: 'u', body: `<!-- pre-pr-review:finding:${id} -->` }] } }],
        reviewBodies: [`<!-- pre-pr-review:review head=${HEAD} -->`],
    });
    assert.equal(plan.upToDate, true);
    assert.equal(planReview({ input: { head: HEAD, findings: [] }, files: [], threads: [], reviewBodies: [] }).upToDate, false, 'a clean first review is still posted once');
});

test('dry run prints the payload and posts nothing', async (t) => {
    const gh = await fakeGh(t, ROUTES());
    const file = join(gh.dir, 'findings.json');
    await writeFile(file, JSON.stringify({ head: HEAD, findings: [finding()] }));

    const { json, status, stderr } = gh.run('post', PR_URL, '--findings', file);
    assert.equal(status, 0, stderr);
    assert.equal(json.dryRun, true);
    assert.equal(json.posted, false);
    assert.equal(json.payload.comments.length, 1);
    assert.ok(!(await gh.calls()).some((call) => call.args.includes('POST')));
});

test('posts one COMMENT review and falls back to a body-only review on 422', async (t) => {
    const gh = await fakeGh(t, ROUTES());
    const file = join(gh.dir, 'findings.json');
    await writeFile(file, JSON.stringify({ head: HEAD, findings: [finding()] }));
    const posted = gh.run('post', PR_URL, '--findings', file, '--post');
    assert.equal(posted.status, 0, posted.stderr);
    assert.equal(posted.json.url, `${PR_URL}#pullrequestreview-99`);
    const [call] = (await gh.calls()).filter((entry) => entry.args.includes('POST'));
    assert.deepEqual(call.args.slice(0, 3), ['api', '--hostname', 'github.com']);
    const payload = JSON.parse(call.stdin);
    assert.equal(payload.event, 'COMMENT');
    assert.equal(payload.comments.length, 1);

    const rejecting = await fakeGh(t, ROUTES([{ match: '--method POST .*pulls/7/reviews', status: 422, times: 1 }]));
    const file2 = join(rejecting.dir, 'findings.json');
    await writeFile(file2, JSON.stringify({ head: HEAD, findings: [finding()] }));
    const retried = rejecting.run('post', PR_URL, '--findings', file2, '--post');
    assert.equal(retried.status, 0, retried.stderr);
    assert.equal(retried.json.retriedWithoutInline, true);
    const posts = (await rejecting.calls()).filter((entry) => entry.args.includes('POST'));
    assert.equal(posts.length, 2);
    const fallback = JSON.parse(posts[1].stdin);
    assert.deepEqual(fallback.comments, []);
    assert.match(fallback.body, /GitHub rejected the inline positions/);
    assert.match(fallback.body, /Value is overwritten/);
});

test('refuses a stale head, a closed PR, and invalid input', async (t) => {
    const stale = await fakeGh(t, ROUTES([{ match: 'pulls/7$', body: pr('c'.repeat(40)) }]));
    const file = join(stale.dir, 'findings.json');
    await writeFile(file, JSON.stringify({ head: HEAD, findings: [] }));
    const staleRun = stale.run('post', PR_URL, '--findings', file, '--post');
    assert.equal(staleRun.status, 3);
    assert.match(staleRun.stderr, /review the new head first/);

    const closed = await fakeGh(t, ROUTES([{ match: 'pulls/7$', body: pr(HEAD, 'closed') }]));
    await writeFile(join(closed.dir, 'findings.json'), JSON.stringify({ head: HEAD, findings: [] }));
    assert.equal(closed.run('post', PR_URL, '--findings', join(closed.dir, 'findings.json')).status, 1);

    await writeFile(file, JSON.stringify({ head: HEAD, findings: [{ title: 'x' }] }));
    const invalid = stale.run('post', PR_URL, '--findings', file);
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /findings\[0\]\.severity/);

    for (const bad of [{ findings: [finding({ id: 'x' })], resolved: [{ id: 'x', note: 'y' }] }, { findings: [finding({ id: 'a b' })] }, { findings: [], resolved: [{ id: 'x' }] }, { findings: [], resolved: [{ id: '<x>', note: 'y' }] }]) {
        await writeFile(file, JSON.stringify({ head: HEAD, ...bad }));
        assert.equal(stale.run('post', PR_URL, '--findings', file).status, 2, JSON.stringify(bad));
    }

    assert.equal(stale.run('post', PR_URL).status, 2);
    assert.equal(stale.run('approve', PR_URL).status, 2);
});

test('check reports the rate-limit state for the current head', async (t) => {
    const gh = await fakeGh(t, [
        { match: 'issues/7/comments', body: [{ user: { login: 'coderabbitai[bot]' }, updated_at: '2026-10-29T10:00:00Z', html_url: 'c1', body: NOTICE.replace('10 minutes', '5 minutes') }] },
        { match: 'pulls/7/reviews', body: [] },
        { match: `commits/${HEAD}/status`, body: { statuses: [] } },
        { match: `commits/${HEAD}/check-runs`, body: { check_runs: [] } },
        { match: 'pulls/7$', body: pr() },
    ]);
    const { json, status, stderr } = gh.run('check', PR_URL);
    assert.equal(status, 0, stderr);
    assert.equal(json.head, HEAD);
    assert.equal(json.rateLimited, true);
    assert.equal(json.notice.resetAt, '2026-10-29T10:05:00.000Z');
});
