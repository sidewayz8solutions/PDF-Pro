#!/bin/bash

# PDF-Pro Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.production.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p logs backups certificates nginx/conf.d monitoring

log "Starting PDF-Pro deployment for environment: $ENVIRONMENT"

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
fi

# Check if required environment variables are set
required_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "NEXTAUTH_URL"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        error "Required environment variable $var is not set"
    fi
done

success "Pre-deployment checks passed"

# Backup current deployment
if [ "$ENVIRONMENT" = "production" ]; then
    log "Creating backup of current deployment..."
    
    # Create backup directory with timestamp
    BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup-$BACKUP_TIMESTAMP"
    mkdir -p "$BACKUP_PATH"
    
    # Backup database (if using local database)
    if docker-compose -f "$COMPOSE_FILE" ps postgres > /dev/null 2>&1; then
        log "Backing up database..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres pdfpro > "$BACKUP_PATH/database.sql"
    fi
    
    # Backup Redis data
    if docker-compose -f "$COMPOSE_FILE" ps redis > /dev/null 2>&1; then
        log "Backing up Redis data..."
        docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli BGSAVE
        docker cp $(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/dump.rdb "$BACKUP_PATH/redis-dump.rdb"
    fi
    
    # Backup configuration files
    cp -r nginx "$BACKUP_PATH/"
    cp -r certificates "$BACKUP_PATH/" 2>/dev/null || true
    cp .env.local "$BACKUP_PATH/" 2>/dev/null || true
    
    success "Backup created at $BACKUP_PATH"
fi

# Build and deploy
log "Building application..."

# Build the Docker image
docker-compose -f "$COMPOSE_FILE" build --no-cache

log "Stopping existing services..."
docker-compose -f "$COMPOSE_FILE" down

log "Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 30

# Health checks
log "Running health checks..."

# Check application health
for i in {1..30}; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        success "Application is healthy"
        break
    fi
    
    if [ $i -eq 30 ]; then
        error "Application health check failed after 30 attempts"
    fi
    
    log "Waiting for application to be ready... (attempt $i/30)"
    sleep 10
done

# Check Redis health
if ! docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
    warning "Redis health check failed"
else
    success "Redis is healthy"
fi

# Check Nginx health
if ! docker-compose -f "$COMPOSE_FILE" exec -T nginx nginx -t > /dev/null 2>&1; then
    warning "Nginx configuration test failed"
else
    success "Nginx configuration is valid"
fi

# Post-deployment tasks
log "Running post-deployment tasks..."

# Clear application cache
log "Clearing application cache..."
curl -X POST http://localhost:3000/api/admin/cache/clear -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1 || true

# Warm up cache
log "Warming up cache..."
curl -X POST http://localhost:3000/api/admin/cache/warmup -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1 || true

# Run database migrations (if needed)
if [ "$ENVIRONMENT" = "production" ]; then
    log "Running database migrations..."
    # Add your migration commands here
    # docker-compose -f "$COMPOSE_FILE" exec app npm run migrate
fi

# Update monitoring dashboards
log "Updating monitoring configuration..."
# Restart monitoring services to pick up new configuration
docker-compose -f "$COMPOSE_FILE" restart prometheus grafana

# SSL certificate check
log "Checking SSL certificates..."
if [ -f "certificates/pdfpro.crt" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in certificates/pdfpro.crt | cut -d= -f2)
    CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (CERT_EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
        warning "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
    else
        success "SSL certificate is valid for $DAYS_UNTIL_EXPIRY days"
    fi
else
    warning "SSL certificate not found"
fi

# Performance optimization
log "Running performance optimizations..."

# Optimize Docker images
docker system prune -f

# Set up log rotation
if [ ! -f "/etc/logrotate.d/pdfpro" ]; then
    log "Setting up log rotation..."
    sudo tee /etc/logrotate.d/pdfpro > /dev/null <<EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        docker-compose -f $PWD/$COMPOSE_FILE exec nginx nginx -s reload
    endscript
}

$PWD/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
}
EOF
fi

# Final verification
log "Running final verification..."

# Test critical endpoints
ENDPOINTS=(
    "http://localhost:3000/api/health"
    "http://localhost:3000/"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f "$endpoint" > /dev/null 2>&1; then
        success "Endpoint $endpoint is responding"
    else
        error "Endpoint $endpoint is not responding"
    fi
done

# Display deployment summary
log "Deployment Summary:"
echo "===================="
echo "Environment: $ENVIRONMENT"
echo "Deployment Time: $(date)"
echo "Services Status:"
docker-compose -f "$COMPOSE_FILE" ps
echo "===================="

# Display service URLs
echo ""
echo "Service URLs:"
echo "Application: https://localhost (or your domain)"
echo "Grafana Dashboard: http://localhost:3001"
echo "Prometheus: http://localhost:9090"
echo ""

success "Deployment completed successfully!"

# Optional: Send notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"PDF-Pro deployment completed successfully for $ENVIRONMENT environment\"}" \
        "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
fi

log "Deployment script finished"
