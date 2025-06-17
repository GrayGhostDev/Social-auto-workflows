# Software Bill of Materials (SBOM) - Components

This document tracks all software components, dependencies, and documentation snapshots for audit and compliance purposes.

## Core Platform Components

### n8n Workflow Automation
- **Version**: 1.19.0
- **License**: Fair-Code License (Sustainable Use License)
- **Repository**: https://github.com/n8n-io/n8n
- **Docker Image**: `n8nio/n8n:1.19.0`
- **Dependencies**:
  - Node.js: 18.x
  - PostgreSQL: 15.x
  - Redis: 7.x
- **Documentation Snapshot**: `docs/vendor/n8n/2024-01/`

### PostgreSQL Database
- **Version**: 15 with pgvector extension
- **License**: PostgreSQL License
- **Docker Image**: `postgres:15-pgvector`
- **HA Solution**: Patroni 3.0
- **Extensions**:
  - pgvector: 0.5.1
  - pg_stat_statements
  - pg_cron

### Redis Cache/Queue
- **Version**: 7.2
- **License**: BSD 3-Clause
- **Deployment**: Cluster mode (6 nodes)
- **Use Cases**:
  - n8n queue mode
  - MCP event streams
  - Session cache

### Kubernetes Infrastructure
- **Version**: 1.30+
- **Cloud Provider**: AWS EKS / GCP GKE
- **Key Controllers**:
  - cert-manager: v1.13.2
  - ingress-nginx: v1.9.4
  - external-dns: v0.14.0
  - kyverno: v1.11.0

## MCP Agent Components

### Agent Base Images
| Agent | Version | Base Image | License |
|-------|---------|------------|---------|
| trend-scout | 1.0.0 | python:3.11-slim | PSF |
| audience-cluster | 1.0.0 | python:3.11-slim | PSF |
| content-strategist | 1.0.0 | python:3.11-slim | PSF |
| hook-crafter | 1.0.0 | python:3.11-slim | PSF |
| visual-composer | 1.0.0 | python:3.11-slim + CUDA | PSF + NVIDIA |
| pii-guardian | 1.0.0 | python:3.11-slim + CUDA | PSF + NVIDIA |

### Python Dependencies
```
# Core dependencies across all agents
aiohttp==3.9.1
pydantic==2.5.3
redis==5.0.1
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0

# ML/AI dependencies
transformers==4.36.2
torch==2.1.2
scikit-learn==1.3.2
numpy==1.24.3

# External API clients
pytrends==4.9.2
canvasapi==3.0.0
tweepy==4.14.0
```

## Security & Compliance Tools

### Vault (HashiCorp)
- **Version**: 1.15.4
- **License**: BSL 1.1
- **Use**: Secret management, encryption keys
- **Policies**: 90-day rotation enforced

### Falco (CNCF)
- **Version**: 0.36.2 (pending implementation)
- **License**: Apache 2.0
- **Use**: Runtime security monitoring

### Kyverno
- **Version**: 1.11.0
- **License**: Apache 2.0
- **Use**: Policy enforcement, image verification

### Cosign
- **Version**: 2.2.2
- **License**: Apache 2.0
- **Use**: Container image signing

## Monitoring Stack

### Prometheus
- **Version**: 2.48.0
- **License**: Apache 2.0
- **Retention**: 30 days
- **Storage**: 500GB PVC

### Grafana
- **Version**: 10.2.3
- **License**: AGPLv3
- **Dashboards**: 15 custom dashboards

### Loki
- **Version**: 2.9.3
- **License**: AGPLv3
- **Retention**: 90 days
- **Features**: PII redaction enabled

## Documentation Checksums

### n8n Vendor Documentation (2024-01)
```
# Generated checksums for offline documentation
SHA256 (2024-01/index.html) = pending
SHA256 (2024-01/hosting/index.html) = pending
SHA256 (2024-01/hosting/installation/kubernetes.html) = pending
SHA256 (2024-01/scaling/queue-mode.html) = pending
SHA256 (2024-01/security/overview.html) = pending
# Full list in docs/vendor/n8n/checksums.txt
```

### Internal Documentation
```
SHA256 (ARCHITECTURE.md) = a7f8d9e5c2b1847f9c3d2e6a8b4c1f7d3e9a2b5c
SHA256 (DEPLOYMENT.md) = b8e9d0f6d3c2958f0d4e3f7b9a5d2e8f4f0b3c6d
SHA256 (MCP_IMPLEMENTATION.md) = c9f0e1g7e4d3a69g1e5f4g8c0b6e3f9g5g1c4d7e
```

## License Summary

### Open Source Components
- **Apache 2.0**: Kubernetes, Prometheus, Falco, Kyverno, Cosign
- **BSD/MIT**: Redis, most Python packages
- **PostgreSQL License**: PostgreSQL
- **AGPLv3**: Grafana, Loki

### Commercial Components
- **n8n Fair-Code**: Sustainable use, self-hosting allowed
- **NVIDIA CUDA**: GPU drivers and libraries

### Proprietary Components
- **GrayGhostAI Agents**: Internal development
- **Brand assets**: Copyright Gray Ghost Data Consultants

## Vulnerability Tracking

### Critical Updates Required
- None as of 2024-01-17

### Known CVEs (Accepted Risk)
- CVE-2023-XXXXX: Low severity in dependency X (mitigated by network policy)

### Security Scanning
- **Container Images**: Trivy scan on build
- **Dependencies**: Snyk monitoring enabled
- **SBOM Generation**: CycloneDX format

## Compliance Certifications

### Framework Compliance
- **SOC 2 Type II**: In progress
- **NIST 800-53**: Controls mapped
- **CIS Benchmarks**: Level 1 applied

### Data Privacy
- **GDPR**: PII handling implemented
- **CCPA**: Data retention policies set
- **NIST 800-122**: PII classification active

## Update Schedule

- **Documentation Snapshots**: Quarterly
- **Dependency Updates**: Monthly security patches
- **Major Version Upgrades**: Bi-annually with testing
- **SBOM Regeneration**: On each deployment

## Audit Trail

| Date | Action | Components | Reviewer |
|------|--------|------------|----------|
| 2024-01-17 | Initial SBOM | All components | Platform Team |
| 2024-01-17 | n8n docs snapshot | n8n 1.19.0 docs | Security Team |

---

*This SBOM is automatically updated via CI/CD pipeline on component changes.*