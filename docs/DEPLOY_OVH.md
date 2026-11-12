# Mettre le backend Bolingo en ligne sur OVH

Tout tourne sur **un seul VPS** avec Docker :
- l'API et le temps réel (Django) ;
- les tâches de fond ;
- la base de données PostgreSQL ;
- Redis ;
- le HTTPS automatique (Caddy) ;
- le relais des appels (coturn).

Les photos et les vocaux vont dans l'**Object Storage** d'OVH, qui est compatible S3. Tous les fichiers sont dans le dossier `deploy/`.

## 1. Ce qu'il faut commander chez OVH

| Quoi | Conseil | Ordre de prix |
|---|---|---|
| Nom de domaine | ex. `bolingo.ci` | 10 à 20 € par an |
| VPS | VPS-2 (4 Go de RAM), Ubuntu 24.04, datacenter Gravelines (GRA) ou Strasbourg | ~7 à 12 € par mois |
| Object Storage | Public Cloud → Object Storage S3, région GRA, classe « Standard » | quelques centimes par Go |

Le VPS suffit pour démarrer. On pourra le séparer en plusieurs serveurs quand il y aura beaucoup de couples.

## 2. Le DNS

Dans l'espace client OVH → Noms de domaine → ton domaine → Zone DNS, crée un enregistrement :

- `A` : `api` → l'adresse IPv4 du VPS.

L'API sera ensuite joignable à `https://api.<ton-domaine>`.

## 3. Préparer le VPS

Connecte-toi en SSH : `ssh ubuntu@<ip-du-vps>`, puis lance :

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# Pare-feu : web, et les ports du relais d'appels
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw allow 443/udp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49160:49400/udp
sudo ufw enable
```

## 4. Le stockage des fichiers (Object Storage)

1. Dans l'espace OVH Public Cloud, ouvre **Object Storage** et crée un conteneur S3 nommé `bolingo-media` en région GRA, accès privé.
2. Dans **Utilisateurs S3**, crée un utilisateur. Note sa clé d'accès et sa clé secrète.
3. Autorise l'envoi direct depuis les téléphones (CORS) : rien à faire. Les envois passent par des liens signés en POST, et les applications mobiles ne sont pas soumises au CORS.

## 5. Récupérer le code et configurer

```bash
git clone https://github.com/brouantoine/toi_et_moi.git bolingo
cd bolingo/deploy
cp .env.example .env
nano .env
```

Dans `.env`, remplis au minimum :
- `API_DOMAIN`, `PUBLIC_BASE_URL`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` : ton domaine ;
- `PUBLIC_IP` : l'adresse IPv4 du VPS ;
- `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `TURN_SECRET` : génère chacun avec `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` ;
- `FIELD_ENCRYPTION_KEYS` : la clé qui chiffre les messages et le coach. Garde-la précieusement : sans elle, ces données sont illisibles.
- `S3_*` : les identifiants de l'Object Storage ;
- `OPENROUTER_API_KEY` : ta clé du coach ;
- `LEGAL_ENTITY`, `LEGAL_ADDRESS`, `SUPPORT_EMAIL` : affichés sur les pages légales ;
- `SMTP_*` : pour les emails de confirmation et de mot de passe oublié.

Puis lance :

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Caddy obtient tout seul le certificat HTTPS, en une à deux minutes après que le DNS pointe vers le VPS.

## 6. Vérifier

- `https://api.<ton-domaine>/api/v1/health/` doit répondre `{"status": "ok", ...}`.
- `https://api.<ton-domaine>/legal/privacy/` affiche la politique de confidentialité.
- `https://api.<ton-domaine>/admin/` ouvre l'administration. C'est là que tu offres Plus.
- Comptes de démonstration pour la revue App Store :
  `docker compose -f docker-compose.prod.yml exec backend python manage.py comptes_revue --mot-de-passe "..."`

## 7. Brancher l'application dessus

Dans `mobile/eas.json`, `EXPO_PUBLIC_API_URL` vaut déjà `https://api.bolingo.ci` : compile directement.

## 8. Les appels

- **Ce que fait le relais** : quand les deux téléphones ne peuvent pas se joindre directement, ce qui arrive souvent sur les réseaux mobiles, la voix et l'image passent par coturn. Elles restent chiffrées de bout en bout par WebRTC : le serveur ne peut ni les écouter ni les voir.
- **Pour activer les appels** : `CALLS_MEDIA_READY=true` et `TURN_URLS` sont déjà dans `.env.example`. Les identifiants du relais sont temporaires, signés par le backend avec `TURN_SECRET`, et vérifiés par coturn.
- **Pour tester** : il faut la version installée de l'app, avec `npx eas-cli build --profile development`, sur deux téléphones de comptes différents.

## 9. Mettre à jour

```bash
cd ~/bolingo && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
```

Les migrations de base de données passent automatiquement au démarrage.

## 10. Sauvegardes (à mettre en place dès le début)

Une sauvegarde quotidienne de la base, avec un crontab (`crontab -e`) :

```
0 3 * * * cd ~/bolingo/deploy && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U bolingo bolingo | gzip > ~/backup-$(date +\%F).sql.gz
```

Copie ces fichiers ailleurs que sur le VPS : un conteneur Object Storage dédié, par exemple. Garde aussi une copie de `deploy/.env` en lieu sûr : la clé `FIELD_ENCRYPTION_KEYS` en particulier.
