#!/usr/bin/env bash
set -euo pipefail

: "${EXPECTED_REVISION:?EXPECTED_REVISION is required}"

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://oraclelumira.com}"
DESK_BASE_URL="${DESK_BASE_URL:-https://desk.oraclelumira.com}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-36}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-10}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

fetch() {
  local name="$1"
  local url="$2"
  shift 2
  curl --silent --show-error --max-time 20 --dump-header "$work_dir/$name.headers" \
    --output "$work_dir/$name.body" --write-out '%{http_code}' "$@" "$url"
}

header() {
  local name="$1"
  local key="$2"
  awk -F': *' -v key="$key" 'tolower($1) == tolower(key) { value=$2 } END { gsub("\\r", "", value); print value }' \
    "$work_dir/$name.headers"
}

require_status() {
  local name="$1"
  local expected="$2"
  local actual
  actual="$(head -n 1 "$work_dir/$name.headers" | awk '{print $2}')"
  [ "$actual" = "$expected" ] || { echo "$name returned $actual, expected $expected" >&2; exit 1; }
}

require_private_headers() {
  local name="$1"
  local robots cache
  robots="$(header "$name" 'X-Robots-Tag')"
  cache="$(header "$name" 'Cache-Control')"
  [[ "$robots" == *noindex* && "$robots" == *nofollow* && "$robots" == *noimageindex* ]] || {
    echo "$name is missing private robots directives: $robots" >&2; exit 1;
  }
  [[ "$cache" == *private* && "$cache" == *no-store* ]] || {
    echo "$name is cacheable: $cache" >&2; exit 1;
  }
}

echo "Waiting for web revision $EXPECTED_REVISION at $PUBLIC_BASE_URL/api/version"
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if fetch version "$PUBLIC_BASE_URL/api/version" >/dev/null 2>&1 && [ "$(head -n 1 "$work_dir/version.headers" | awk '{print $2}')" = '200' ]; then
    revision="$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1])).revision || '')" "$work_dir/version.body" 2>/dev/null || true)"
    if [ "$revision" = "$EXPECTED_REVISION" ]; then
      echo "Revision confirmed on attempt $attempt."
      break
    fi
    echo "Attempt $attempt/$MAX_ATTEMPTS: received revision '${revision:-missing}'."
  else
    echo "Attempt $attempt/$MAX_ATTEMPTS: version endpoint is not ready."
  fi
  [ "$attempt" = "$MAX_ATTEMPTS" ] && { echo 'Timed out waiting for the expected production revision.' >&2; exit 1; }
  sleep "$RETRY_DELAY_SECONDS"
done

require_private_headers version

for path in / /faq /notre-approche /mentions-legales /confidentialite /cgv; do
  name="public$(echo "$path" | tr '/' '_')"
  fetch "$name" "$PUBLIC_BASE_URL$path" >/dev/null
  require_status "$name" 200
  [[ "$(header "$name" 'Content-Type')" == text/html* ]] || { echo "$path is not HTML" >&2; exit 1; }
done

for path in / /faq /notre-approche; do
  name="public$(echo "$path" | tr '/' '_')"
  canonical="${PUBLIC_BASE_URL}${path}"
  [ "$path" = / ] && canonical="${PUBLIC_BASE_URL}/"
  node -e '
    const fs = require("fs");
    const [bodyPath, expected] = process.argv.slice(1);
    const body = fs.readFileSync(bodyPath, "utf8");
    const match = body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
    if (!match || new URL(match[1]).toString() !== new URL(expected).toString()) process.exit(1);
  ' "$work_dir/$name.body" "$canonical"
  grep -F '<h1' "$work_dir/$name.body" >/dev/null
  grep -F '<title>' "$work_dir/$name.body" | grep -F 'Oracle Lumira' >/dev/null
done

fetch robots "$PUBLIC_BASE_URL/robots.txt" >/dev/null
require_status robots 200
[[ "$(header robots 'Content-Type')" == text/plain* ]] || { echo 'robots.txt has an invalid content type' >&2; exit 1; }
grep -F "Sitemap: $PUBLIC_BASE_URL/sitemap.xml" "$work_dir/robots.body" >/dev/null

fetch sitemap "$PUBLIC_BASE_URL/sitemap.xml" >/dev/null
require_status sitemap 200
[[ "$(header sitemap 'Content-Type')" =~ ^(application|text)/xml ]] || { echo 'sitemap.xml has an invalid content type' >&2; exit 1; }
mapfile -t locations < <(grep -oE '<loc>[^<]+</loc>' "$work_dir/sitemap.body" | sed -E 's#</?loc>##g')
expected_locations=("$PUBLIC_BASE_URL/" "$PUBLIC_BASE_URL/notre-approche" "$PUBLIC_BASE_URL/faq")
[ "${#locations[@]}" = 3 ] && [ "${locations[*]}" = "${expected_locations[*]}" ] || {
  echo "Unexpected sitemap locations: ${locations[*]}" >&2; exit 1;
}

for path in /commande /payment-success /sanctuaire /sanctuaire/login /admin /admin/login /api/health; do
  name="private$(echo "$path" | tr '/' '_')"
  fetch "$name" "$PUBLIC_BASE_URL$path" >/dev/null
  require_private_headers "$name"
done
require_status private_api_health 200

for path in / /login /board /clients; do
  name="desk$(echo "$path" | tr '/' '_')"
  fetch "$name" "$DESK_BASE_URL$path" >/dev/null
  require_private_headers "$name"
  ! grep -qi 'rel="canonical"\|application/ld+json' "$work_dir/$name.body"
done

fetch desk_robots "$DESK_BASE_URL/robots.txt" >/dev/null
require_status desk_robots 200
require_private_headers desk_robots
grep -Fx 'Disallow: /' "$work_dir/desk_robots.body" >/dev/null
fetch desk_sitemap "$DESK_BASE_URL/sitemap.xml" >/dev/null
require_status desk_sitemap 404
require_private_headers desk_sitemap

echo 'Production search, privacy, Desk, health, and revision checks passed.'
