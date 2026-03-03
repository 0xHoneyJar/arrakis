# =============================================================================
# DNS Root — Dynamic Auth Proxy Records
# INC-001: auth.0xhoneyjar.xyz unreachable after Gandi → Route 53 migration
# https://github.com/0xHoneyJar/mibera-dimensions/issues/162
# =============================================================================
#
# Dynamic's custom auth proxy enables cross-subdomain SSO via HttpOnly cookies
# on .0xhoneyjar.xyz. All apps (midi, mibera, cubquests, henlo, hub) depend on
# this subdomain for wallet connection and session management.
#
# This is NOT a Vercel project — it won't appear in `vercel domains inspect`.
# The wildcard *.0xhoneyjar.xyz → Vercel CNAME must NOT catch this subdomain.

# Dynamic custom auth proxy — cross-subdomain SSO
resource "aws_route53_record" "auth_dynamic" {
  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = "auth.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = ["alias.app.dynamicauth.com"]
}

# Dynamic TLS cert verification for auth subdomain
resource "aws_route53_record" "auth_dynamic_acme" {
  zone_id = aws_route53_zone.honeyjar.zone_id
  name    = "_acme-challenge.auth.${var.domain}"
  type    = "TXT"
  ttl     = 300
  records = ["zWaEYtZC4NyMRWZ7t9SntGNA6wagem2nufIlwwPyYWI"]
}
