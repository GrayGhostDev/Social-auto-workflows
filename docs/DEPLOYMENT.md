# GrayGhost AI Platform - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the GrayGhost AI platform across development, staging, and production environments.

## Prerequisites

### Tools Required
- Kubernetes 1.30+
- Helm 3.12+
- Terraform 1.5+
- kubectl configured
- AWS CLI (for AWS deployments)
- git

### Access Requirements
- Kubernetes cluster access
- Cloud provider credentials
- Container registry access
- Vault access for secrets

## Pre-Deployment Checklist

- [ ] All container images built and pushed to registry
- [ ] Secrets configured in Vault
- [ ] DNS records prepared
- [ ] SSL certificates ready
- [ ] WAF rules reviewed
- [ ] Monitoring stack deployed

## Deployment Steps

### 1. Infrastructure Setup

#### Deploy WAF (AWS)

```bash
cd infra/terraform/environments/production

terraform init
terraform plan -var-file=production.tfvars
terraform apply -var-file=production.tfvars
```

#### Verify WAF Deployment

```bash
aws wafv2 list-web-acls --scope REGIONAL --region us-east-1
```

### 2. Kubernetes Namespace Setup

```bash
# Create namespace and resource limits
kubectl apply -f infra/k8s/base/namespace.yaml

# Verify namespace
kubectl get namespace grayghost-ai
kubectl describe resourcequota -n grayghost-ai
```

### 3. Deploy Core Components

#### PostgreSQL HA Cluster

```bash
# Install CloudNativePG operator if not present
kubectl apply -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.22/releases/cnpg-1.22.0.yaml

# Deploy PostgreSQL cluster
kubectl apply -f infra/k8s/base/postgres-ha.yaml

# Wait for cluster to be ready
kubectl wait --for=condition=Ready cluster/postgres-cluster -n grayghost-ai --timeout=600s

# Verify cluster status
kubectl get cluster -n grayghost-ai
kubectl get pods -n grayghost-ai -l cnpg.io/cluster=postgres-cluster
```

#### Redis Cluster

```bash
# Deploy Redis cluster
kubectl apply -f infra/k8s/base/redis-cluster.yaml

# Wait for all Redis pods to be ready
kubectl wait --for=condition=Ready pod -l app=redis-cluster -n grayghost-ai --timeout=300s

# Initialize Redis cluster (run once)
kubectl apply -f infra/k8s/base/redis-cluster.yaml | grep Job
```

#### HashiCorp Vault Integration

```bash
# Install Vault injector
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "injector.enabled=true" \
  --set "server.enabled=false"

# Configure Kubernetes auth
kubectl exec -n vault vault-0 -- vault auth enable kubernetes
kubectl exec -n vault vault-0 -- vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
```

### 4. Deploy n8n Workflow Engine

```bash
# Create secrets
kubectl create secret generic n8n-secrets \
  --from-literal=encryption-key=$(openssl rand -base64 32) \
  -n grayghost-ai

# Deploy n8n
kubectl apply -f infra/k8s/base/n8n-deployment.yaml

# Verify deployment
kubectl rollout status deployment/n8n -n grayghost-ai
kubectl get pods -n grayghost-ai -l app=n8n
```

### 5. Deploy Shared Services

```bash
# Create service secrets
kubectl create secret generic canva-credentials \
  --from-literal=api-key=$CANVA_API_KEY \
  -n grayghost-ai

kubectl create secret generic brandwatch-credentials \
  --from-literal=webhook-secret=$BRANDWATCH_WEBHOOK_SECRET \
  -n grayghost-ai

# Deploy all shared services
kubectl apply -f infra/k8s/base/shared-services.yaml

# Verify services
kubectl get deployments -n grayghost-ai -l component=shared-service
kubectl get services -n grayghost-ai
```

### 6. Configure Ingress and TLS

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.config.use-forwarded-headers="true" \
  --set controller.config.compute-full-forwarded-for="true"

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@grayghost.ai
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Deploy ingress rules
kubectl apply -f infra/k8s/base/ingress.yaml
```

### 7. Deploy Monitoring Stack

```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values infra/helm/monitoring/prometheus-values.yaml

# Deploy Loki
kubectl apply -f infra/k8s/base/monitoring/loki-config.yaml

# Deploy Grafana dashboards
kubectl apply -f infra/k8s/base/monitoring/grafana-dashboards.yaml

# Get Grafana admin password
kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
```

### 8. Post-Deployment Verification

#### Health Checks

```bash
# Check all pods are running
kubectl get pods -n grayghost-ai

# Check services
kubectl get svc -n grayghost-ai

# Check ingress
kubectl get ingress -n grayghost-ai

# Test endpoints
curl -I https://n8n.grayghost.ai/health
curl -I https://api.grayghost.ai/canva/health
curl -I https://api.grayghost.ai/trends/health
```

#### Monitoring Verification

```bash
# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open browser to http://localhost:3000
# Login with admin / <password from above>
```

### 9. Configure OAuth2 Authentication

```bash
# Create OAuth2 proxy secrets
kubectl create secret generic oauth2-proxy-secrets \
  --from-literal=client-id=$OAUTH_CLIENT_ID \
  --from-literal=client-secret=$OAUTH_CLIENT_SECRET \
  --from-literal=cookie-secret=$(openssl rand -base64 32) \
  -n grayghost-ai

# Update authorized emails
kubectl edit configmap oauth2-proxy-config -n grayghost-ai
```

## Environment-Specific Configurations

### Development

```bash
# Use development overlay
kubectl apply -k infra/k8s/overlays/dev

# Reduced replicas and resources
# No autoscaling
# Relaxed security policies
```

### Staging

```bash
# Use staging overlay
kubectl apply -k infra/k8s/overlays/staging

# Production-like configuration
# Full monitoring enabled
# Security scanning active
```

### Production

```bash
# Use production overlay
kubectl apply -k infra/k8s/overlays/production

# Full HA configuration
# Autoscaling enabled
# Strict security policies
# Backup jobs active
```

## Rollback Procedures

### Application Rollback

```bash
# Check deployment history
kubectl rollout history deployment/n8n -n grayghost-ai

# Rollback to previous version
kubectl rollout undo deployment/n8n -n grayghost-ai

# Rollback to specific revision
kubectl rollout undo deployment/n8n -n grayghost-ai --to-revision=2
```

### Database Rollback

```bash
# Restore from backup
kubectl exec -n grayghost-ai postgres-cluster-1 -- \
  pgbackrest --stanza=main --type=time "--target=2024-01-15 10:00:00" restore
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n grayghost-ai

# Check logs
kubectl logs <pod-name> -n grayghost-ai -c <container-name>

# Check resource constraints
kubectl top pods -n grayghost-ai
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -n grayghost-ai -- \
  psql -h postgres-primary -U n8n -d n8n -c "SELECT 1"
```

#### Ingress Not Working

```bash
# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check certificate status
kubectl get certificates -n grayghost-ai
kubectl describe certificate grayghost-ai-tls -n grayghost-ai
```

### Debug Commands

```bash
# Get all resources in namespace
kubectl get all -n grayghost-ai

# Check recent events
kubectl get events -n grayghost-ai --sort-by='.lastTimestamp'

# Access container shell
kubectl exec -it <pod-name> -n grayghost-ai -- /bin/sh

# Port forward for local debugging
kubectl port-forward -n grayghost-ai svc/n8n 5678:80
```

## Maintenance

### Regular Tasks

- **Daily**: Check monitoring dashboards, review alerts
- **Weekly**: Review resource usage, check for updates
- **Monthly**: Security patches, certificate renewal check
- **Quarterly**: Disaster recovery drill, access review

### Scaling Operations

```bash
# Manual scaling
kubectl scale deployment/n8n --replicas=5 -n grayghost-ai

# Enable autoscaling
kubectl autoscale deployment/n8n --min=3 --max=10 --cpu-percent=70 -n grayghost-ai
```

## Security Considerations

1. **Never expose services directly** - Always use ingress with WAF
2. **Rotate secrets regularly** - Use Vault for automatic rotation
3. **Monitor security alerts** - Check WAF and security dashboards
4. **Apply patches promptly** - Follow security advisories
5. **Review access logs** - Check for unauthorized access attempts

## Support

For issues or questions:
- Check monitoring dashboards first
- Review application logs
- Contact platform team: platform@grayghost.ai
- Emergency: Use PagerDuty escalation