# Data Processing Agreement (DPA) Template
## Sietch Unified - GDPR Compliance

**Version:** 1.0  
**Last Updated:** December 2024  
**Jurisdiction:** European Union (GDPR)

---

## 1. PARTIES

This Data Processing Agreement ("Agreement") is entered into between:

**Data Controller:**
- Name: [COMMUNITY_NAME]
- Represented by: [ADMIN_NAME]
- Contact: [ADMIN_EMAIL]
- Discord Server ID: [DISCORD_GUILD_ID]
- Telegram Group ID: [TELEGRAM_CHAT_ID]

**Data Processor:**
- Name: Sietch Unified (operated by [YOUR_COMPANY])
- Contact: [YOUR_EMAIL]
- DPO Contact: [DPO_EMAIL]

---

## 2. DEFINITIONS

| Term | Definition |
|------|------------|
| **Personal Data** | Any information relating to an identified or identifiable natural person |
| **Processing** | Any operation performed on Personal Data |
| **Data Subject** | The individual whose Personal Data is processed |
| **Sub-processor** | Third parties authorized to process data on behalf of the Processor |
| **Supervisory Authority** | Independent public authority responsible for GDPR enforcement |

---

## 3. SUBJECT MATTER AND DURATION

### 3.1 Subject Matter
The Processor shall process Personal Data on behalf of the Controller for the purpose of providing the Sietch Unified community management service, including:
- Identity verification via wallet signatures
- Cross-platform account linking (Discord ↔ Telegram)
- Conviction scoring and tier assignment
- Member directory services
- Subscription billing management

### 3.2 Duration
This Agreement remains in effect for the duration of the service subscription plus any retention period required by law.

---

## 4. NATURE AND PURPOSE OF PROCESSING

### 4.1 Categories of Data Subjects
- Community members who verify their wallets
- Community administrators

### 4.2 Types of Personal Data

| Category | Data Elements | Lawful Basis |
|----------|--------------|--------------|
| Identity | Discord UID, Telegram UID | Contract performance |
| Contact | Platform usernames | Contract performance |
| Financial | Wallet addresses (pseudonymous) | Contract performance |
| Behavioral | Engagement scores, activity logs | Legitimate interest |
| Technical | Verification timestamps | Contract performance |

### 4.3 Processing Operations
- Collection via platform APIs
- Storage in regional databases
- Analysis for conviction scoring
- Transmission for role synchronization
- Deletion upon request

---

## 5. OBLIGATIONS OF THE PROCESSOR

### 5.1 Confidentiality
The Processor shall ensure that persons authorized to process Personal Data:
- Have committed to confidentiality
- Process data only on documented instructions from the Controller

### 5.2 Security Measures
The Processor implements:

| Measure | Implementation |
|---------|---------------|
| Encryption at rest | AES-256-GCM (Cloud SQL) |
| Encryption in transit | TLS 1.3 |
| Access controls | Role-based, API key authentication |
| Audit logging | All PII access logged |
| Backup | Daily automated backups |
| Disaster recovery | Multi-zone replication |

### 5.3 Sub-processors
The Processor uses the following sub-processors:

| Sub-processor | Purpose | Location | Safeguards |
|--------------|---------|----------|------------|
| Google Cloud Platform | Infrastructure hosting | Per data_region | Standard Contractual Clauses |
| Stripe, Inc. | Payment processing | US | EU-US DPF certified |
| Collab.Land | Identity verification | US | Standard Contractual Clauses |
| Dune Analytics | On-chain data queries | US | Public data only |

The Controller consents to the engagement of these sub-processors.

### 5.4 Data Subject Rights
The Processor shall assist the Controller in responding to requests from Data Subjects exercising their rights under GDPR Articles 15-22:

- **Article 15 (Access)**: Export endpoint at `/api/gdpr/export`
- **Article 16 (Rectification)**: Profile update at `/api/profile/*`
- **Article 17 (Erasure)**: Deletion endpoint at `/api/gdpr/delete`
- **Article 20 (Portability)**: JSON export at `/api/gdpr/export?format=portable`
- **Article 21 (Object)**: Opt-out endpoint at `/api/gdpr/opt-out`

### 5.5 Data Breach Notification
In the event of a Personal Data breach, the Processor shall:
1. Notify the Controller without undue delay (within 24 hours)
2. Provide details of the breach, data affected, and remediation steps
3. Assist the Controller in notifying the Supervisory Authority (within 72 hours)
4. Assist in notifying affected Data Subjects if required

---

## 6. OBLIGATIONS OF THE CONTROLLER

The Controller shall:
1. Ensure lawful basis exists for processing
2. Provide Data Subjects with required privacy notices
3. Respond to Data Subject requests within 30 days
4. Notify the Processor of any restrictions on processing
5. Ensure compliance with applicable data protection laws

---

## 7. DATA TRANSFERS

### 7.1 Data Residency
Personal Data is stored in the region selected during community setup:

| Region Code | GCP Region | Jurisdiction |
|-------------|-----------|--------------|
| `eu` | europe-west1 (Belgium) | GDPR |
| `us` | us-central1 (Iowa) | US law |
| `asia` | asia-southeast1 (Singapore) | Singapore PDPA |

### 7.2 International Transfers
For transfers outside the EEA:
- Standard Contractual Clauses (SCCs) are in place with sub-processors
- EU-US Data Privacy Framework certification where applicable
- Transfer Impact Assessments conducted annually

---

## 8. AUDIT RIGHTS

### 8.1 Controller Audits
The Controller may:
- Request documentation of security measures
- Review audit logs (own community data only)
- Request third-party audit reports (SOC 2, ISO 27001)

### 8.2 Audit Frequency
- Self-service audit: Anytime via admin dashboard
- Documentation request: Once per year
- On-site audit: With 30 days notice (Enterprise tier only)

---

## 9. DATA DELETION

### 9.1 Upon Termination
Upon termination of the service agreement:
1. Controller data exported within 30 days upon request
2. Personal Data deleted within 90 days
3. Anonymized analytics data may be retained
4. Audit logs retained per legal requirements (5 years)

### 9.2 Data Subject Deletion
Individual deletion requests processed within 30 days via `/api/gdpr/delete`.

---

## 10. LIABILITY

### 10.1 Processor Liability
The Processor is liable for damages caused by processing that:
- Violates GDPR obligations specific to processors
- Acts outside or contrary to lawful Controller instructions

### 10.2 Limitation
Liability is limited to the fees paid by the Controller in the 12 months preceding the claim, except for willful misconduct or gross negligence.

---

## 11. GOVERNING LAW

This Agreement is governed by the laws of the European Union and the Member State of the Controller's establishment.

---

## 12. SIGNATURES

**For the Controller:**

Name: _______________________

Title: _______________________

Signature: _______________________

Date: _______________________


**For the Processor:**

Name: _______________________

Title: _______________________

Signature: _______________________

Date: _______________________

---

## ANNEX A: TECHNICAL AND ORGANIZATIONAL MEASURES

### A.1 Access Control
- [ ] API key authentication for all endpoints
- [ ] Role-based access control (RBAC)
- [ ] Multi-factor authentication for admin access
- [ ] Automatic session timeout

### A.2 Data Encryption
- [ ] TLS 1.3 for all communications
- [ ] AES-256-GCM for data at rest
- [ ] Google Cloud KMS for key management
- [ ] Encrypted backups

### A.3 Data Minimization
- [ ] No IP address storage
- [ ] No browser fingerprinting
- [ ] Pseudonymous identifiers where possible
- [ ] 30-day retention for behavioral data

### A.4 Incident Response
- [ ] 24/7 monitoring
- [ ] Automated alerting
- [ ] Incident response playbook
- [ ] Annual tabletop exercises

### A.5 Personnel Security
- [ ] Background checks for personnel with data access
- [ ] Confidentiality agreements
- [ ] Security awareness training
- [ ] Access revocation upon termination

---

## ANNEX B: SUB-PROCESSOR LIST

| Name | Service | Data Processed | Location | DPA Link |
|------|---------|---------------|----------|----------|
| Google Cloud Platform | Hosting | All | Regional | [Link](https://cloud.google.com/terms/data-processing-addendum) |
| Stripe | Payments | Payment data | US (EU SCCs) | [Link](https://stripe.com/legal/dpa) |
| Collab.Land | Identity | Platform IDs, wallets | US | On request |
| Dune Analytics | Analytics | Wallet addresses (public) | US | N/A (public data) |

---

*This template is provided for informational purposes. Consult legal counsel before use.*
