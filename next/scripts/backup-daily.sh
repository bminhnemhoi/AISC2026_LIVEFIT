#!/bin/sh
# Run on the Linux host from the repository root, with its protected backup environment.
set -eu
umask 077
: "${RESTIC_REPOSITORY:?off-host encrypted repository required}"
: "${RESTIC_PASSWORD_FILE:?protected password file required}"
: "${LIVELIFT_WORKSPACE_ID:?workspace UUID required}"
exec 9>/var/lock/livelift-v3-backup.lock
flock -n 9
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
artifact=$(docker compose -f docker-compose.v3.yml exec -T next node .ops/scripts/ops.js backup | tail -n 1)
case "$artifact" in /var/backups/livelift/backup-*) ;; *) exit 1 ;; esac
name=$(basename "$artifact")
docker compose -f docker-compose.v3.yml cp "next:$artifact" "$stage/$name"
# Verify transport bytes against the manifest before uploading the already-validated closed artifact.
node --input-type=module - "$stage/$name" <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = process.argv[2];
const manifest = JSON.parse(readFileSync(dir + '/manifest.json', 'utf8'));
if (createHash('sha256').update(readFileSync(dir + '/authority.sqlite')).digest('hex') !== manifest.sha256) process.exit(1);
JS
restic backup --quiet --tag livelift-v3 --tag "$LIVELIFT_WORKSPACE_ID" "$stage/$name"
restic check --quiet --read-data
restic forget --quiet --tag "livelift-v3,$LIVELIFT_WORKSPACE_ID" --group-by tags --keep-within 14d --prune
docker compose -f docker-compose.v3.yml exec -T next node .ops/scripts/ops.js backup --prune-only
