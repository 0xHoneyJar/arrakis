# =============================================================================
# SIETCH UNIFIED - MULTI-REGION DATABASE MODULE
# =============================================================================
# Provisions regional PostgreSQL instances for GDPR data sovereignty.
# Users are routed to their selected region (US/EU/Asia).
#
# ENTERPRISE STANDARD: Full GDPR compliance with regional data residency.
# =============================================================================

# -----------------------------------------------------------------------------
# VARIABLES
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "enabled_regions" {
  description = "Regions to provision databases for"
  type        = list(string)
  default     = ["us", "eu", "asia"]
}

variable "region_configs" {
  description = "Configuration per region"
  type = map(object({
    gcp_region     = string
    tier           = string
    disk_size_gb   = number
    backup_enabled = bool
  }))
  default = {
    us = {
      gcp_region     = "us-central1"
      tier           = "db-custom-2-4096"
      disk_size_gb   = 100
      backup_enabled = true
    }
    eu = {
      gcp_region     = "europe-west1"
      tier           = "db-custom-2-4096"
      disk_size_gb   = 100
      backup_enabled = true
    }
    asia = {
      gcp_region     = "asia-northeast1"
      tier           = "db-custom-2-4096"
      disk_size_gb   = 100
      backup_enabled = true
    }
  }
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "sietch"
}

variable "db_password" {
  description = "Database password (from Secret Manager)"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment (prod, staging, dev)"
  type        = string
  default     = "prod"
}

# -----------------------------------------------------------------------------
# REGIONAL DATABASE INSTANCES
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "regional" {
  for_each = toset(var.enabled_regions)

  name             = "sietch-db-${each.key}-${var.environment}"
  project          = var.project_id
  region           = var.region_configs[each.key].gcp_region
  database_version = "POSTGRES_15"

  settings {
    tier              = var.region_configs[each.key].tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = var.region_configs[each.key].disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    # Backup configuration
    backup_configuration {
      enabled                        = var.region_configs[each.key].backup_enabled
      point_in_time_recovery_enabled = var.environment == "prod"
      start_time                     = "03:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # IP configuration
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 4  # 4 AM
      update_track = "stable"
    }

    # Database flags for security
    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    # Insights for monitoring
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # User labels for compliance tracking
    user_labels = {
      environment    = var.environment
      data_region    = each.key
      gdpr_compliant = "true"
      managed_by     = "terraform"
    }
  }

  deletion_protection = var.environment == "prod"

  lifecycle {
    prevent_destroy = true
  }
}

# Database within each instance
resource "google_sql_database" "main" {
  for_each = toset(var.enabled_regions)

  name     = var.database_name
  instance = google_sql_database_instance.regional[each.key].name
  project  = var.project_id
}

# Database user
resource "google_sql_user" "app" {
  for_each = toset(var.enabled_regions)

  name     = "sietch_app"
  instance = google_sql_database_instance.regional[each.key].name
  project  = var.project_id
  password = var.db_password
}

# -----------------------------------------------------------------------------
# REGIONAL REDIS INSTANCES
# -----------------------------------------------------------------------------

resource "google_redis_instance" "regional" {
  for_each = toset(var.enabled_regions)

  name           = "sietch-cache-${each.key}-${var.environment}"
  project        = var.project_id
  region         = var.region_configs[each.key].gcp_region
  tier           = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.environment == "prod" ? 2 : 1

  redis_version = "REDIS_7_0"
  display_name  = "Sietch Cache (${upper(each.key)})"

  authorized_network = google_compute_network.vpc.id

  redis_configs = {
    maxmemory-policy = "volatile-lru"
  }

  labels = {
    environment    = var.environment
    data_region    = each.key
    gdpr_compliant = "true"
    managed_by     = "terraform"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# -----------------------------------------------------------------------------
# VPC NETWORK
# -----------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = "sietch-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false
}

# Regional subnets
resource "google_compute_subnetwork" "regional" {
  for_each = toset(var.enabled_regions)

  name          = "sietch-subnet-${each.key}-${var.environment}"
  project       = var.project_id
  region        = var.region_configs[each.key].gcp_region
  network       = google_compute_network.vpc.id
  ip_cidr_range = cidrsubnet("10.0.0.0/8", 8, index(var.enabled_regions, each.key))

  private_ip_google_access = true
}

# Private service connection for Cloud SQL
resource "google_compute_global_address" "private_ip" {
  name          = "sietch-private-ip-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]
}

# -----------------------------------------------------------------------------
# SECRET MANAGER - Connection Strings
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "db_urls" {
  for_each = toset(var.enabled_regions)

  project   = var.project_id
  secret_id = "sietch-db-url-${each.key}-${var.environment}"

  replication {
    user_managed {
      replicas {
        location = var.region_configs[each.key].gcp_region
      }
    }
  }

  labels = {
    data_region = each.key
  }
}

resource "google_secret_manager_secret_version" "db_urls" {
  for_each = toset(var.enabled_regions)

  secret = google_secret_manager_secret.db_urls[each.key].id
  secret_data = format(
    "postgresql://sietch_app:%s@%s/%s?sslmode=require",
    var.db_password,
    google_sql_database_instance.regional[each.key].private_ip_address,
    var.database_name
  )
}

resource "google_secret_manager_secret" "redis_urls" {
  for_each = toset(var.enabled_regions)

  project   = var.project_id
  secret_id = "sietch-redis-url-${each.key}-${var.environment}"

  replication {
    user_managed {
      replicas {
        location = var.region_configs[each.key].gcp_region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "redis_urls" {
  for_each = toset(var.enabled_regions)

  secret = google_secret_manager_secret.redis_urls[each.key].id
  secret_data = format(
    "redis://%s:6379",
    google_redis_instance.regional[each.key].host
  )
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "database_instances" {
  description = "Regional database instance details"
  value = {
    for region in var.enabled_regions : region => {
      instance_name     = google_sql_database_instance.regional[region].name
      connection_name   = google_sql_database_instance.regional[region].connection_name
      private_ip        = google_sql_database_instance.regional[region].private_ip_address
      gcp_region        = var.region_configs[region].gcp_region
      secret_id         = google_secret_manager_secret.db_urls[region].secret_id
    }
  }
}

output "redis_instances" {
  description = "Regional Redis instance details"
  value = {
    for region in var.enabled_regions : region => {
      instance_name = google_redis_instance.regional[region].name
      host          = google_redis_instance.regional[region].host
      port          = google_redis_instance.regional[region].port
      gcp_region    = var.region_configs[region].gcp_region
      secret_id     = google_secret_manager_secret.redis_urls[region].secret_id
    }
  }
}

output "connection_secrets" {
  description = "Secret Manager secret IDs for connection strings"
  value = {
    for region in var.enabled_regions : region => {
      database_url_secret = google_secret_manager_secret.db_urls[region].secret_id
      redis_url_secret    = google_secret_manager_secret.redis_urls[region].secret_id
    }
  }
}

output "vpc_network" {
  description = "VPC network details"
  value = {
    network_id   = google_compute_network.vpc.id
    network_name = google_compute_network.vpc.name
  }
}
