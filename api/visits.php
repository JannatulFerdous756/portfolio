<?php
// GET  api/visits.php -> { count }
// POST api/visits.php -> counts this visitor once per browser session, returns { count }

declare(strict_types=1);
require __DIR__ . '/_helpers.php';

$method = allow_methods(['GET', 'POST']);
start_session();

if ($method === 'GET') {
    $data = read_json(VISITS_FILE, ['count' => 0]);
    json_response(['ok' => true, 'count' => (int) ($data['count'] ?? 0)]);
}

// POST: only count the first visit of this session, so refreshing doesn't inflate the number.
if (!empty($_SESSION['counted'])) {
    $data = read_json(VISITS_FILE, ['count' => 0]);
    json_response(['ok' => true, 'count' => (int) ($data['count'] ?? 0)]);
}

$data = update_json(VISITS_FILE, function (array $d): array {
    $d['count'] = (int) ($d['count'] ?? 0) + 1;
    return $d;
}, ['count' => 0]);

$_SESSION['counted'] = true;
json_response(['ok' => true, 'count' => $data['count']]);
