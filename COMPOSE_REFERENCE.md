# Compose Files Reference

## docker-compose.yml (Production)
- Uses official `postgres:17-alpine` image
- Multi-stage Dockerfile build with production optimizations
- Separate named volumes for database and app data
- Health checks on both services with exponential backoff
- Service dependencies: server waits for db to be healthy
- Network isolation via named bridge network
- Environment variables loaded from `.env`
- Restart policy: `unless-stopped`

**Usage:**
```bash
# Set required secrets first
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
export AIDEVELO_AGENT_JWT_SECRET=$(openssl rand -base64 32)

# Start full stack
docker compose up -d

# View status
docker compose ps

# Follow logs
docker compose logs -f server
```

## docker-compose.dev.yml (Development)
- Targets the `build` stage of Dockerfile (includes dev tools)
- Bind mounts for ./server, ./ui, ./packages for hot reload
- `develop.watch` section for automatic sync on file changes
- Separate dev containers (aidevelo-server-dev, aidevelo-db-dev)
- Separate dev volumes with local data directories
- NODE_ENV set to development
- Relaxed BETTER_AUTH_SECRET (dev default instead of required)
- Extended health check start_period (30s for slower rebuilds)

**Usage:**
```bash
# Start with hot reload
docker compose -f docker-compose.dev.yml up

# Files in ./server, ./ui, ./packages sync automatically
# Changes trigger rebuild and restart
```

## docker-compose.local.yml (Reference)
- Previously used for local development with Postgres
- Kept for backward compatibility
- Uses 5432 port binding for local Postgres access

**Usage:**
```bash
docker compose -f docker-compose.local.yml up -d
```

## docker-compose.quickstart.yml (Reference)
- Minimal setup without separate database container
- Uses PGlite (embedded database)
- Single container deployment
- No database service dependency

**Usage:**
```bash
docker compose -f docker-compose.quickstart.yml up -d
```

## Environment Variables

### Required for docker-compose.yml
- `BETTER_AUTH_SECRET`: Long random string (32+ chars, generate with `openssl rand -base64 32`)
- `AIDEVELO_AGENT_JWT_SECRET`: Long random string (32+ chars)

### Optional
- `AIDEVELO_PORT`: Port mapping (default: 3100)
- `AIDEVELO_PUBLIC_URL`: Public URL for the service (default: http://localhost:3100)
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `MINIMAX_API_KEY`: MiniMax API key

Create a `.env` file in the project root:
```bash
BETTER_AUTH_SECRET=your-long-random-secret-here
AIDEVELO_AGENT_JWT_SECRET=your-long-random-secret-here
AIDEVELO_PORT=3100
AIDEVELO_PUBLIC_URL=http://localhost:3100
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

## Network Architecture

```
aidevelo-net (bridge network)
├── db service
│   └── accessible at hostname 'db' on port 5432
└── server service
    ├── accessible at hostname 'server' on internal network
    └── exposed on 127.0.0.1:3100 externally
```

Services communicate by hostname within the network:
- Server connects to database via: `postgres://aidevelo:aidevelo@db:5432/aidevelo`

## Volumes

### Production (docker-compose.yml)
- `pgdata`: Postgres database storage
- `aidevelo-data`: App configuration and user data

### Development (docker-compose.dev.yml)
- `./data/docker-aidevelo-dev/postgres`: Local postgres data
- `./data/docker-aidevelo-dev/app`: Local app data
- Bind mounts: ./server, ./ui, ./packages (for hot reload)

## Common Tasks

### View container status
```bash
docker compose ps
```

### View logs
```bash
docker compose logs server
docker compose logs -f server  # follow mode
```

### Execute command in running container
```bash
docker compose exec server sh
docker compose exec db psql -U aidevelo -d aidevelo
```

### Restart services
```bash
docker compose restart
docker compose restart server
```

### Stop all services
```bash
docker compose down        # keeps volumes
docker compose down -v     # removes volumes (data loss!)
```

### Rebuild and restart
```bash
docker compose build --no-cache
docker compose up -d
```

### Check service health
```bash
docker compose exec server curl http://localhost:3100/api/health
docker compose exec db pg_isready -U aidevelo
```

## Troubleshooting

### Container keeps restarting
```bash
docker compose logs server
# Check for startup errors, missing environment variables, port conflicts
```

### Database connection refused
```bash
docker compose ps  # verify db container is running
docker compose logs db  # check db logs
docker compose exec db pg_isready -U aidevelo -d aidevelo
```

### Port already in use
```bash
netstat -tulpn | grep 3100
docker compose down
```

### Out of disk space
```bash
docker system prune -a  # remove unused images/volumes
docker compose down -v  # remove volumes (data loss!)
```
