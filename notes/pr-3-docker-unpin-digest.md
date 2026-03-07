# PR Draft — docker: stop pinning node:22-bookworm digest (fix Docker build)

## Summary

This PR removes the pinned digest for the `node:22-bookworm` base image in our Dockerfiles.

The digest currently referenced upstream can become invalid / unavailable, which breaks `docker build` and `./docker-setup.sh`. Using the tag without pinning restores reliability for contributors and CI environments.

## Changes

- Update root `Dockerfile`:
  - `FROM node:22-bookworm@sha256:...` → `FROM node:22-bookworm`
  - Remove the `org.opencontainers.image.base.digest` label (no longer meaningful without a pinned digest).
- Apply the same change to:
  - `scripts/e2e/Dockerfile`
  - `scripts/e2e/Dockerfile.qr-import`

## Verification

- **Test**: `pnpm test:e2e src/docker-setup.e2e.test.ts`
  - ✅ Passes locally (13 tests).
- **Manual (recommended in CI / Docker-enabled env)**:
  - `./docker-setup.sh`
  - `docker build .`

## Notes

Pinning digests is great for reproducibility, but in this case it creates a single point of failure when the upstream digest is rotated or removed. If we want both reproducibility and reliability, a follow-up could pin to a known-good digest _with_ a documented update procedure and/or fallback.
