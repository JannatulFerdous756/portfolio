<?php
// GET api/profile.php            -> the whole CV as JSON
// GET api/profile.php?section=research -> only one part of the CV

declare(strict_types=1);
require __DIR__ . '/_helpers.php';

allow_methods(['GET']);

$profile = read_json(DATA_FILE, null);
if ($profile === null) {
    json_response(['ok' => false, 'message' => 'data/profile.json is missing or is not valid JSON.'], 500);
}

// Referees did not publish their emails, so keep them private unless "public" is true.
if (empty($profile['references']['public'])) {
    $profile['references'] = [
        'public' => false,
        'count'  => count($profile['references']['people'] ?? []),
    ];
}

// Optional filter: ?section=skills
$section = $_GET['section'] ?? null;
if ($section !== null) {
    if (!is_string($section) || !array_key_exists($section, $profile)) {
        json_response([
            'ok'      => false,
            'message' => 'Unknown section. Use one of: ' . implode(', ', array_keys($profile)),
        ], 404);
    }
    json_response(['ok' => true, 'data' => [$section => $profile[$section]]]);
}

// Let the browser reuse the answer for 5 minutes.
header('Cache-Control: public, max-age=300');
json_response(['ok' => true, 'data' => $profile]);
