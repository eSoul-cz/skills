import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
    filterVerdict,
    globToRegExp,
    parseCodeRabbitConfig,
    scanLine,
} from '../../skills/pre-pr-review/scripts/review-scope.mjs';

const script = fileURLToPath(new URL('../../skills/pre-pr-review/scripts/review-scope.mjs', import.meta.url));

// Built at runtime so this file itself never contains a credential-shaped literal.
const FAKE_AWS_KEY = ['AKIA', 'Z7QW3RT5YU8IOP2A'].join('');
const FAKE_PASSWORD = ['Tajne', 'Heslo', '42'].join('-');

function git(repo, ...args) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

async function write(repo, path, content) {
    await mkdir(dirname(join(repo, path)), { recursive: true });
    await writeFile(join(repo, path), content);
}

async function fixtureRepo(t) {
    const repo = await mkdtemp(join(tmpdir(), 'review-scope-'));
    t.after(() => rm(repo, { recursive: true, force: true }));
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'Test');
    git(repo, 'config', 'commit.gpgsign', 'false');
    await write(repo, 'src/kept.php', '<?php\nreturn 1;\n');
    await write(repo, 'src/old-name.php', '<?php\n// stable content for rename detection\nreturn [1, 2, 3, 4, 5, 6, 7, 8];\n');
    await write(repo, 'README.md', '# Fixture\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    git(repo, 'switch', '-q', '-c', 'feature');
    return repo;
}

function run(repo, ...args) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8' });
    return { ...result, json: result.status === 0 ? JSON.parse(result.stdout) : null };
}

test('globs follow CodeRabbit path filter semantics', () => {
    assert.ok(globToRegExp('**/*.lock').test('Gemfile.lock'));
    assert.ok(globToRegExp('**/*.lock').test('a/b/c.lock'));
    assert.ok(globToRegExp('docs/**').test('docs/a/b.md'));
    assert.ok(!globToRegExp('docs/**').test('src/docs.md'));
    assert.ok(globToRegExp('src/*.php').test('src/a.php'));
    assert.ok(!globToRegExp('src/*.php').test('src/sub/a.php'));
    assert.ok(globToRegExp('app/**/*.{php,blade.php}').test('app/Http/X.blade.php'));
    assert.ok(globToRegExp('./pnpm-lock.yaml').test('pnpm-lock.yaml'));
    assert.ok(globToRegExp('file[0-9].txt').test('file7.txt'));

    const filters = ['src/**', '!src/generated/**'].map((pattern) => ({
        pattern, source: 'test', regex: globToRegExp(pattern.replace(/^!/, '')),
    }));
    assert.deepEqual(filterVerdict('src/a.php', filters), { excluded: false });
    assert.equal(filterVerdict('src/generated/a.php', filters).excluded, true);
    assert.equal(filterVerdict('tests/a.php', filters).reason, 'test: outside included paths');
});

test('reads the review subset of a CodeRabbit configuration', () => {
    const config = parseCodeRabbitConfig(`# org policy stays
inheritance: true
language: "cs-CZ"
reviews:
  profile: assertive # stricter
  path_filters:
    # lockfiles
    - "!pnpm-lock.yaml"
    - '!assets/**'
    - "!docs/design_pencil/**/*.pen"
    - !unquoted/**
  path_instructions:
    - path: "app/**/*.php"
      instructions: |
        Money is integer cents.

        Never float.
    - path: tests/**
      instructions: "Prefer Pest datasets."
  auto_review:
    enabled: true
chat:
  auto_reply: true
`);
    assert.equal(config.inheritance, true);
    assert.equal(config.language, 'cs-CZ');
    assert.equal(config.profile, 'assertive');
    assert.deepEqual(config.pathFilters, ['!pnpm-lock.yaml', '!assets/**', '!docs/design_pencil/**/*.pen']);
    assert.deepEqual(config.pathInstructions, [
        { path: 'app/**/*.php', instructions: 'Money is integer cents.\n\nNever float.' },
        { path: 'tests/**', instructions: 'Prefer Pest datasets.' },
    ]);

    assert.equal(config.warnings.length, 1);
    assert.match(config.warnings[0], /!unquoted\/\*\* is unquoted/);

    assert.deepEqual(
        parseCodeRabbitConfig('reviews:\n  path_filters: [ "!a/**" , "!{b,c}/**", \'!d\' ]\n').pathFilters,
        ['!a/**', '!{b,c}/**', '!d'],
    );
    assert.match(parseCodeRabbitConfig('reviews: {profile: assertive}\n').warnings[0], /flow mapping/);
});

test('detects credentials without echoing them and ignores placeholders', () => {
    const [hit] = scanLine(`const key = "${FAKE_AWS_KEY}";`);
    assert.equal(hit.rule, 'aws-access-key');
    assert.ok(!hit.preview.includes(FAKE_AWS_KEY));

    const [password] = scanLine(`'password' => '${FAKE_PASSWORD}'`);
    assert.equal(password.rule, 'hardcoded-secret');
    assert.equal(password.preview, `…(${FAKE_PASSWORD.length} chars)`, 'nothing of a password is shown');

    for (const line of [
        `'DB_PASSWORD' => '${FAKE_PASSWORD}',`,
        `DB_PASSWORD="${FAKE_PASSWORD}"`,
        `DB_PASSWORD=${FAKE_PASSWORD}`,
        `  MYSQL_ROOT_PASSWORD: ${FAKE_PASSWORD}`,
        `$dbPassword = "${FAKE_PASSWORD}";`,
        `export AWS_SECRET_ACCESS_KEY=${FAKE_PASSWORD}`,
        `define('DB_PASSWORD', '${FAKE_PASSWORD}');`,
    ]) {
        assert.equal(scanLine(line).length > 0, true, line);
    }
    assert.deepEqual(scanLine("'password' => 'required|string|min:8'"), []);
    assert.deepEqual(scanLine("'password' => 'validation.password'"), []);
    assert.deepEqual(scanLine('API_KEY="${SERVICE_API_KEY}"'), []);
    assert.deepEqual(scanLine("password: 'changeme123'"), []);
    assert.deepEqual(scanLine('DB_PASSWORD=${DB_PASSWORD}'), []);
    assert.deepEqual(scanLine('DB_PASSWORD='), []);
    assert.deepEqual(scanLine("'password_confirmation' => 'required_with:password'"), []);
    assert.deepEqual(scanLine("return ['email', 'password', 'password_confirmation'];"), []);
    assert.deepEqual(scanLine("protected $authPasswordName = 'password_hash';"), []);
    assert.deepEqual(scanLine("#[Hidden(['password_hash', 'remember_token'])]"), []);
    assert.deepEqual(scanLine("foreach (['client_id', 'client_secret', 'redirect', 'project_id'] as $key) {"), []);
    assert.equal(scanLine(`DATABASE_URL=mysql://app:${FAKE_PASSWORD}@db/app`)[0]?.rule, 'url-credentials');
});

test('scopes committed, uncommitted, and untracked changes against the merge base', async (t) => {
    const repo = await fixtureRepo(t);
    await write(repo, '.coderabbit.yaml', `reviews:
  profile: chill
  path_filters:
    - "!assets/**"
  path_instructions:
    - path: "src/**"
      instructions: "Keep functions pure."
`);
    await write(repo, 'src/kept.php', '<?php\nreturn 2;\n');
    git(repo, 'mv', 'src/old-name.php', 'src/new-name.php');
    await write(repo, 'composer.lock', '{}\n');
    await write(repo, 'assets/client.csv', 'a,b\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'feature work');

    await write(repo, 'README.md', '# Fixture\n\nChanged in the worktree.\n');
    await write(repo, 'src/žluťoučký.php', `<?php\n$key = "${FAKE_AWS_KEY}";\n`);
    await write(repo, '.env', 'APP_KEY=\n');
    await write(repo, 'logo.bin', Buffer.from([0, 1, 2, 3]));

    const { json, status, stderr } = run(repo, '--base', 'main');
    assert.equal(status, 0, stderr);
    assert.equal(json.type, 'all');
    assert.equal(json.mergeBase, git(repo, 'rev-parse', 'main'));
    assert.equal(json.head.dirty, true);
    assert.equal(json.config.profile, 'chill');

    const byPath = Object.fromEntries(json.files.map((file) => [file.path, file]));
    assert.equal(byPath['src/kept.php'].status, 'modified');
    assert.deepEqual(byPath['src/kept.php'].instructions, [0]);
    assert.equal(byPath['src/new-name.php'].status, 'renamed');
    assert.equal(byPath['src/new-name.php'].oldPath, 'src/old-name.php');
    assert.equal(byPath['README.md'].status, 'modified');
    assert.equal(byPath['src/žluťoučký.php'].status, 'untracked');
    assert.equal(byPath['src/žluťoučký.php'].added, 2);

    const excluded = Object.fromEntries(json.excluded.map((file) => [file.path, file.reason]));
    assert.equal(excluded['composer.lock'], 'default: !**/composer.lock');
    assert.equal(excluded['assets/client.csv'], '.coderabbit.yaml: !assets/**');
    assert.equal(excluded['logo.bin'], 'binary');

    assert.deepEqual(
        json.secrets.map(({ path, line, rule }) => [path, line, rule]).sort(),
        [['.env', null, 'env-file'], ['src/žluťoučký.php', 2, 'aws-access-key']],
    );
    assert.ok(!JSON.stringify(json).includes(FAKE_AWS_KEY), 'secret values must be redacted');
    assert.ok(json.secrets.every((secret) => !secret.test));
});

test('marks credential hits in test code', async (t) => {
    const repo = await fixtureRepo(t);
    await write(repo, 'tests/Feature/LoginTest.php', `<?php\n$data = ['password' => '${FAKE_PASSWORD}'];\n`);
    await write(repo, 'tooling/scripts/test_login.mjs', `const password = '${FAKE_PASSWORD}';\n`);
    await write(repo, 'cypress/e2e/login.cy.ts', `const password = '${FAKE_PASSWORD}';\n`);
    await write(repo, 'app/login.go', `const password = "${FAKE_PASSWORD}"\n`);
    const { json } = run(repo, '--base', 'main');
    assert.deepEqual(json.secrets.map(({ path, test }) => [path, Boolean(test)]).sort(), [
        ['app/login.go', false],
        ['cypress/e2e/login.cy.ts', true],
        ['tests/Feature/LoginTest.php', true],
        ['tooling/scripts/test_login.mjs', true],
    ]);
});

test('scans added lines whatever the diff prefix, path quoting, or line content', async (t) => {
    const repo = await fixtureRepo(t);
    git(repo, 'config', 'diff.mnemonicPrefix', 'true');
    await write(repo, 'src/kept.php', `<?php\n++ looks like a header\n$key = "${FAKE_AWS_KEY}";\n`);
    await write(repo, 'q"uote.php', '<?php\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'tracked');
    await write(repo, 'q"uote.php', `<?php\n$key = "${FAKE_AWS_KEY}";\n`);

    const { json } = run(repo, '--base', 'main');
    assert.deepEqual(json.secrets.map(({ path, line, rule }) => [path, line, rule]).sort(), [
        ['q"uote.php', 2, 'aws-access-key'],
        ['src/kept.php', 3, 'aws-access-key'],
    ]);
});

test('accounts for symlinks, nested repositories, and huge files', async (t) => {
    const repo = await fixtureRepo(t);
    const outside = await mkdtemp(join(tmpdir(), 'review-scope-outside-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    await writeFile(join(outside, 'target.txt'), 'outside\n');
    await symlink(join(outside, 'target.txt'), join(repo, 'outside-link'));
    await symlink(join(repo, 'missing'), join(repo, 'broken-link'));
    await symlink(join(repo, 'loop-b'), join(repo, 'loop-a'));
    await symlink(join(repo, 'loop-a'), join(repo, 'loop-b'));
    await mkdir(join(repo, 'nested'));
    git(join(repo, 'nested'), 'init', '-q');
    await write(repo, 'nested/file.txt', 'x\n');
    await write(repo, 'backup-dump.sql', '');
    await truncate(join(repo, 'backup-dump.sql'), 3 * 1024 ** 3);

    const { json, status, stderr } = run(repo, '--base', 'main');
    assert.equal(status, 0, stderr);
    const excluded = Object.fromEntries(json.excluded.map((file) => [file.path, file.reason]));
    for (const link of ['outside-link', 'broken-link', 'loop-a', 'loop-b']) assert.match(excluded[link], /symlink/, link);
    assert.match(excluded['nested/'], /not a regular file/);
    assert.ok(json.secrets.some((secret) => secret.path === 'backup-dump.sql' && secret.rule === 'database-dump'));
    assert.ok(json.warnings.some((warning) => warning.startsWith('backup-dump.sql is larger than 2 MB')));
});

test('a configured include overrides a default exclusion', async (t) => {
    const repo = await fixtureRepo(t);
    await write(repo, '.coderabbit.yaml', 'reviews:\n  path_filters:\n    - "**"\n    - "vendor/acme/**"\n');
    await write(repo, 'vendor/acme/Tool.php', '<?php\n');
    await write(repo, 'vendor/other/Lib.php', '<?php\n');
    const { json } = run(repo, '--base', 'main');
    const reviewed = json.files.map((file) => file.path);
    assert.ok(reviewed.includes('vendor/acme/Tool.php'));
    assert.ok(reviewed.includes('vendor/other/Lib.php'), 'a catch-all include also re-includes vendor');
});

test('committed and uncommitted scopes stay separate', async (t) => {
    const repo = await fixtureRepo(t);
    await write(repo, 'src/kept.php', '<?php\nreturn 3;\n');
    git(repo, 'commit', '-q', '-am', 'committed change');
    await write(repo, 'README.md', '# Changed\n');
    await write(repo, 'new.txt', 'untracked\n');

    const committed = run(repo, '--base', 'main', '--type', 'committed').json;
    assert.deepEqual(committed.files.map((file) => file.path), ['src/kept.php']);
    assert.ok(committed.warnings.some((warning) => warning.includes('not part of this committed-only scope')));

    const uncommitted = run(repo, '--base', 'main', '--type', 'uncommitted').json;
    assert.deepEqual(uncommitted.files.map((file) => file.path).sort(), ['README.md', 'new.txt']);

    const tracked = run(repo, '--base', 'main', '--type', 'uncommitted', '--no-untracked').json;
    assert.deepEqual(tracked.files.map((file) => file.path), ['README.md']);
});

test('reports a stale branch and honors extra exclusions', async (t) => {
    const repo = await fixtureRepo(t);
    await write(repo, 'src/kept.php', '<?php\nreturn 4;\n');
    await write(repo, 'docs/notes.md', 'notes\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'feature');
    git(repo, 'switch', '-q', 'main');
    await write(repo, 'README.md', '# Main moved on\n');
    git(repo, 'commit', '-q', '-am', 'main change');
    git(repo, 'switch', '-q', 'feature');

    const { json } = run(repo, '--base', 'main', '--exclude', 'docs/**');
    assert.deepEqual(json.files.map((file) => file.path), ['src/kept.php']);
    assert.equal(json.excluded[0].reason, '--exclude: !docs/**');
    assert.ok(json.warnings.some((warning) => warning.startsWith('Branch is 1 commit(s) behind main')));
});

test('fails clearly without a resolvable base', async (t) => {
    const repo = await fixtureRepo(t);
    const missing = run(repo);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /--base is required/);

    const unknown = run(repo, '--base', 'origin/does-not-exist');
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /does not resolve to a commit; fetch it first/);

    const badType = run(repo, '--base', 'main', '--type', 'staged');
    assert.equal(badType.status, 2);
});
