# WordPress sites

Applies to WordPress sites built on `eSoul-cz/WP-template` (Docker image) or `WP-project-template`. Repository `AGENTS.md` / `CONTEXT.md` override everything here.

## How eSoul WordPress is deployed

- WordPress core (`wp-admin`, `wp-includes`, root PHP files, `wp-config.php`) is baked into the Docker image. Never edit core, and never mount a volume over `/var/www/html`, `wp-admin`, or `wp-includes` in production.
- Only the database and `wp-content` (or just `wp-content/uploads` when plugins and themes are baked in) persist.
- Supervisor runs PHP-FPM, an FPM watchdog, and a CLI WP-Cron runner. Request-triggered WP-Cron is disabled; check `supervisorctl status` inside the container when cron or FPM misbehaves.
- WordPress and PHP versions are updated through the Jenkins `WP_VERSION` / `PHP_VERSION` parameters, not in place.
- Each site has its own database schema. `db.sql` is a sanitized baseline; refresh it only with `scripts/sanitize-db-export.php`. Raw `*_export_*.sql` files contain personal data and credentials: never commit or share them.
- Typical plugin set: Breakdance or Elementor Pro (page builders), WooCommerce, Rank Math SEO, Code Snippets Pro, WebP Converter, WP Sheet Editor.

## Where changes go

1. Content and layout built in a page builder: change it in the builder (or via its export/import), not by editing serialized post meta by hand.
2. Custom behavior: a small site-specific plugin (or a child theme for presentation), versioned in Git. Avoid putting business logic into Code Snippets unless the project already does so, and never modify third-party plugin files; they are overwritten on update.
3. Configuration that differs per environment: environment variables / `WORDPRESS_CONFIG_EXTRA`, not hard-coded values.

## Rules

- Use WP-CLI for data operations. URL or domain changes need a serialization-aware `wp search-replace` (with `--dry-run` first and a database backup), never a raw SQL replace.
- WordPress coding basics: prefix functions, hooks and options; sanitize input (`sanitize_*`), escape output (`esc_*`), check capabilities and nonces on every form and AJAX handler, and use `$wpdb->prepare` for SQL.
- WooCommerce: use its CRUD APIs and hooks, not direct table writes; test checkout end to end after any change touching cart, prices, shipping, or payment.
- SEO: keep Rank Math settings, redirects, and sitemaps intact when changing slugs or structure; add redirects for changed URLs.
- Performance: enqueue assets only where needed, serve WebP, avoid heavy queries in templates, and check the page with caching on.

## Verifying

- Load the changed pages at 1440px and 390px, logged in and logged out; check the browser console and PHP error log.
- For WooCommerce, run a test order in a non-production environment.
- After plugin or core updates, check the admin dashboard, the front page, a builder-made page, forms, and checkout.
- Never test destructive operations (reset, search-replace, imports) against production; `scripts/reset.sh` is for dedicated installations and must be run deliberately.
