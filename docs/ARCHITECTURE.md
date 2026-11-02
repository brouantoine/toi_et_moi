# Architecture

> Document vivant, complété à chaque phase (finalisé en P11.7).

## Vue d'ensemble
- **mobile/** : Expo SDK 58 (React Native), TypeScript strict, Expo Router (`src/app`), design system maison (`src/ui`), i18n (`src/i18n`), marque (`src/config/brand.ts`).
- **backend/** : Django 6.1 + DRF, ASGI (Daphne + Channels), Celery + Beat, PostgreSQL, Redis, stockage S3-compatible.
- Communication : API REST JSON `/api/v1/` (JWT), schéma OpenAPI `/api/schema/`, WebSocket (Channels) pour le temps réel de l'organisation (P3).

## Backend
- `config/settings/` : `base` (tout par variables d'environnement), `dev`, `test` (sans Docker : SQLite, Celery eager, layer en mémoire, stockage en mémoire), `prod` (durci : HTTPS, HSTS, cookies sécurisés).
- `core/` : utilitaires transverses (health ; à venir : mixin de cloisonnement par couple, stockage présigné, champ chiffré).
- Une app par domaine : accounts, couples, memories, organization, connection, rituals, dreams, private_space, privacy, notifications, legal.

## Mobile
- `src/app/` : routes uniquement (aucune logique métier).
- `src/ui/` : tokens (couleurs terracotta/crème/sauge/encre, espacements, rayons, typos), `ThemeProvider` clair/sombre, composants.
- `src/i18n/` : i18next, français par défaut, anglais en seconde langue.

## Sécurité (principes)
- Tout queryset filtré par le couple de l'utilisateur via un mixin unique (P1.6) ; le privé filtré par auteur.
- Données privées chiffrées au repos (P8.1).
- Aucun SDK tiers de tracking ou d'analytics.
