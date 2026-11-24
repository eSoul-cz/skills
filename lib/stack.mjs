// What kind of project this is, for `project init` and `status`. The detection mirrors
// `esoul-guidelines init` (src/Detect/StackDetector.php of eSoul-cz/guidelines), and a project
// that already has esoul-guidelines.json is read from there first, so both always agree.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPOSER = {
    'laravel/framework': 'framework/laravel',
    'lsr/core': 'framework/lsr',
    'lsr/cqrs': 'package/lsr-cqrs',
    'filament/filament': 'package/filament',
    'lunarphp/lunar': 'package/lunar',
    'infection/infection': 'package/mutation-testing',
    'esoul-cz/phpunit-test-evidence': 'package/test-evidence',
};
const COMPOSER_COMBINED = { 'package/laravel-inertia': ['laravel/framework', 'inertiajs/inertia-laravel'] };
const NPM = { astro: 'framework/astro', '@inertiajs/vue3': 'package/inertia-vue' };
const IMPLIES = { 'package/lunar': 'package/filament' };

function readJson(file) {
    if (!existsSync(file)) {
        return null;
    }
    try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        return data && typeof data === 'object' ? data : null;
    } catch {
        return null;
    }
}

function dependencyNames(data, sections) {
    return sections.flatMap((section) => (data?.[section] && typeof data[section] === 'object' ? Object.keys(data[section]) : []));
}

/** Guideline layers from composer.json and package.json dependencies, frameworks first. */
export function detectGuidelineLayers(root) {
    const found = new Set();
    const composer = dependencyNames(readJson(join(root, 'composer.json')), ['require', 'require-dev']);
    for (const name of composer) {
        if (COMPOSER[name]) {
            found.add(COMPOSER[name]);
        }
    }
    for (const [layer, packages] of Object.entries(COMPOSER_COMBINED)) {
        if (packages.every((name) => composer.includes(name))) {
            found.add(layer);
        }
    }
    for (const name of dependencyNames(readJson(join(root, 'package.json')), ['dependencies', 'devDependencies'])) {
        if (NPM[name]) {
            found.add(NPM[name]);
        }
    }
    for (const [layer, implied] of Object.entries(IMPLIES)) {
        if (found.has(layer)) {
            found.add(implied);
        }
    }
    return [...found].sort((a, b) => Number(!a.startsWith('framework/')) - Number(!b.startsWith('framework/')) || a.localeCompare(b));
}

/** The project's guideline layers: esoul-guidelines.json `layers` when present, otherwise detected. */
export function projectGuidelineLayers(root) {
    const config = readJson(join(root, 'esoul-guidelines.json'));
    if (Array.isArray(config?.layers)) {
        return { layers: config.layers.filter((layer) => typeof layer === 'string'), source: 'esoul-guidelines.json' };
    }
    return { layers: detectGuidelineLayers(root), source: 'composer.json and package.json' };
}

/** Laravel Boost checks: [{ ok, message }] about the composer package and the update hook. */
export function boostChecks(root) {
    const composer = readJson(join(root, 'composer.json'));
    const required = dependencyNames(composer, ['require', 'require-dev']).includes('laravel/boost');
    const checks = [{ ok: required, message: required ? 'laravel/boost is a Composer dependency' : 'laravel/boost is not installed: composer require --dev laravel/boost, then php artisan boost:install' }];
    const hook = composer?.scripts?.['post-update-cmd'];
    const hooks = Array.isArray(hook) ? hook : hook ? [hook] : [];
    const updates = hooks.some((command) => String(command).includes('boost:update'));
    checks.push({ ok: updates, message: updates ? 'boost:update runs from post-update-cmd' : 'boost:update does not run from post-update-cmd: add "@php artisan boost:update --ansi" to composer.json scripts' });
    return checks;
}

/** Skill names listed in boost.json, or null when the project has no Boost configuration. */
export function boostSkills(root) {
    const config = readJson(join(root, 'boost.json'));
    if (!config) {
        return null;
    }
    return Array.isArray(config.skills) ? config.skills.filter((name) => typeof name === 'string') : [];
}
