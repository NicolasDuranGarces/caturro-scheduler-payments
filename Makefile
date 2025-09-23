SHELL := /bin/bash
COMPOSE := docker compose --env-file ./.env

.PHONY: up down stop logs ps seed migrate clean frontend backend

up:
	$(COMPOSE) up --build -d mysql adminer backend reverse-proxy

frontend:
	$(COMPOSE) up frontend-builder

backend:
	$(COMPOSE) up --build -d backend

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

stop:
	$(COMPOSE) stop

seed:
	$(COMPOSE) run --rm backend sh -c "npx prisma migrate deploy && npm run prisma:seed"

migrate:
	$(COMPOSE) run --rm backend npx prisma migrate deploy

clean:
	$(COMPOSE) down --volumes --remove-orphans

down:
	$(COMPOSE) down --remove-orphans
