# Jannatul Ferdous — portfolio

A personal CV website built as a city at night. Every building in the skyline is one piece of work from the CV (gold windows are research, green are projects, pink are education and certificates). Hover or tap a building to read it, click to jump to it.

## Technologies and where each one is used

| Technology | File | What it does |
|---|---|---|
| JSON | `data/profile.json` | All CV content lives here. Edit this file to update the site. |
| PHP | `api/profile.php` | Reads the JSON and sends it to the browser. Hides referee emails. |
| PHP | `api/contact.php` | Validates contact messages (CSRF token, honeypot, rate limit) and saves them. |
| PHP | `api/visits.php` | Visitor counter, counted once per browser session. |
| AJAX (fetch) | `assets/js/main.js` | Loads the profile and the visitor count without reloading the page. |
| AJAX (XMLHttpRequest) | `assets/js/main.js` | Sends the contact form. |
| JavaScript | `assets/js/main.js` | Builds the skyline SVG, renders every section, research filter, form checks. |
| HTML | `index.html` | Page structure. |
| CSS | `assets/css/style.css` | All styling, responsive layout, reduced-motion support. |

## Run it on your computer (XAMPP)

1. Copy the `portfolio` folder into `C:\xampp\htdocs\`.
2. Open the XAMPP Control Panel and start **Apache**. MySQL is not needed.
3. Open `http://localhost/portfolio` in your browser.

Do not double-click `index.html`. The page needs PHP to load the data, so it must be opened through `http://localhost`.

Without XAMPP, if PHP is installed, you can also run this inside the folder:

```
php -S localhost:8000
```

and open `http://localhost:8000`. (With this built-in server the `.htaccess` protection does not apply, so use it only for testing.)

Requires PHP 7.4 or newer.

## Publishing on GitHub Pages

GitHub Pages does not run PHP. The site detects this by itself: it reads `data/profile.json` directly, and the contact form turns into an "Email Jannatul" button. Everything else (city, research filter, all sections) works the same.

Live link after publishing: `https://jannatulferdous756.github.io/portfolio/`

## Things to update

- **LinkedIn**: in `data/profile.json`, put your LinkedIn profile address in `"url"` next to `"LinkedIn"`. Empty links are hidden.
- **References**: the site says "available on request". Referee emails are not stored in this repository because it is public. Set `"public": true` under `"references"` to show their names and titles.
- **New paper or project**: add an entry to `"research"` or `"projects"`. A new building appears in the city automatically. Give each entry a unique `"id"`.
- **Photo / CV PDF**: replace `assets/img/profile.jpg` or `assets/Jannatul_Ferdous_CV.pdf`.

## Reading contact messages

Messages are saved in `storage/messages.json`. The `storage` and `data` folders have an `.htaccess` file that blocks direct access from the browser on Apache, so visitors cannot read them.

## Folder structure

```
portfolio/
├── index.html
├── api/
│   ├── _helpers.php      shared JSON + file-locking helpers
│   ├── profile.php
│   ├── contact.php
│   └── visits.php
├── data/
│   ├── profile.json      the CV
│   └── .htaccess         blocks direct access
├── storage/
│   ├── messages.json     contact messages
│   ├── visits.json       visitor count
│   └── .htaccess
└── assets/
    ├── css/style.css
    ├── js/main.js
    ├── img/profile.jpg
    └── Jannatul_Ferdous_CV.pdf
```

## Security notes

- All data is inserted with `textContent`, never `innerHTML`, so text from the JSON or the form cannot inject code.
- The contact form is checked twice: in JavaScript for quick feedback and again in PHP, which is the check that counts.
- A CSRF token, a hidden honeypot field and a 30-second limit stop spam bots.
- `flock()` prevents two visitors from corrupting the JSON files when writing at the same time.
