# =============================================================================
# SIETCH UNIFIED - TERRAFORM OUTPUTS
# =============================================================================

# =============================================================================
# API SERVER
# =============================================================================

output "api_server_url" {
  description = "URL of the API server"
  value       = google_cloud_run_v2_service.api_server.uri
}

output "api_server_service_account" {
  description = "Service account for API server"
  value       = google_service_account.cloud_run.email
}

# =============================================================================
# DISCORD BOT
# =============================================================================

output "discord_bot_service_name" {
  description = "Discord bot Cloud Run service name"
  value       = google_cloud_run_v2_service.discord_bot.name
}

# =============================================================================
# TELEGRAM BOT
# =============================================================================

output "telegram_bot_url" {
  description = "Telegram bot webhook URL"
  value       = google_cloud_run_v2_service.telegram_bot.uri
}

# =============================================================================
# DATABASE
# =============================================================================

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "database_connection_name" {
  description = "Cloud SQL connection name (for Cloud SQL Proxy)"
  value       = google_sql_database_instance.main.connection_name
}

output "database_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

# =============================================================================
# REDIS
# =============================================================================

output "redis_host" {
  description = "Redis instance host"
  value       = google_redis_instance.main.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.main.port
}

# =============================================================================
# SECRETS
# =============================================================================

output "secrets" {
  description = "Secret Manager secret names"
  value = {
    database_url        = google_secret_manager_secret.database_url.secret_id
    redis_url           = google_secret_manager_secret.redis_url.secret_id
    collabland_api_key  = google_secret_manager_secret.collabland_api_key.secret_id
    dune_api_key        = google_secret_manager_secret.dune_api_key.secret_id
    discord_bot_token   = google_secret_manager_secret.discord_bot_token.secret_id
    telegram_bot_token  = google_secret_manager_secret.telegram_bot_token.secret_id
    admin_api_key       = google_secret_manager_secret.admin_api_key.secret_id
  }
}

# =============================================================================
# ARTIFACT REGISTRY
# =============================================================================

output "artifact_registry_repository" {
  description = "Docker image repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

# =============================================================================
# VPC
# =============================================================================

output "vpc_network_name" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "vpc_connector_name" {
  description = "VPC connector name for Cloud Run"
  value       = google_vpc_access_connector.connector.name
}

# =============================================================================
# DEPLOYMENT INSTRUCTIONS
# =============================================================================

output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value       = <<-EOT
    
    ╔═══════════════════════════════════════════════════════════╗
    ║           SIETCH UNIFIED - DEPLOYMENT COMPLETE            ║
    ╠═══════════════════════════════════════════════════════════╣
    ║                                                           ║
    ║  Next Steps:                                              ║
    ║                                                           ║
    ║  1. Set API keys in Secret Manager:                       ║
    ║     gcloud secrets versions add ${google_secret_manager_secret.collabland_api_key.secret_id} \
    ║       --data-file=- <<< "your-collabland-api-key"         ║
    ║                                                           ║
    ║  2. Build and push Docker images:                         ║
    ║     docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${var.project_name}/api-server:latest .
    ║     docker push ${var.region}-docker.pkg.dev/${var.project_id}/${var.project_name}/api-server:latest
    ║                                                           ║
    ║  3. Run database migrations:                              ║
    ║     Connect via Cloud SQL Proxy and run:                  ║
    ║     pnpm db:migrate                                       ║
    ║                                                           ║
    ║  4. Set Telegram webhook:                                 ║
    ║     curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=${google_cloud_run_v2_service.telegram_bot.uri}"
    ║                                                           ║
    ║  API URL: ${google_cloud_run_v2_service.api_server.uri}
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
  EOT
}
