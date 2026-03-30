#!/usr/bin/env bash
###############################################################################
# IIVKIS — K3s On-Premises Installation Script
#
# Installs a single-node or multi-node K3s cluster and deploys IIVKIS via
# Helm on on-premises hardware (bare-metal or VMware).
#
# Usage:
#   # Single node (server + agent on same host):
#   sudo bash infra/k3s/install.sh
#
#   # Multi-node server (control plane):
#   sudo bash infra/k3s/install.sh --mode server
#
#   # Multi-node agent (worker — requires K3S_URL + K3S_TOKEN):
#   sudo K3S_URL=https://<server-ip>:6443 K3S_TOKEN=<token> \
#        bash infra/k3s/install.sh --mode agent
#
# Environment variables (all optional, override defaults):
#   K3S_VERSION      — K3s version to install (default: v1.29.4+k3s1)
#   IIVKIS_NAMESPACE — Kubernetes namespace    (default: iivkis)
#   HELM_CHART_DIR   — Path to Helm chart      (default: infra/helm/iivkis)
#   HELM_VALUES_FILE — Additional values file  (default: infra/helm/iivkis/values-k3s.yaml)
###############################################################################

set -euo pipefail

K3S_VERSION="${K3S_VERSION:-v1.29.4+k3s1}"
IIVKIS_NAMESPACE="${IIVKIS_NAMESPACE:-iivkis}"
HELM_CHART_DIR="${HELM_CHART_DIR:-infra/helm/iivkis}"
HELM_VALUES_FILE="${HELM_VALUES_FILE:-infra/helm/iivkis/values-k3s.yaml}"
MODE="${1:-server}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log() { echo "[$(date +%T)] $*"; }
die() { echo "[ERROR] $*" >&2; exit 1; }

# ─── Pre-flight checks ────────────────────────────────────────────────────────
command -v curl  >/dev/null 2>&1 || die "curl is required"
command -v helm  >/dev/null 2>&1 || { log "Helm not found — installing ..."; install_helm; }

install_helm() {
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
}

# ─── Install K3s ─────────────────────────────────────────────────────────────
log "Installing K3s ${K3S_VERSION} in ${MODE} mode ..."

if [[ "${MODE}" == "server" ]]; then
  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    sh -s - server \
      --disable traefik \
      --disable servicelb \
      --write-kubeconfig-mode 644 \
      --kube-apiserver-arg="audit-log-path=/var/log/kubernetes/audit.log" \
      --kube-apiserver-arg="audit-log-maxage=7"

  log "Waiting for K3s to be ready ..."
  timeout 120 bash -c 'until k3s kubectl get nodes 2>/dev/null | grep -q " Ready"; do sleep 3; done'

elif [[ "${MODE}" == "agent" ]]; then
  [[ -z "${K3S_URL:-}" ]]   && die "K3S_URL must be set for agent mode"
  [[ -z "${K3S_TOKEN:-}" ]] && die "K3S_TOKEN must be set for agent mode"

  curl -sfL https://get.k3s.io | \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    K3S_URL="${K3S_URL}" \
    K3S_TOKEN="${K3S_TOKEN}" \
    sh -s - agent

  log "Agent joined the cluster."
  exit 0
else
  die "Unknown mode '${MODE}'. Use 'server' or 'agent'."
fi

# ─── Set up kubeconfig ────────────────────────────────────────────────────────
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
log "KUBECONFIG set to ${KUBECONFIG}"

# ─── Install nginx-ingress controller ────────────────────────────────────────
log "Installing ingress-nginx ..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.hostNetwork=true \
  --set controller.kind=DaemonSet \
  --set controller.service.type=NodePort \
  --wait --timeout 120s

# ─── Create IIVKIS namespace ─────────────────────────────────────────────────
k3s kubectl create namespace "${IIVKIS_NAMESPACE}" --dry-run=client -o yaml | \
  k3s kubectl apply -f -

# ─── Create placeholder secrets (replace with real values) ───────────────────
log "Creating placeholder secrets (replace with real credentials before use) ..."
k3s kubectl create secret generic iivkis-secrets \
  --namespace "${IIVKIS_NAMESPACE}" \
  --from-literal=database-url="postgresql://iivkis:changeme@postgres:5432/iivkis" \
  --from-literal=redis-url="redis://:changeme@redis-master:6379" \
  --dry-run=client -o yaml | k3s kubectl apply -f -

# ─── Deploy IIVKIS via Helm ───────────────────────────────────────────────────
log "Deploying IIVKIS chart from ${REPO_ROOT}/${HELM_CHART_DIR} ..."
helm upgrade --install iivkis "${REPO_ROOT}/${HELM_CHART_DIR}" \
  --namespace "${IIVKIS_NAMESPACE}" \
  --values "${REPO_ROOT}/${HELM_VALUES_FILE}" \
  --wait \
  --timeout 300s

# ─── Print access info ────────────────────────────────────────────────────────
NODE_IP=$(k3s kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
API_PORT=$(k3s kubectl -n ingress-nginx get svc ingress-nginx-controller \
  -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null || echo "80")

log "──────────────────────────────────────────────────"
log " IIVKIS deployed to K3s cluster"
log " Node IP   : ${NODE_IP}"
log " Portal    : http://${NODE_IP}:${API_PORT}/"
log " API       : http://${NODE_IP}:${API_PORT}/api"
log " Namespace : ${IIVKIS_NAMESPACE}"
log "──────────────────────────────────────────────────"
log "To uninstall: helm uninstall iivkis -n ${IIVKIS_NAMESPACE}"
