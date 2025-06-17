# Service Level Objectives (SLO) & Indicators (SLI)

## Overview

This document defines the Service Level Objectives and Indicators for the GrayGhost AI platform, establishing measurable targets for reliability, performance, and quality.

## Service Level Indicators (SLIs)

### 1. Availability SLI
**Definition**: The percentage of time the n8n API responds successfully to health checks
**Measurement**: `(successful_health_checks / total_health_checks) * 100`
**Query**: 
```promql
sum(rate(http_requests_total{endpoint="/healthz",status="200"}[5m])) /
sum(rate(http_requests_total{endpoint="/healthz"}[5m]))
```

### 2. Latency SLI
**Definition**: The 95th percentile response time for workflow executions
**Measurement**: P95 latency in seconds
**Query**:
```promql
histogram_quantile(0.95,
  sum(rate(n8n_workflow_execution_duration_seconds_bucket[5m])) by (le)
)
```

### 3. Error Rate SLI
**Definition**: The percentage of failed workflow executions
**Measurement**: `(failed_executions / total_executions) * 100`
**Query**:
```promql
sum(rate(n8n_workflow_execution_failed_total[5m])) /
sum(rate(n8n_workflow_execution_total[5m]))
```

### 4. Queue Processing SLI
**Definition**: The percentage of queued jobs processed within SLA time
**Measurement**: Jobs processed within 60 seconds
**Query**:
```promql
sum(rate(bullmq_job_completed_duration_seconds_bucket{le="60"}[5m])) /
sum(rate(bullmq_job_completed_duration_seconds_count[5m]))
```

## Service Level Objectives (SLOs)

### Production Environment SLOs

| Objective | Target | Error Budget | Measurement Window |
|-----------|--------|--------------|-------------------|
| **Availability** | 99.9% | 0.1% (43.2 min/month) | 30 days |
| **P95 Latency** | < 2 seconds | 5% of requests | 1 hour |
| **Error Rate** | < 0.5% | 0.5% of requests | 1 hour |
| **Queue Processing** | 95% within 60s | 5% of jobs | 1 hour |
| **PII Compliance** | 100% | 0 violations | Real-time |
| **Brand Compliance** | 99.5% | 0.5% of content | Daily |

### Development/Staging SLOs

| Objective | Target | Error Budget | Measurement Window |
|-----------|--------|--------------|-------------------|
| **Availability** | 99.0% | 1% (7.2 hr/month) | 30 days |
| **P95 Latency** | < 3 seconds | 10% of requests | 1 hour |
| **Error Rate** | < 2% | 2% of requests | 1 hour |

## Error Budget Policy

### Error Budget Calculation
```
Monthly Error Budget (minutes) = (1 - SLO) * 30 * 24 * 60
Current Burn Rate = (Error Minutes Used / Days Elapsed) * 30
```

### Error Budget Actions

1. **Budget > 50%**: Normal operations, feature development continues
2. **Budget 25-50%**: Increased monitoring, review recent changes
3. **Budget 10-25%**: Feature freeze, focus on reliability improvements
4. **Budget < 10%**: Emergency response, all hands on reliability

### Automatic Actions
```yaml
# Prometheus Alert Rules
- alert: ErrorBudgetBurnRateHigh
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[1h])) /
      sum(rate(http_requests_total[1h]))
    ) > 0.01  # 1% burn rate per hour
  for: 5m
  labels:
    severity: warning
    team: platform
  annotations:
    summary: "Error budget burn rate is too high"
    description: "Current burn rate: {{ $value | humanizePercentage }}"

- alert: ErrorBudgetCritical
  expr: |
    error_budget_remaining < 0.1
  for: 5m
  labels:
    severity: critical
    team: platform
    page: true
  annotations:
    summary: "Error budget critically low"
    description: "Only {{ $value | humanizePercentage }} error budget remaining"
```

## SLI/SLO Implementation

### 1. Recording Rules
```yaml
# prometheus-rules.yaml
groups:
- name: slo.rules
  interval: 30s
  rules:
  # Availability SLO
  - record: service_availability_30d
    expr: |
      sum_over_time(up{job="n8n"}[30d]) / count_over_time(up{job="n8n"}[30d])
  
  # Latency SLO compliance
  - record: latency_slo_compliance_1h
    expr: |
      sum(rate(n8n_workflow_execution_duration_seconds_bucket{le="2"}[1h])) /
      sum(rate(n8n_workflow_execution_duration_seconds_count[1h]))
  
  # Error budget remaining
  - record: error_budget_remaining
    expr: |
      1 - (
        (1 - service_availability_30d) / 
        (1 - 0.999)  # 99.9% SLO
      )
```

### 2. Grafana Dashboard

Create dashboard with:
- SLO compliance gauges
- Error budget burn rate graph
- Latency percentile heatmap
- Queue depth and processing time
- PII/Brand compliance indicators

### 3. Alerting Escalation

```yaml
# PagerDuty Integration
- receiver: 'platform-oncall'
  match:
    severity: critical
    slo_violation: true
  continue: true

- receiver: 'platform-team'
  match:
    severity: warning
    slo_violation: true
```

## Reporting

### Weekly SLO Review
- Error budget status
- Top error contributors
- Latency breakdown by workflow
- Capacity planning recommendations

### Monthly Executive Report
- SLO achievement percentage
- Incident count and MTTR
- Error budget consumption trends
- Reliability roadmap progress

## Continuous Improvement

### SLO Refinement Process
1. Quarterly review of SLO targets
2. Analyze user impact vs engineering effort
3. Adjust targets based on:
   - User feedback
   - Business requirements
   - Technical capabilities
   - Cost considerations

### Reliability Investments
When error budget is consistently exceeded:
1. Implement request retries with exponential backoff
2. Add circuit breakers to dependencies
3. Improve caching strategies
4. Enhance monitoring coverage
5. Conduct chaos engineering exercises

## Compliance SLOs

### PII Protection SLO
- **Target**: 100% of PII redacted in logs
- **Measurement**: Automated scanning of log streams
- **Violation Response**: Immediate log purge and incident report

### Brand Compliance SLO
- **Target**: 99.5% brand-compliant content
- **Measurement**: Automated color/font validation
- **Violation Response**: Content quarantine and manual review

## References

- [Google SRE Book - SLO Chapter](https://sre.google/sre-book/service-level-objectives/)
- [The Site Reliability Workbook](https://sre.google/workbook/implementing-slos/)
- [NIST SP 800-61r2](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)