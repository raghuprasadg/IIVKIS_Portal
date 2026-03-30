# IIVKIS Phase 11 Validation Report

**Document ID:** IIVKIS-PHASE11-VAL  
**Version:** 1.0.0  
**Status:** PASS — 53/53 checks  
**Phase:** STEP 11 — Cloud + On-Prem Deployment  
**Date:** 2026-03-30

---

## Summary

Phase 11 delivers a complete DevOps deployment layer for IIVKIS supporting
**both Cloud (AWS EKS) and On-Premises (K3s)** modes. All 53 static-validation
checks pass.

```
npm run validate:phase11  →  53/53 PASS ✅
```

---

## What Was Delivered

### 1. Terraform — Cloud Infrastructure (`infra/terraform/`)

| File | Purpose |
|---|---|
| `main.tf` | Root module: VPC + EKS + RDS + ElastiCache + IAM |
| `variables.tf` | Input variables with validation constraints |
| `modules/vpc/main.tf` | Multi-AZ VPC, public/private subnets, NAT GW, EKS tags |
| `modules/eks/main.tf` | EKS managed cluster, node group, OIDC/IRSA |
| `modules/rds/main.tf` | RDS PostgreSQL (Multi-AZ in prod, encrypted) |
| `modules/elasticache/main.tf` | Redis replication group (encrypted in transit + at rest) |
| `environments/prod.tfvars` | Production sizing (m5.xlarge nodes, r6g.large RDS/Redis) |
| `environments/staging.tfvars` | Staging sizing (m5.large nodes, t3.large RDS/Redis) |

**Cloud deployment command:**
```bash
cd infra/terraform
terraform init
terraform workspace new prod
terraform apply -var-file=environments/prod.tfvars
```

### 2. Helm Chart — Kubernetes Deployment (`infra/helm/iivkis/`)

| File | Purpose |
|---|---|
| `Chart.yaml` | Chart metadata + bitnami postgresql/redis dependencies |
| `values.yaml` | Default values (replicas, images, services, ingress, resources) |
| `values-cloud.yaml` | Cloud override: ECR images, ExternalSecrets, IRSA, HPA |
| `values-k3s.yaml` | K3s override: local-path storage, single replicas, no PDB |
| `templates/_helpers.tpl` | Helm helper functions (fullname, labels, selectorLabels) |
| `templates/api.yaml` | API Deployment + Service (liveness/readiness probes) |
| `templates/orchestrator.yaml` | Orchestrator Deployment + Service |
| `templates/portal.yaml` | Portal Deployment + Service |
| `templates/ingress.yaml` | Conditional Ingress (nginx, TLS) |
| `templates/rbac.yaml` | ServiceAccount, NetworkPolicy, PodDisruptionBudget |

**Cloud deployment command:**
```bash
helm upgrade --install iivkis infra/helm/iivkis \
  --namespace iivkis --create-namespace \
  --values infra/helm/iivkis/values.yaml \
  --values infra/helm/iivkis/values-cloud.yaml \
  --wait
```

### 3. K3s — On-Premises Deployment (`infra/k3s/`)

| File | Purpose |
|---|---|
| `install.sh` | Installs K3s, ingress-nginx, deploys IIVKIS via Helm |
| `namespace.yaml` | iivkis namespace + local-path PVC example |

**On-prem deployment command:**
```bash
# Single node
sudo bash infra/k3s/install.sh

# Multi-node — server
sudo bash infra/k3s/install.sh --mode server

# Multi-node — worker
sudo K3S_URL=https://<server>:6443 K3S_TOKEN=<token> \
     bash infra/k3s/install.sh --mode agent
```

---

## Validation Checks (53/53 PASS)

| Section | Checks | Result |
|---|---|---|
| 1. Terraform root module | 7 | ✅ PASS |
| 2. VPC module | 5 | ✅ PASS |
| 3. EKS module | 5 | ✅ PASS |
| 4. RDS + ElastiCache modules | 5 | ✅ PASS |
| 5. Environment tfvars | 4 | ✅ PASS |
| 6. Helm chart structure | 5 | ✅ PASS |
| 7. Helm templates | 8 | ✅ PASS |
| 8. Helm values files | 6 | ✅ PASS |
| 9. K3s on-prem | 8 | ✅ PASS |
| **Total** | **53** | **✅ 53/53** |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│               Cloud Mode (AWS EKS)                  │
│                                                     │
│  Terraform → VPC + EKS + RDS + ElastiCache          │
│  Helm → iivkis chart with values-cloud.yaml         │
│  Secrets → ExternalSecrets → Vault                  │
│  Auth → IRSA (pod-level AWS IAM)                    │
└─────────────────────────────────────────────────────┘
                         ▲
               Both modes share the
               same Helm chart core
                         ▼
┌─────────────────────────────────────────────────────┐
│              On-Prem Mode (K3s)                     │
│                                                     │
│  K3s install.sh → single-binary Kubernetes          │
│  Helm → iivkis chart with values-k3s.yaml           │
│  Storage → local-path provisioner                   │
│  DB → in-cluster PostgreSQL + Redis (Bitnami)       │
└─────────────────────────────────────────────────────┘
```

---

## Security Properties

- RDS storage encrypted (AES-256); ElastiCache encrypted at rest and in transit
- EKS control plane logs to CloudWatch
- OIDC/IRSA: pods use AWS IAM roles directly (no static credentials)
- NetworkPolicy restricts pod-to-pod traffic in both modes
- PodDisruptionBudget ensures rolling updates maintain availability
- K3s server API audit logging enabled

---

## Phase 10 Prerequisites

Phase 11 builds on:
- Phase 9: Dockerfiles for api/orchestrator/portal, docker-compose
- Phase 10: UAT environment (docker-compose.uat.yml, uat-workspace)

Both remain fully operational and independent of Phase 11.
