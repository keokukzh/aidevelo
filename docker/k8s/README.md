# Kubernetes Sketch

These manifests are a first deployment sketch for Aidevelo, not a production-hardened Kubernetes package.

## Purpose

Use these files when you want a starting point for:

1. running the Aidevelo web app in Kubernetes
2. persisting `/aidevelo`
3. running PostgreSQL in-cluster for evaluation environments

## Production guidance

For real production, prefer:

1. managed PostgreSQL instead of the included StatefulSet
2. a stronger secret management path than example manifests
3. ingress/TLS adjusted to your cluster
4. an image registry tag instead of `aideveloai-server:latest`

## Files

- `namespace.yaml`
- `app-configmap.yaml`
- `app-secret.example.yaml`
- `app-pvc.yaml`
- `app-deployment.yaml`
- `app-service.yaml`
- `postgres-secret.example.yaml`
- `postgres-service.yaml`
- `postgres-statefulset.yaml`
- `ingress.example.yaml`

## Apply order

```sh
kubectl apply -f docker/k8s/namespace.yaml
kubectl apply -f docker/k8s/postgres-secret.example.yaml
kubectl apply -f docker/k8s/app-secret.example.yaml
kubectl apply -f docker/k8s/app-configmap.yaml
kubectl apply -f docker/k8s/postgres-service.yaml
kubectl apply -f docker/k8s/postgres-statefulset.yaml
kubectl apply -f docker/k8s/app-pvc.yaml
kubectl apply -f docker/k8s/app-service.yaml
kubectl apply -f docker/k8s/app-deployment.yaml
```

Apply `ingress.example.yaml` only after replacing the hostname and TLS settings.
