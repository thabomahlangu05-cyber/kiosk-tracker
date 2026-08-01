# Deployment Guide

## Production Deployment with Docker

### Prerequisites
- Docker and Docker Compose installed
- PostgreSQL database (can use Docker service from docker-compose.yml)
- Node.js 20+ for local development

### Local Development with SQLite

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:3000 and log in with demo credentials:
- Email: `thabo.mahlangu@tymedigital.com`
- Password: `changeme123` (dev only)

### Production Deployment

#### 1. Set up environment variables

Create `.env.production.local`:

```bash
DATABASE_URL=postgresql://kiosk_user:YOUR_SECURE_PASSWORD@your-postgres-host:5432/kiosk_production
NODE_ENV=production
SESSION_SECRET=$(openssl rand -base64 32)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

#### 2. Build Docker image

```bash
docker build -t kiosk-tracker:latest .
```

#### 3. Run with Docker Compose

```bash
# Set environment variables
export DB_PASSWORD=your_secure_password

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app
```

#### 4. Using Docker individually

```bash
# Run container
docker run -d \
  --name kiosk-app \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@postgres-host/db \
  -e NODE_ENV=production \
  -e SESSION_SECRET=$(openssl rand -base64 32) \
  kiosk-tracker:latest

# Run migrations
docker exec kiosk-app npx prisma migrate deploy

# Seed production (if needed)
docker exec kiosk-app npx prisma db seed
```

#### 5. Database Migration

If migrating from SQLite to PostgreSQL:

```bash
# Export SQLite data (if needed)
# 1. Backup existing SQLite database
# 2. Set DATABASE_URL to PostgreSQL
# 3. Run migrations
docker exec kiosk-app npx prisma migrate deploy

# 4. Seed initial data if needed
docker exec kiosk-app npx prisma db seed
```

### Health Checks

```bash
# Test app health
curl http://localhost:3000/dashboard

# Test database connection
docker-compose exec postgres psql -U kiosk_user -d kiosk_production -c "SELECT 1"
```

### Monitoring

```bash
# View container logs
docker-compose logs -f app

# Check resource usage
docker stats kiosk-app

# View running services
docker-compose ps
```

### Backup and Recovery

```bash
# Backup PostgreSQL database
docker-compose exec postgres pg_dump -U kiosk_user kiosk_production > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U kiosk_user kiosk_production < backup.sql
```

### Stopping and Cleanup

```bash
# Stop services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove image
docker rmi kiosk-tracker:latest
```

### Production Checklist

- [ ] Set strong `SESSION_SECRET` (use `openssl rand -base64 32`)
- [ ] Use secure PostgreSQL password
- [ ] Enable HTTPS on reverse proxy
- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Configure firewall (only expose port 3000 or use reverse proxy)
- [ ] Set up database backups (daily recommended)
- [ ] Enable health checks on container orchestration
- [ ] Set up log aggregation
- [ ] Configure database connection pooling if needed
- [ ] Test disaster recovery procedures

### Scaling

For production with multiple instances:

```yaml
version: '3.8'

services:
  postgres:
    # ... (same as above)

  app1:
    # ... (app config)

  app2:
    # ... (app config)
    ports:
      - "3001:3000"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Support

For issues or questions, check:
- Application logs: `docker-compose logs app`
- Database logs: `docker-compose logs postgres`
- Prisma documentation: https://www.prisma.io/docs/
- Next.js documentation: https://nextjs.org/docs
