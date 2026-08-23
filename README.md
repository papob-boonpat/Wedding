# Wedding Guestbook (Real-time LAN Web Application)

A real-time wedding guestbook application designed to run on a local Kubernetes cluster (k3s) on LAN without internet dependency.

## Structure
- `frontend/`: Next.js (App Router), Tailwind CSS, Framer Motion, Matter.js, Socket.io-client.
- `backend/`: Node.js, Express, Socket.io, PostgreSQL (`pg`).
- `k8s/`: Kubernetes manifests for PostgreSQL, Backend, Frontend, and Ingress.
