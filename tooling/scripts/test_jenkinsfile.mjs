#!/usr/bin/env node
// Keeps the conditional stages of the Jenkinsfile honest: every skill folder with Node tests has its own stage, every
// stage runs on a tag and on the schedule, and the tag build reads its release notes from tooling/CHANGELOG.md.
// Usage: node --test tooling/scripts/test_jenkinsfile.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const jenkinsfile = readFileSync(join(root, 'Jenkinsfile'), 'utf8');

function find(dir, predicate, found = []) {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (entry === 'node_modules') {
            continue;
        }
        if (statSync(path).isDirectory()) {
            find(path, predicate, found);
        } else if (predicate(entry)) {
            found.push(path);
        }
    }
    return found;
}

const stages = [...jenkinsfile.matchAll(/^\t\tstage\('([^']+)'\) \{\n([\s\S]*?)^\t\t\}$/gm)].map(([, name, body]) => ({ name, body }));

test('every skill folder with Node tests has a stage that runs when the folder changes', () => {
    const folders = new Set(
        find(join(root, 'skills'), (name) => name.endsWith('.test.mjs')).map((file) => relative(root, file).split('/').slice(0, 3).join('/')),
    );
    assert.ok(folders.size > 0);
    for (const folder of folders) {
        const stage = stages.find((entry) => entry.body.includes(`sh 'tooling/scripts/test_skills ${folder}'`));
        assert.ok(stage, `${folder} has Node tests but no stage runs them (add one to the Jenkinsfile)`);
        assert.ok(stage.body.includes(`changeset '${folder}/**'`), `the stage of ${folder} must run when ${folder}/** changes`);
    }
});

test('every test stage also runs on a tag, on the scheduled build and after a build that did not succeed', () => {
    const testStages = stages.filter((entry) => /Verify/.test(entry.name));
    assert.ok(testStages.length >= 5);
    for (const { name, body } of testStages) {
        for (const condition of ['buildingTag()', "triggeredBy 'TimerTrigger'", 'previousBuildFailed()']) {
            assert.ok(body.includes(condition), `stage "${name}" lacks ${condition}`);
        }
    }
});

test('the Python tests and the contract group have stages; the mockup preview test stays out of CI', () => {
    assert.ok(jenkinsfile.includes("sh 'tooling/scripts/test_python'"));
    assert.ok(jenkinsfile.includes("sh 'tooling/scripts/test_skills contract'"));
    assert.ok(!/sh '[^']*test_mockup_preview/.test(jenkinsfile));
});

test('the scheduled build checks upstream releases and the tag build reads the changelog', () => {
    assert.match(jenkinsfile, /cron\(env\.BRANCH_NAME == 'master'/);
    assert.match(jenkinsfile, /node_run tooling\/scripts\/check_upstream\.mjs/);
    assert.match(jenkinsfile, /node_run tooling\/scripts\/release_notes\.mjs/);
    assert.match(jenkinsfile, /UPGRADE_NOTES: env\.UPGRADE_NOTES/);
    assert.ok(!/UPGRADE_NOTES: '/.test(jenkinsfile), 'the release notes are not a string in the Jenkinsfile');
});

test('the scripts the Jenkinsfile runs exist and are executable', () => {
    for (const [, script] of jenkinsfile.matchAll(/(?:sh '|node_run )tooling\/scripts\/([\w.]+)/g)) {
        const path = join(root, 'tooling/scripts', script);
        assert.ok(existsSync(path), `tooling/scripts/${script} does not exist`);
        assert.ok(statSync(path).mode & 0o111, `tooling/scripts/${script} is not executable`);
    }
});
