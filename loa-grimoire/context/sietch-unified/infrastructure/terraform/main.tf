# =============================================================================
# SIETCH UNIFIED - TERRAFORM MAIN CONFIGURATION
# =============================================================================
# Google Cloud Platform deployment with:
# - Cloud Run (serverless containers)
# - Cloud SQL (PostgreSQL)
# - Memorystore (Redis)
# - Secret Manager
# - Cloud Armor (WAF)
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote state storage (uncomment for production)
  # backend "gcs" {
  #   bucket = "sietch-unified-terraform-state"
  #   prefix = "terraform/state"
  # }
}

# =============================================================================
# PROVIDERS
# =============================================================================

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "google_project" "project" {
  project_id = var.project_id
}

# =============================================================================
# NETWORKING
# =============================================================================

# VPC for private services
resource "google_compute_network" "main" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id

  private_ip_google_access = true
}

# VPC Connector for Cloud Run to access private resources
resource "google_vpc_access_connector" "connector" {
  name          = "${var.project_name}-connector"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
  
  min_instances = 2
  max_instances = 10
}

# Private service connection for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.project_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# =============================================================================
# CLOUD SQL (PostgreSQL)
# =============================================================================

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_database_instance" "main" {
  name             = "${var.project_name}-db"
  database_version = "POSTGRES_16"
  region           = var.region
  
  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "production"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM
      update_track = "stable"
    }
  }

  deletion_protection = var.environment == "production"
}

resource "google_sql_database" "main" {
  name     = "sietch_unified"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = "sietch"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# =============================================================================
# MEMORYSTORE (Redis)
# =============================================================================

resource "google_redis_instance" "main" {
  name           = "${var.project_name}-redis"
  tier           = var.environment == "production" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.redis_memory_gb
  region         = var.region

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version = "REDIS_7_0"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
      }
    }
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# =============================================================================
# SECRET MANAGER
# =============================================================================

# Database URL
resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.project_name}-database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.main.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.main.name}"
}

# Redis URL
resource "google_secret_manager_secret" "redis_url" {
  secret_id = "${var.project_name}-redis-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.main.host}:${google_redis_instance.main.port}"
}

# API Keys (created but values set externally)
resource "google_secret_manager_secret" "collabland_api_key" {
  secret_id = "${var.project_name}-collabland-api-key"
  replication { auto {} }
}

resource "google_secret_manager_secret" "dune_api_key" {
  secret_id = "${var.project_name}-dune-api-key"
  replication { auto {} }
}

resource "google_secret_manager_secret" "discord_bot_token" {
  secret_id = "${var.project_name}-discord-bot-token"
  replication { auto {} }
}

resource "google_secret_manager_secret" "telegram_bot_token" {
  secret_id = "${var.project_name}-telegram-bot-token"
  replication { auto {} }
}

resource "google_secret_manager_secret" "admin_api_key" {
  secret_id = "${var.project_name}-admin-api-key"
  replication { auto {} }
}

# =============================================================================
# SERVICE ACCOUNT
# =============================================================================

resource "google_service_account" "cloud_run" {
  account_id   = "${var.project_name}-cloud-run"
  display_name = "Sietch Unified Cloud Run Service Account"
}

# Grant access to secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each = toset([
    google_secret_manager_secret.database_url.secret_id,
    google_secret_manager_secret.redis_url.secret_id,
    google_secret_manager_secret.collabland_api_key.secret_id,
    google_secret_manager_secret.dune_api_key.secret_id,
    google_secret_manager_secret.discord_bot_token.secret_id,
    google_secret_manager_secret.telegram_bot_token.secret_id,
    google_secret_manager_secret.admin_api_key.secret_id,
  ])

  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Grant Cloud SQL access
resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# =============================================================================
# ARTIFACT REGISTRY
# =============================================================================

resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = var.project_name
  format        = "DOCKER"
  description   = "Docker images for Sietch Unified"
}

# =============================================================================
# CLOUD RUN - API SERVER
# =============================================================================

resource "google_cloud_run_v2_service" "api_server" {
  name     = "${var.project_name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.project_name}/api-server:latest"

      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
        cpu_idle = var.environment != "production"
      }

      ports {
        container_port = 3001
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "PORT"
        value = "3001"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "COLLABLAND_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.collabland_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DUNE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.dune_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "ADMIN_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.admin_api_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.redis_url,
  ]
}

# Allow unauthenticated access to API
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  location = google_cloud_run_v2_service.api_server.location
  name     = google_cloud_run_v2_service.api_server.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# CLOUD RUN - DISCORD BOT
# =============================================================================

resource "google_cloud_run_v2_service" "discord_bot" {
  name     = "${var.project_name}-discord-bot"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.cloud_run.email

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = 1  # Always running for Discord gateway
      max_instance_count = 1
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.project_name}/discord-bot:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "API_BASE_URL"
        value = google_cloud_run_v2_service.api_server.uri
      }

      env {
        name = "DISCORD_BOT_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.discord_bot_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "DISCORD_CLIENT_ID"
        value = var.discord_client_id
      }

      env {
        name  = "DISCORD_GUILD_ID"
        value = var.discord_guild_id
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# =============================================================================
# CLOUD RUN - TELEGRAM BOT
# =============================================================================

resource "google_cloud_run_v2_service" "telegram_bot" {
  name     = "${var.project_name}-telegram-bot"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"  # Needs webhook access

  template {
    service_account = google_service_account.cloud_run.email

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = 3
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.project_name}/telegram-bot:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "API_BASE_URL"
        value = google_cloud_run_v2_service.api_server.uri
      }

      env {
        name = "TELEGRAM_BOT_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.telegram_bot_token.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "TELEGRAM_MINIAPP_URL"
        value = var.telegram_miniapp_url
      }

      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow webhook access to Telegram bot
resource "google_cloud_run_v2_service_iam_member" "telegram_public" {
  location = google_cloud_run_v2_service.telegram_bot.location
  name     = google_cloud_run_v2_service.telegram_bot.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# CLOUD SCHEDULER (Scheduled Tasks)
# =============================================================================

# Activity Decay (every 6 hours)
resource "google_cloud_scheduler_job" "activity_decay" {
  name        = "${var.project_name}-activity-decay"
  description = "Apply 10% activity score decay"
  schedule    = "0 */6 * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api_server.uri}/admin/decay"

    headers = {
      "X-API-Key" = "placeholder"  # Set via Secret Manager in production
    }

    oidc_token {
      service_account_email = google_service_account.cloud_run.email
    }
  }
}

# Eligibility Sync (every 6 hours)
resource "google_cloud_scheduler_job" "eligibility_sync" {
  name        = "${var.project_name}-eligibility-sync"
  description = "Re-evaluate all member eligibility"
  schedule    = "30 */6 * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api_server.uri}/admin/refresh-rankings"

    oidc_token {
      service_account_email = google_service_account.cloud_run.email
    }
  }
}

# Badge Evaluation (daily at midnight)
resource "google_cloud_scheduler_job" "badge_evaluation" {
  name        = "${var.project_name}-badge-evaluation"
  description = "Evaluate and award badges"
  schedule    = "0 0 * * *"
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.api_server.uri}/admin/badges/check"

    oidc_token {
      service_account_email = google_service_account.cloud_run.email
    }
  }
}

# =============================================================================
# CLOUD ARMOR (WAF) - Optional
# =============================================================================

resource "google_compute_security_policy" "api_policy" {
  count = var.enable_cloud_armor ? 1 : 0
  name  = "${var.project_name}-api-policy"

  # Rate limiting
  rule {
    action   = "rate_based_ban"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Rate limit to 100 req/min"
  }

  # Block known bad actors
  rule {
    action   = "deny(403)"
    priority = 2000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  rule {
    action   = "deny(403)"
    priority = 2001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection"
  }

  # Default allow
  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

# =============================================================================
# MONITORING
# =============================================================================

# Uptime check for API
resource "google_monitoring_uptime_check_config" "api_uptime" {
  display_name = "${var.project_name}-api-uptime"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = replace(google_cloud_run_v2_service.api_server.uri, "https://", "")
    }
  }
}

# Alert policy for downtime
resource "google_monitoring_alert_policy" "api_downtime" {
  display_name = "${var.project_name}-api-downtime"
  combiner     = "OR"

  conditions {
    display_name = "API Uptime Check Failing"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = var.alert_notification_channels

  alert_strategy {
    auto_close = "604800s"  # 7 days
  }
}
