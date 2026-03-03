# NATS JetStream Cluster for Arrakis Scaling Initiative
# Sprint S-5: NATS JetStream Deployment
# Replaces RabbitMQ for low-latency message routing per SDD §7.1

# --------------------------------------------------------------------------
# TLS Certificate Infrastructure (SEC-4.4)
# Self-signed CA via Terraform tls provider (zero-cost alternative to ACM PCA)
# --------------------------------------------------------------------------

# CA private key
resource "tls_private_key" "nats_ca" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

# Self-signed CA cert (10yr validity)
resource "tls_self_signed_cert" "nats_ca" {
  private_key_pem = tls_private_key.nats_ca.private_key_pem

  subject {
    common_name  = "Arrakis NATS CA"
    organization = "0xHoneyJar"
  }

  validity_period_hours = 87600 # 10 years
  is_ca_certificate     = true
  allowed_uses          = ["cert_signing", "crl_signing"]
}

# Server private key
resource "tls_private_key" "nats_server" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

# CSR for server cert
resource "tls_cert_request" "nats_server" {
  private_key_pem = tls_private_key.nats_server.private_key_pem

  subject {
    common_name = "nats.${local.name_prefix}.local"
  }

  dns_names    = ["nats.${local.name_prefix}.local", "*.nats.${local.name_prefix}.local", "localhost"]
  ip_addresses = ["127.0.0.1"]
}

# CA-signed server cert (1yr validity)
resource "tls_locally_signed_cert" "nats_server" {
  cert_request_pem   = tls_cert_request.nats_server.cert_request_pem
  ca_private_key_pem = tls_private_key.nats_ca.private_key_pem
  ca_cert_pem        = tls_self_signed_cert.nats_ca.cert_pem

  validity_period_hours = 8760 # 1 year
  allowed_uses          = ["digital_signature", "key_encipherment", "server_auth"]
}

# --------------------------------------------------------------------------
# Secrets Manager for NATS TLS Certificates
# --------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "nats_tls_ca" {
  name                    = "${local.name_prefix}/nats-tls-ca"
  description             = "NATS TLS CA certificate (shared with all clients)"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.secrets.id

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "SEC-4.4"
  })
}

resource "aws_secretsmanager_secret_version" "nats_tls_ca" {
  secret_id     = aws_secretsmanager_secret.nats_tls_ca.id
  secret_string = tls_self_signed_cert.nats_ca.cert_pem
}

resource "aws_secretsmanager_secret" "nats_tls_cert" {
  name                    = "${local.name_prefix}/nats-tls-cert"
  description             = "NATS TLS server certificate"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.secrets.id

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "SEC-4.4"
  })
}

resource "aws_secretsmanager_secret_version" "nats_tls_cert" {
  secret_id     = aws_secretsmanager_secret.nats_tls_cert.id
  secret_string = tls_locally_signed_cert.nats_server.cert_pem
}

resource "aws_secretsmanager_secret" "nats_tls_key" {
  name                    = "${local.name_prefix}/nats-tls-key"
  description             = "NATS TLS server private key"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.secrets.id

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "SEC-4.4"
  })
}

resource "aws_secretsmanager_secret_version" "nats_tls_key" {
  secret_id     = aws_secretsmanager_secret.nats_tls_key.id
  secret_string = tls_private_key.nats_server.private_key_pem
}

# --------------------------------------------------------------------------
# ECS Task Definition for NATS
# --------------------------------------------------------------------------

resource "aws_ecs_task_definition" "nats" {
  family                   = "${local.name_prefix}-nats"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.nats_cpu
  memory                   = var.nats_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.nats_task.arn

  container_definitions = jsonencode([
    {
      name      = "nats"
      image     = "nats:2.10-alpine"
      essential = true

      # SEC-4.4: TLS entrypoint — writes certs from env vars to disk, then starts NATS
      entryPoint = ["sh", "-c"]
      command = [join("", [
        "mkdir -p /etc/nats/certs && ",
        "printf '%s' \"$NATS_TLS_CERT\" > /etc/nats/certs/server.crt && ",
        "printf '%s' \"$NATS_TLS_KEY\" > /etc/nats/certs/server.key && ",
        "printf '%s' \"$NATS_TLS_CA\" > /etc/nats/certs/ca.crt && ",
        "chmod 600 /etc/nats/certs/server.key && ",
        "exec nats-server ",
        "-js ",
        "-m 8222 ",
        "--tls ",
        "--tlscert=/etc/nats/certs/server.crt ",
        "--tlskey=/etc/nats/certs/server.key ",
        "--tlscacert=/etc/nats/certs/ca.crt"
      ])]

      secrets = [
        { name = "NATS_TLS_CERT", valueFrom = aws_secretsmanager_secret.nats_tls_cert.arn },
        { name = "NATS_TLS_KEY", valueFrom = aws_secretsmanager_secret.nats_tls_key.arn },
        { name = "NATS_TLS_CA", valueFrom = aws_secretsmanager_secret.nats_tls_ca.arn }
      ]

      portMappings = [
        {
          containerPort = 4222
          hostPort      = 4222
          protocol      = "tcp"
          name          = "client"
        },
        {
          containerPort = 6222
          hostPort      = 6222
          protocol      = "tcp"
          name          = "cluster"
        },
        {
          containerPort = 8222
          hostPort      = 8222
          protocol      = "tcp"
          name          = "monitor"
        }
      ]

      environment = [
        {
          name  = "NATS_SERVER_NAME"
          value = "${local.name_prefix}-nats"
        }
      ]

      mountPoints = []

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.nats.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "nats"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -q --spider http://localhost:8222/healthz || exit 1"]
        interval    = 10
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  volume {
    name = "nats-data"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.nats.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.nats.id
        iam             = "ENABLED"
      }
    }
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-nats-task"
    Service = "NATS"
    Sprint  = "S-5"
  })
}

# --------------------------------------------------------------------------
# EFS for NATS JetStream Persistence
# --------------------------------------------------------------------------

resource "aws_efs_file_system" "nats" {
  creation_token = "${local.name_prefix}-nats-data"
  encrypted      = true

  performance_mode = "generalPurpose"
  throughput_mode  = "elastic"

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-nats-efs"
    Service = "NATS"
    Sprint  = "S-5"
  })
}

resource "aws_efs_mount_target" "nats" {
  count = length(module.vpc.private_subnets)

  file_system_id  = aws_efs_file_system.nats.id
  subnet_id       = module.vpc.private_subnets[count.index]
  security_groups = [aws_security_group.nats_efs.id]
}

resource "aws_efs_access_point" "nats" {
  file_system_id = aws_efs_file_system.nats.id

  posix_user {
    gid = 1000
    uid = 1000
  }

  root_directory {
    path = "/nats-data"
    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "755"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nats-ap"
  })
}

# --------------------------------------------------------------------------
# ECS Service for NATS Cluster
# --------------------------------------------------------------------------

resource "aws_ecs_service" "nats" {
  name                              = "${local.name_prefix}-nats"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.nats.arn
  desired_count                     = var.nats_desired_count
  launch_type                       = "FARGATE"
  platform_version                  = "1.4.0"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.nats.id]
    assign_public_ip = false
  }

  # NOTE: Service Discovery disabled temporarily due to ECS Cloud Map permission issues
  # Using manual registration as workaround until ECS-CloudMap integration is fixed
  # service_registries {
  #   registry_arn = aws_service_discovery_service.nats.arn
  # }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-nats-service"
    Service = "NATS"
    Sprint  = "S-5"
  })

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# --------------------------------------------------------------------------
# Security Groups for NATS
# --------------------------------------------------------------------------

resource "aws_security_group" "nats" {
  name_prefix = "${local.name_prefix}-nats-"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for NATS JetStream cluster"

  # Client connections from ECS tasks (workers, gateway)
  ingress {
    description     = "NATS client from ECS tasks"
    from_port       = 4222
    to_port         = 4222
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  # Note: Gateway ingress rule is defined as separate aws_security_group_rule
  # to avoid circular dependency between nats and gateway security groups

  # Cluster routing (NATS-to-NATS)
  ingress {
    description = "NATS cluster routing"
    from_port   = 6222
    to_port     = 6222
    protocol    = "tcp"
    self        = true
  }

  # HTTP monitoring
  ingress {
    description = "NATS HTTP monitoring"
    from_port   = 8222
    to_port     = 8222
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-nats-sg"
    Service = "NATS"
    Sprint  = "S-5"
  })

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [ingress, egress]
  }
}

# Separate rule to allow Gateway -> NATS connection (breaks circular dependency)
resource "aws_security_group_rule" "nats_from_gateway" {
  type                     = "ingress"
  from_port                = 4222
  to_port                  = 4222
  protocol                 = "tcp"
  security_group_id        = aws_security_group.nats.id
  source_security_group_id = aws_security_group.gateway.id
  description              = "NATS client from Gateway"
}

resource "aws_security_group" "nats_efs" {
  name_prefix = "${local.name_prefix}-nats-efs-"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for NATS EFS storage"

  ingress {
    description     = "NFS from NATS tasks"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.nats.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nats-efs-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Security group for Gateway to access NATS
resource "aws_security_group" "gateway" {
  name_prefix = "${local.name_prefix}-gateway-"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for Arrakis Gateway (Rust)"

  # Outbound to Discord
  egress {
    description = "HTTPS to Discord"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to NATS
  egress {
    from_port       = 4222
    to_port         = 4222
    protocol        = "tcp"
    security_groups = [aws_security_group.nats.id]
  }

  # Metrics endpoint
  ingress {
    description = "Prometheus metrics"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-gateway-sg"
    Service = "Gateway"
    Sprint  = "S-5"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# --------------------------------------------------------------------------
# IAM Role for NATS Tasks
# --------------------------------------------------------------------------

resource "aws_iam_role" "nats_task" {
  name = "${local.name_prefix}-nats-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "nats_task_efs" {
  name = "${local.name_prefix}-nats-task-efs"
  role = aws_iam_role.nats_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess"
        ]
        Resource = aws_efs_file_system.nats.arn
        Condition = {
          StringEquals = {
            "elasticfilesystem:AccessPointArn" = aws_efs_access_point.nats.arn
          }
        }
      }
    ]
  })
}

# --------------------------------------------------------------------------
# CloudWatch Log Group for NATS
# --------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "nats" {
  name              = "/ecs/${local.name_prefix}/nats"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "S-5"
  })
}

# --------------------------------------------------------------------------
# Service Discovery for NATS (used by Gateway and Workers)
# --------------------------------------------------------------------------
# Using DNS-based service discovery instead of Service Connect.
# Service Connect's Envoy proxy has issues with raw TCP protocols like NATS,
# causing 503 errors. DNS-based discovery provides direct IP resolution.

resource "aws_service_discovery_service" "nats" {
  name = "nats"

  dns_config {
    namespace_id   = var.enable_service_discovery ? aws_service_discovery_private_dns_namespace.main[0].id : null
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "S-5"
  })
}

# --------------------------------------------------------------------------
# Secrets Manager for NATS Configuration
# --------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "nats" {
  name                    = "${local.name_prefix}/nats"
  description             = "NATS connection configuration for Arrakis services"
  recovery_window_in_days = 7
  kms_key_id              = aws_kms_key.secrets.id # Sprint 95: A-94.1 - Customer-managed KMS encryption

  tags = merge(local.common_tags, {
    Service = "NATS"
    Sprint  = "95"
  })
}

resource "aws_secretsmanager_secret_version" "nats" {
  secret_id = aws_secretsmanager_secret.nats.id
  secret_string = jsonencode({
    url          = "tls://nats.${local.name_prefix}.local:4222"
    cluster_name = "arrakis-nats"
    monitor_url  = "http://nats.${local.name_prefix}.local:8222"
  })
}

# Allow ECS execution role to read NATS secret
resource "aws_iam_role_policy" "ecs_execution_nats_secrets" {
  name = "${local.name_prefix}-ecs-execution-nats-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.nats.arn,
          aws_secretsmanager_secret.nats_tls_ca.arn,
          aws_secretsmanager_secret.nats_tls_cert.arn,
          aws_secretsmanager_secret.nats_tls_key.arn
        ]
      }
    ]
  })
}
