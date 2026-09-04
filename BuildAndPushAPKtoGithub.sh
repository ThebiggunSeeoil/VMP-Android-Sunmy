#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./BuildAndPushAPKtoGithub.sh [--version X.Y.Z] [--notes "Release notes"]

Without --version, the script increments the patch version automatically.
It then increments versionCode, builds the release APK, commits, pushes, creates
a GitHub Release, and uploads VMP-Sunmi-vX.Y.Z.apk.
EOF
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

next_patch_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"
  [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]] || \
    fail "versionName must use X.Y.Z format; current value is $1"
  printf '%s.%s.%s\n' "$major" "$minor" "$((patch + 1))"
}

requested_version=''
release_notes=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ $# -ge 2 ]] || fail '--version requires X.Y.Z'
      requested_version="$2"
      shift 2
      ;;
    --notes)
      [[ $# -ge 2 ]] || fail '--notes requires text'
      release_notes="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

require_command git
require_command curl
require_command jq
require_command perl

project_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail 'Run this inside the Git repository.'
cd "$project_root"

build_file='android/app/build.gradle'
[[ -f "$build_file" ]] || fail "Missing $build_file"

current_code="$(awk '/^[[:space:]]*versionCode[[:space:]]+[0-9]+/ { print $2; exit }' "$build_file")"
current_version="$(awk -F '"' '/^[[:space:]]*versionName[[:space:]]+"/ { print $2; exit }' "$build_file")"
[[ "$current_code" =~ ^[0-9]+$ ]] || fail 'Could not read versionCode from android/app/build.gradle.'
[[ -n "$current_version" ]] || fail 'Could not read versionName from android/app/build.gradle.'

if [[ -n "$requested_version" ]]; then
  next_version="$requested_version"
else
  next_version="$(next_patch_version "$current_version")"
fi

[[ "$next_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail '--version must use X.Y.Z format.'
[[ "$next_version" != "$current_version" ]] || fail 'The new version must differ from the current version.'

next_code="$((current_code + 1))"
tag="v$next_version"
git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null && fail "Tag $tag already exists locally."

origin_url="$(git remote get-url origin 2>/dev/null)" || fail 'Git remote "origin" is not configured.'
if [[ "$origin_url" =~ github\.com[:/]([^/]+)/([^/]+)$ ]]; then
  github_owner="${BASH_REMATCH[1]}"
  github_repo="${BASH_REMATCH[2]%.git}"
else
  fail "Origin is not a GitHub repository: $origin_url"
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  android_studio_jbr='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
  if [[ -x "$android_studio_jbr/bin/java" ]]; then
    export JAVA_HOME="$android_studio_jbr"
  elif [[ -x /usr/libexec/java_home ]]; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
  else
    fail 'Java was not found. Set JAVA_HOME before running this script.'
  fi
fi
[[ -x "$JAVA_HOME/bin/java" ]] || fail "JAVA_HOME does not contain java: $JAVA_HOME"

NEXT_CODE="$next_code" NEXT_VERSION="$next_version" perl -0pi -e '
  s/(versionCode\s+)\d+/$1 . $ENV{NEXT_CODE}/e;
  s/(versionName\s+")[^"]+"/$1 . $ENV{NEXT_VERSION} . q{"}/e;
' "$build_file"

printf 'Building VMP %s (versionCode %s)...\n' "$next_version" "$next_code"
(cd android && ./gradlew :app:assembleRelease)

apk_path='android/app/build/outputs/apk/release/app-release.apk'
[[ -f "$apk_path" ]] || fail "Release APK was not created: $apk_path"
asset_name="VMP-Sunmi-$tag.apk"

git add -A
git commit -m "release: VMP $tag"
git tag -a "$tag" -m "VMP $next_version"

branch="$(git branch --show-current)"
[[ -n "$branch" ]] || fail 'Cannot publish from a detached Git HEAD.'
git push -u origin "$branch"
git push origin "$tag"

github_credentials="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)"
github_token="$(printf '%s\n' "$github_credentials" | sed -n 's/^password=//p')"
[[ -n "$github_token" ]] || fail 'No GitHub credential was found. Push to GitHub first, then retry.'

if [[ -z "$release_notes" ]]; then
  release_notes="VMP $next_version for SUNMI V2 Pro"
fi

release_payload="$(jq -n \
  --arg tag "$tag" \
  --arg branch "$branch" \
  --arg name "VMP $next_version" \
  --arg notes "$release_notes" \
  '{tag_name: $tag, target_commitish: $branch, name: $name, body: $notes, draft: false, prerelease: false}')"

release_json="$(curl --fail --silent --show-error \
  -X POST \
  -H "Authorization: Bearer $github_token" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "https://api.github.com/repos/$github_owner/$github_repo/releases" \
  -d "$release_payload")"
release_id="$(printf '%s' "$release_json" | jq -r '.id')"
[[ "$release_id" =~ ^[0-9]+$ ]] || fail 'GitHub did not return a release ID.'

curl --fail --silent --show-error \
  -X POST \
  -H "Authorization: Bearer $github_token" \
  -H 'Accept: application/vnd.github+json' \
  -H 'Content-Type: application/vnd.android.package-archive' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  --data-binary "@$apk_path" \
  "https://uploads.github.com/repos/$github_owner/$github_repo/releases/$release_id/assets?name=$asset_name" \
  | jq -r '"Published GitHub Release " + .uploader.login + ": " + .browser_download_url'

printf 'Done: %s is available through GitHub Release.\n' "$tag"
