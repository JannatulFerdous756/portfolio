<?php
// Shared helpers for every API endpoint.
// Each endpoint answers in JSON, so the JavaScript side can read it with AJAX.

declare(strict_types=1);

const DATA_FILE     = __DIR__ . '/../data/profile.json';
const STORAGE_DIR   = __DIR__ . '/../storage';
const MESSAGES_FILE = STORAGE_DIR . '/messages.json';
const VISITS_FILE   = STORAGE_DIR . '/visits.json';

// Start the session with safer cookie settings (used for CSRF token, visit count, rate limit).
function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => !empty($_SERVER['HTTPS']),
        ]);
        session_start();
    }
}

// Send a JSON response with a status code, then stop the script.
function json_response(array $body, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Only allow the HTTP methods an endpoint supports.
function allow_methods(array $methods): string
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
    }
    return $method;
}

// Read a JSON file and return it as a PHP array.
function read_json(string $path, $default = [])
{
    if (!is_file($path)) {
        return $default;
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : $default;
}

// Safely read-modify-write a JSON file.
// flock() stops two visitors from writing at the same moment and corrupting the file.
function update_json(string $path, callable $change, $default = [])
{
    if (!is_dir(dirname($path))) {
        mkdir(dirname($path), 0775, true);
    }
    $fp = fopen($path, 'c+');
    if ($fp === false) {
        json_response(['ok' => false, 'message' => 'Storage is not writable.'], 500);
    }

    flock($fp, LOCK_EX);
    $raw  = stream_get_contents($fp);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        $data = $default;
    }

    $data = $change($data);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $data;
}
