# GrayGhostAI Platform Architecture Diagram

## System Architecture Overview

```mermaid
graph TB
    subgraph "Internet"
        User[User/Client]
        BW[Brandwatch]
    end

    subgraph "Edge Layer"
        LB[Load Balancer<br/>AWS ALB/GCP LB<br/>TLS 1.3]
        WAF[Web Application Firewall<br/>20MB Upload Limit<br/>Geo-fencing]
        Auth[Auth Gateway<br/>Azure AD/Okta<br/>OAuth2 + JWT]
    end

    subgraph "Kubernetes Cluster"
        subgraph "Core Services"
            N8N1[n8n Pod 1<br/>2 vCPU/2GB]
            N8N2[n8n Pod 2<br/>2 vCPU/2GB]
            N8N3[n8n Pod 3<br/>2 vCPU/2GB]
        end

        subgraph "Data Layer"
            PG[(PostgreSQL HA<br/>Primary + 2 Replicas)]
            REDIS[(Redis Cluster<br/>Queue Management)]
            VAULT[HashiCorp Vault<br/>Sidecar]
        end

        subgraph "Shared Services"
            CANVA[Canv-a-tor<br/>Brand Controls]
            TREND[Trend Miner<br/>FastAPI]
            BWRCV[Brandwatch<br/>Receiver]
        end

        subgraph "Storage"
            TMPFS[tmpfs<br/>Temp Storage]
        end
    end

    subgraph "Observability"
        PROM[Prometheus<br/>Metrics]
        GRAF[Grafana<br/>Dashboards]
        LOKI[Loki<br/>Logs + PII Redaction]
        SENTRY[Sentry<br/>Error Tracking]
    end

    User -->|HTTPS| LB
    BW -->|Webhook| LB
    LB --> WAF
    WAF --> Auth
    Auth --> N8N1
    Auth --> N8N2
    Auth --> N8N3
    
    N8N1 --> PG
    N8N2 --> PG
    N8N3 --> PG
    N8N1 --> REDIS
    N8N2 --> REDIS
    N8N3 --> REDIS
    
    N8N1 -.->|gRPC| CANVA
    N8N2 -.->|gRPC| TREND
    N8N3 -.->|gRPC| BWRCV
    
    N8N1 --> TMPFS
    N8N2 --> TMPFS
    N8N3 --> TMPFS
    
    VAULT -.->|Secrets| N8N1
    VAULT -.->|Secrets| N8N2
    VAULT -.->|Secrets| N8N3
    
    N8N1 --> PROM
    N8N2 --> PROM
    N8N3 --> PROM
    CANVA --> PROM
    TREND --> PROM
    BWRCV --> PROM
    
    N8N1 --> LOKI
    N8N2 --> LOKI
    N8N3 --> LOKI
    
    N8N1 --> SENTRY
    N8N2 --> SENTRY
    N8N3 --> SENTRY
    
    PROM --> GRAF
    LOKI --> GRAF

    classDef edge fill:#f9f,stroke:#333,stroke-width:2px
    classDef k8s fill:#326de6,color:#fff,stroke:#333,stroke-width:2px
    classDef data fill:#ff6b6b,color:#fff,stroke:#333,stroke-width:2px
    classDef obs fill:#4ecdc4,color:#fff,stroke:#333,stroke-width:2px
    classDef service fill:#95e1d3,stroke:#333,stroke-width:2px
    
    class LB,WAF,Auth edge
    class N8N1,N8N2,N8N3,CANVA,TREND,BWRCV k8s
    class PG,REDIS,VAULT,TMPFS data
    class PROM,GRAF,LOKI,SENTRY obs
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant WAF
    participant Auth
    participant n8n
    participant Canva as Canv-a-tor
    participant DB as PostgreSQL
    participant Vault
    participant Loki

    User->>WAF: HTTPS Request
    WAF->>WAF: Check Rules<br/>(Size, Geo)
    WAF->>Auth: Forward Request
    Auth->>Auth: Validate JWT<br/>(60min expiry)
    Auth->>Auth: Check 2FA
    Auth->>n8n: Authorized Request
    
    n8n->>Vault: Get Secrets
    Vault-->>n8n: Inject Secrets
    
    n8n->>DB: Query Workflows
    DB-->>n8n: Return Data
    
    n8n->>Canva: Create Content<br/>(gRPC)
    Canva->>Canva: Validate Brand Colors
    Canva-->>n8n: Generated Content
    
    n8n->>Loki: Send Logs
    Loki->>Loki: PII Redaction
    Loki-->>Loki: Store with execution_id
```

## Security Architecture

```mermaid
graph LR
    subgraph "Security Layers"
        subgraph "Layer 1: Edge"
            WAF1[WAF Rules]
            GEO[Geo-fencing]
            DDoS[DDoS Protection]
            TLS[TLS 1.3]
        end
        
        subgraph "Layer 2: Auth"
            OAuth[OAuth2]
            JWT[JWT Tokens]
            MFA[2FA Enforcement]
            RBAC[Role-Based Access]
        end
        
        subgraph "Layer 3: Runtime"
            SCAN[Image Scanning]
            POL[Network Policies]
            SEC[Security Policies]
            TMPFS1[tmpfs Cleanup]
        end
        
        subgraph "Layer 4: Data"
            ENC[Encryption at Rest]
            TRANS[Encryption in Transit]
            PII[PII Redaction]
            AUDIT[Audit Logging]
        end
    end
    
    WAF1 --> OAuth
    OAuth --> SCAN
    SCAN --> ENC
```

## Brand Control Flow

```mermaid
graph TD
    subgraph "Brand Control System"
        ENV[Environment Variables<br/>Brand Colors]
        CANVA1[Canv-a-tor Service]
        VAL[Color Validator]
        REJ[Reject Invalid]
        ACC[Accept & Process]
        OUT[Brand-Compliant Output]
    end
    
    ENV -->|Load on Startup| CANVA1
    CANVA1 -->|Check Request| VAL
    VAL -->|Invalid Color| REJ
    VAL -->|Valid Color| ACC
    ACC --> OUT
    
    style ENV fill:#ff6b6b,color:#fff
    style REJ fill:#e74c3c,color:#fff
    style OUT fill:#27ae60,color:#fff
```

## Monitoring & Alerting Flow

```mermaid
graph LR
    subgraph "Metrics Collection"
        APP[Applications]
        K8S[Kubernetes]
        INFRA[Infrastructure]
    end
    
    subgraph "Processing"
        PROM1[Prometheus<br/>15s scrape]
        LOKI1[Loki<br/>Log Aggregation]
        ALERT[Alert Manager]
    end
    
    subgraph "Visualization"
        GRAF1[Grafana<br/>Dashboards]
        SLACK[Slack]
        PD[PagerDuty]
    end
    
    APP --> PROM1
    K8S --> PROM1
    INFRA --> PROM1
    
    APP --> LOKI1
    K8S --> LOKI1
    
    PROM1 --> ALERT
    ALERT -->|P95 > 2s| SLACK
    ALERT -->|Critical| PD
    
    PROM1 --> GRAF1
    LOKI1 --> GRAF1
    
    style ALERT fill:#e74c3c,color:#fff
```

## Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: Failure Threshold (5)
    Open --> HalfOpen: Reset Timeout (5s)
    HalfOpen --> Closed: Success
    HalfOpen --> Open: Failure
    
    state Closed {
        [*] --> Monitoring
        Monitoring --> Monitoring: Success
        Monitoring --> CountingFailures: Failure
        CountingFailures --> Monitoring: < Threshold
    }
    
    state Open {
        [*] --> Rejecting
        Rejecting --> Fallback: All Requests
    }
    
    state HalfOpen {
        [*] --> Testing
        Testing --> Testing: Limited Requests
    }
```