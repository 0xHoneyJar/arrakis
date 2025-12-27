# =============================================================================
# SIETCH UNIFIED - TERRAFORM VARIABLES
# =============================================================================

# =============================================================================
# PROJECT CONFIGURATION
# =============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name (used for resource naming)"
  type        = string
  default     = "sietch-unified"
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "Region must be a valid GCP region."
  }
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"

  # Production recommendations:
  # - db-custom-2-4096 for small workloads
  # - db-custom-4-8192 for medium workloads
  # - db-custom-8-16384 for large workloads
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 10
}

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

# =============================================================================
# CLOUD RUN CONFIGURATION
# =============================================================================

variable "cpu_limit" {
  description = "CPU limit for Cloud Run containers"
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run containers"
  type        = string
  default     = "512Mi"
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

# =============================================================================
# DISCORD CONFIGURATION
# =============================================================================

variable "discord_client_id" {
  description = "Discord application client ID"
  type        = string
  default     = ""
}

variable "discord_guild_id" {
  description = "Discord server (guild) ID"
  type        = string
  default     = ""
}

# =============================================================================
# TELEGRAM CONFIGURATION
# =============================================================================

variable "telegram_miniapp_url" {
  description = "URL of deployed Telegram Mini App"
  type        = string
  default     = ""
}

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================

variable "enable_cloud_armor" {
  description = "Enable Cloud Armor WAF"
  type        = bool
  default     = false
}

# =============================================================================
# MONITORING CONFIGURATION
# =============================================================================

variable "alert_notification_channels" {
  description = "Notification channels for alerts"
  type        = list(string)
  default     = []
}

# =============================================================================
# GDPR / DATA RESIDENCY
# =============================================================================

variable "data_region" {
  description = "Data residency region for GDPR compliance"
  type        = string
  default     = "us"

  validation {
    condition     = contains(["us", "eu", "asia"], var.data_region)
    error_message = "Data region must be us, eu, or asia."
  }
}

# Regional mappings for GDPR compliance
locals {
  region_mapping = {
    us   = "us-central1"
    eu   = "europe-west1"
    asia = "asia-southeast1"
  }

  effective_region = var.data_region != "" ? local.region_mapping[var.data_region] : var.region
}
