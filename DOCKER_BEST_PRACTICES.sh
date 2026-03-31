#!/bin/bash
# Docker setup guide for aidevelo

# ============================================================================
# QUICK START - Production
# ============================================================================
# Set required environment variables:
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export AIDEVELO_AGENT_JWT_SECRET=$(openssl rand -base64 32)

# Run full stack with database:
docker compose up -d

# Check services:
docker compose ps
docker compose logs -f server


# ============================================================================
# Development with hot reload
# ============================================================================
# Use the dev compose file with bind mounts and watch mode:
docker compose -f docker-compose.dev.yml up

# Files in ./server, ./ui, and ./packages will sync automatically
# Changes trigger automatic rebuilds


# ============================================================================
# Docker best practices applied to this project
# ============================================================================

# 1. MULTI-STAGE BUILDS
#    - deps stage: installs dependencies only (cacheable)
#    - build stage: compiles code, creates distributions
#    - production: final minimal image with only runtime artifacts
#    Benefits: smaller final image, better layer caching, faster rebuilds

# 2. LAYER CACHING OPTIMIZATION
#    - package.json files copied first (changes rarely)
#    - dependencies installed early (most cacheable step)
#    - source code copied last (changes frequently)
#    Benefits: faster builds during development

# 3. HEALTH CHECKS
#    - server responds to /api/health endpoint
#    - docker compose waits for healthy services before starting dependent services
#    Benefits: reliable service startup, better orchestration

# 4. SECURITY
#    - runs as non-root 'node' user (not root)
#    - uses alpine-based Node image (smaller, fewer CVEs)
#    - explicit volume for data isolation
#    - env vars for secrets (not hardcoded)

# 5. ENVIRONMENT VARIABLES
#    - NODE_ENV set to production in final image
#    - Host/port configured for container networking
#    - Database URL points to internal docker network
#    - Secrets loaded from .env (never committed)

# 6. NETWORKING
#    - aidevelo-net bridge network for service discovery
#    - server talks to db via hostname 'db' (not localhost)
#    - ports bound to 127.0.0.1 to prevent external access

# 7. VOLUMES
#    - pgdata: persists postgres data across restarts
#    - aidevelo-data: persists app configuration and user data
#    - dev.yml adds bind mounts for live code sync

# 8. .dockerignore
#    - excludes .git, node_modules, coverage, logs
#    - reduces build context size from ~52MB to ~15MB
#    - speeds up docker build
#    Benefits: faster builds, smaller images


# ============================================================================
# Common commands
# ============================================================================

# View logs:
docker compose logs server          # current logs
docker compose logs -f server       # follow logs in real-time

# Stop services:
docker compose down                 # stops containers, keeps volumes
docker compose down -v              # also removes volumes (data loss!)

# Rebuild image:
docker compose build --no-cache     # force rebuild from scratch
docker compose up -d --build        # rebuild and restart

# Shell into container:
docker compose exec server sh

# Prune unused images/volumes:
docker system prune -a              # removes unused images and volumes

# Clean up dev environment:
rm -rf data/docker-aidevelo-dev     # removes dev data
docker compose -f docker-compose.dev.yml down -v


# ============================================================================
# Troubleshooting
# ============================================================================

# Container exits immediately:
docker compose logs server          # check error messages

# Port already in use:
docker compose down                 # stop existing containers
netstat -tulpn | grep 3100          # check what's using port 3100

# Database connection errors:
docker compose ps                   # verify db is running
docker compose exec db psql -U aidevelo -d aidevelo -c "SELECT 1"

# Build failures:
docker compose build --no-cache     # rebuild without cache
docker system prune                 # free up disk space
