# =============================================================================
# DNS Root — Email Records (Google Workspace)
# Cycle 046: Armitage Platform — Sprint 3
# SDD §7.4: dns/honeyjar-xyz-email.tf
# =============================================================================

# MX records — Google Workspace
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = var.domain
  type    = "MX"
  ttl     = 3600

  records = [for mx in var.google_workspace_mx : "${mx.priority} ${mx.value}"]
}

# Apex TXT records — SPF + domain verification tokens
# Route 53 requires all TXT records for a name in a single record set.
# The Gandi SPF includes _mailcust.gandi.net which is Gandi's relay;
# after NS cutover Gandi no longer relays, so we drop that include.
resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 3600
  records = [
    "v=spf1 include:_spf.google.com ~all",
    "google-site-verification=Le1FtsBR0ydAKuaq1OM7cNSDymc61AWDBpKsPlaKkpE",
    "1password-site-verification=UVX2GYFY6BEWBO4OIYWSJG2LKU"
  ]
}

# DKIM (Google Workspace)
resource "aws_route53_record" "dkim" {
  count = var.dkim_key != "" ? 1 : 0

  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = "google._domainkey.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = [var.dkim_key]
}

# DMARC (FIXED — replaces broken Gandi placeholder)
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=quarantine; rua=mailto:${var.dmarc_email}; ruf=mailto:${var.dmarc_email}; fo=1"]
}
