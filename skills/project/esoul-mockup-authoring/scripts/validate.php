#!/usr/bin/env php
<?php

declare(strict_types=1);

// Use the application's validator and schema. No second format implementation lives in this skill.
try {
    if ($argc !== 3) {
        throw new InvalidArgumentException('Usage: php validate.php APP_ROOT BUNDLE_DIRECTORY');
    }
    $appRoot = realpath($argv[1]);
    $directory = $argv[2];
    if ($appRoot === false || !is_dir($directory)) {
        throw new InvalidArgumentException('Application root and bundle directory must exist.');
    }
    $autoload = $appRoot . '/vendor/autoload.php';
    $schema = $appRoot . '/config/mockups/manifest.schema.json';
    if (!is_file($autoload) || !is_file($schema)) {
        throw new RuntimeException('Use --app-root with an eSoul application checkout containing Composer dependencies and the authoritative mockup schema.');
    }
    require $autoload;
    $validator = new App\Services\Mockups\BundleValidator($schema);
    echo json_encode($validator->validate($directory), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
