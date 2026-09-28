<?php
// GET  api/contact.php -> { token }  a CSRF token the form must send back
// POST api/contact.php -> validates the message and saves it to storage/messages.json

declare(strict_types=1);
require __DIR__ . '/_helpers.php';

$method = allow_methods(['GET', 'POST']);
start_session();

// ---------- GET: hand out a CSRF token ----------
if ($method === 'GET') {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    json_response(['ok' => true, 'token' => $_SESSION['csrf']]);
}

// ---------- POST: receive a message ----------

// 1. The token must match the one stored in the session.
$token = (string) ($_POST['token'] ?? '');
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
    json_response(['ok' => false, 'message' => 'Your session expired. Reload the page and send again.'], 403);
}

// 2. Honeypot: real people never see or fill the hidden "website" field. Bots do.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    json_response(['ok' => true, 'message' => 'Message sent.']);
}

// 3. Rate limit: one message every 30 seconds per visitor.
$wait = 30 - (time() - (int) ($_SESSION['last_message'] ?? 0));
if ($wait > 0) {
    json_response(['ok' => false, 'message' => "Please wait {$wait} seconds before sending another message."], 429);
}

// 4. Validate every field on the server (never trust browser-side checks alone).
$name    = trim((string) ($_POST['name'] ?? ''));
$email   = trim((string) ($_POST['email'] ?? ''));
$subject = trim((string) ($_POST['subject'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

$errors = [];

if ($name === '') {
    $errors['name'] = 'Enter your name.';
} elseif (mb_strlen($name) < 2 || mb_strlen($name) > 60) {
    $errors['name'] = 'Name must be 2 to 60 characters.';
} elseif (!preg_match("/^[\p{L} .'-]+$/u", $name)) {
    $errors['name'] = 'Name can only contain letters, spaces, dots, hyphens and apostrophes.';
}

if ($email === '') {
    $errors['email'] = 'Enter your email.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120) {
    $errors['email'] = 'Enter a valid email, like name@example.com.';
}

$allowedSubjects = ['Job opportunity', 'Research collaboration', 'Project', 'Other'];
if (!in_array($subject, $allowedSubjects, true)) {
    $errors['subject'] = 'Choose a subject.';
}

if (mb_strlen($message) < 10) {
    $errors['message'] = 'Write at least 10 characters.';
} elseif (mb_strlen($message) > 2000) {
    $errors['message'] = 'Keep the message under 2000 characters.';
}

if ($errors) {
    json_response(['ok' => false, 'message' => 'Check the highlighted fields.', 'errors' => $errors], 422);
}

// 5. Save it as plain text. Whoever displays it later must escape it (htmlspecialchars).
update_json(MESSAGES_FILE, function (array $all) use ($name, $email, $subject, $message): array {
    $all[] = [
        'id'      => bin2hex(random_bytes(6)),
        'name'    => $name,
        'email'   => $email,
        'subject' => $subject,
        'message' => $message,
        'sentAt'  => date('c'),
    ];
    return $all;
}, []);

$_SESSION['last_message'] = time();

// The browser shows this with textContent, so no HTML is ever injected.
$firstName = explode(' ', $name)[0];
json_response(['ok' => true, 'message' => "Thanks, {$firstName}. Your message reached Jannatul."]);
