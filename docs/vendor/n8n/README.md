# n8n Vendor Documentation

This directory contains offline copies of critical n8n documentation for engineering, security review, and audit purposes.

## Documentation Structure

```
docs/vendor/n8n/
├── README.md                     # This file
├── PULL_MANIFEST.md             # Documentation pull list
├── 2024-01/                     # Snapshot by date
│   ├── hosting/                 # Installation & configuration
│   ├── scaling/                 # Queue mode & scaling
│   ├── security/                # Privacy & compliance
│   ├── operations/              # Maintenance & monitoring
│   └── developer/               # API & custom nodes
├── scripts/
│   └── pull-n8n-docs.sh        # Automated pull script
└── checksums.txt               # SHA256 hashes for audit
```

## Documentation Categories

### 1. Hosting & Installation ("Day-0 build")
- Choose your n8n (cloud vs self-host)
- Docker Compose examples
- Kubernetes Helm charts
- Configuration methods & precedence
- Environment variables reference

### 2. Scaling & Queue Mode ("Day-1 growth")
- Scaling overview & decision tree
- Queue mode architecture
- Redis requirements
- Binary data handling
- Task runners configuration

### 3. Security, Privacy & Compliance ("Shift-left controls")
- Privacy & security overview
- Securing n8n deployment
- Hardening recommendations
- Telemetry opt-out
- Vulnerability reporting

### 4. Operations & Maintenance ("Run-book inputs")
- Execution data & pruning
- Monitoring & logging endpoints
- Backup & restore procedures
- Troubleshooting guide

### 5. Developer Reference ("Low-code meets GitOps")
- Node & credential development
- CLI commands & import/export
- REST API reference
- Custom connector guides

## Usage

1. **Initial Pull**: Run `./scripts/pull-n8n-docs.sh` to download all documentation
2. **Updates**: Re-run quarterly or before major upgrades
3. **Verification**: Check `checksums.txt` for integrity
4. **Search**: Use `grep -r "search term" .` for offline searching

## Version Tracking

Each snapshot is stored in a `YYYY-MM` directory to track documentation changes across n8n versions.

Current snapshots:
- `2024-01/` - n8n v1.19.0 documentation (initial pull)

## Compliance Notes

- All documentation is pulled from official n8n sources
- No modifications are made to content
- Timestamps and versions are preserved
- Changes between versions are tracked via git diff