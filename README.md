# Caturro Scheduler & Payments

Monorepo demo for Caturro Café shift scheduling, time tracking, and payroll automation. The stack includes a TypeScript/Express backend, React frontend, MySQL database, Adminer, and an Nginx reverse proxy. All services share a single `.env` file and communicate across an internal Docker network while only the proxy exposes `NGINX_HOST_PORT` (defaults to `3100`).

Access the app at [http://localhost:3100](http://localhost:3100) once the stack is running. Adminer stays internal, but you can browse it through Nginx at `/adminer/` with the same host and port if needed.

## Stack Overview

- **reverse-proxy**: Nginx gateway serving the SPA build and proxying `/api` to the backend.
- **frontend**: React + TypeScript app compiled to static assets consumed by Nginx.
- **backend**: Express + Prisma API for authentication, shift management, and payroll.
- **mysql**: Persistent data store for users, shifts, and schedules.
- **adminer**: Web UI for database inspection (internal-only).

## Local Development

```bash
make seed          # optional: seed demo users and schedules
make up             # build and start the stack
make logs           # follow container logs
make down           # stop and remove containers
```

> Requires Docker, Docker Compose v2, and Make.

### Default credentials

The root `.env` already defines production-like credentials:

- Admin user: `admin@caturro.cafe` / `PanteraCafe2024!`
- Barista seed users: `samira@caturro.cafe` and `dario@caturro.cafe` / `BaristaCafe2024!`
- MySQL: database `caturro_cafe`, user `caturro_app`, password `Xp2Cafe2024!`

Update the `.env` file if you need different secrets before deploying.
