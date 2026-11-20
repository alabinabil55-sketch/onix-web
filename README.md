# ONIX WEB — Projet de démarrage fonctionnel BN

ONIX WEB est une application Next.js connectable à Supabase : catalogue, fiches d'œuvres, lecteur vertical, inscription/connexion, profil, bibliothèque, historique, recherche, contact et espace admin protégé par rôle.

## Prérequis
- Windows 10/11
- Node.js LTS (https://nodejs.org/)
- Un compte GitHub
- Un projet Supabase

## Installation Windows
1. Décompresse `onix-web.zip`.
2. Ouvre le dossier `onix-web` dans Visual Studio Code.
3. Dans VS Code : Terminal > Nouveau terminal.
4. Exécute :
   ```bash
   npm install
   ```
5. Copie `.env.example` vers `.env.local`.
6. Dans Supabase > Project Settings > API, copie Project URL et anon/public key dans `.env.local`.
7. Dans Supabase > SQL Editor, ouvre `supabase/schema.sql`, colle tout le SQL et exécute-le.
8. Dans Supabase > Authentication > URL Configuration, ajoute `http://localhost:3000` comme Site URL et Redirect URL.
9. Démarre :
   ```bash
   npm run dev
   ```
10. Ouvre http://localhost:3000.

## Créer le premier administrateur
1. Inscris ton compte via `/inscription`.
2. Dans Supabase > Table Editor > profiles, copie l'UUID de ton profil.
3. Dans SQL Editor, exécute :
   ```sql
   update public.profiles set role='admin' where id='COLLE-ICI-UUID';
   ```
4. Déconnecte-toi puis reconnecte-toi. Ouvre `/admin`.

Ne donne jamais le rôle admin depuis un formulaire public. Ne place jamais la `service_role` key dans `.env.local` côté client.

## Ajouter une œuvre
- Depuis `/admin`, crée une fiche en brouillon.
- Ajoute la couverture et les chapitres/pages dans Supabase.
- Dans `webtoons`, confirme `rights_status` et `rights_notes`.
- Ne publie (`is_published=true`) que si les droits sont vérifiés.
- Dans `chapters`, crée les chapitres puis ajoute leurs images dans `chapter_pages`.
- Le bucket Storage `webtoon-pages` doit être configuré avec des règles adaptées. Pour les contenus sous licence, privilégie les URL signées et évite les liens publics.

## Déploiement GitHub + Vercel
1. Crée un dépôt GitHub privé ou public selon ton choix.
2. Dans le terminal :
   ```bash
   git init
   git add .
   git commit -m "Initial ONIX WEB"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/onix-web.git
   git push -u origin main
   ```
3. Sur Vercel, importe le dépôt GitHub.
4. Ajoute `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans Environment Variables.
5. Déploie puis configure l'URL Vercel dans Supabase Auth > URL Configuration.

## État du starter et limites à compléter
Cette version connecte les pages principales à Supabase et fournit le schéma de base et des règles RLS. Avant une ouverture publique, il reste à compléter/tester : gestion des favoris et progression depuis l'interface du lecteur, commentaires UI et modération, notifications automatiques, téléversement Storage avec contrôle de type/taille, emails transactionnels, pagination, rate limiting, journalisation, tests automatisés, sauvegarde et audit de sécurité. Les pages légales sont des modèles et ne constituent pas un avis juridique.

## Droits d'auteur
Ne téléverse que des œuvres originales ONIX, du domaine public vérifié dans les territoires ciblés, ou couvertes par une licence écrite autorisant explicitement la diffusion numérique, les territoires, la durée et les éventuelles traductions. Conserve les contrats/preuves de droits.


## Lecteur Webtoon professionnel
Le lecteur `/lecture/[chapterId]` comprend le défilement vertical continu, le chargement différé des images, le préchargement des deux pages suivantes, une largeur réglable, le plein écran, la navigation entre chapitres, la reprise de lecture et les signalements.

Après mise à jour du projet :
1. Dans Supabase > SQL Editor, exécute le bloc `chapter_reports` ajouté à la fin de `supabase/schema.sql` (ou réexécute le fichier complet).
2. Les images doivent être stockées dans un bucket Supabase Storage et `chapter_pages.image_url` doit contenir une URL accessible au lecteur (URL publique pour les contenus librement diffusables ou URL signée obtenue côté serveur pour les contenus privés/licenciés).
3. Le lecteur enregistre la progression dans `reading_history` pour les membres connectés et dans le stockage local du navigateur pour les visiteurs.
4. Les signalements sont enregistrés dans `chapter_reports`; leur consultation est réservée aux administrateurs via Supabase.

Performance : les premières images sont prioritaires, les suivantes sont en `loading=lazy`, les images sont décodées de façon asynchrone et seules les deux pages suivantes sont préchargées. Pour conserver une bonne qualité tout en réduisant le poids, générer des variantes WebP/AVIF adaptées à la largeur d'écran côté pipeline d'images est recommandé.


## Tableau de bord administrateur
- Route : `/admin` (rôle `admin` requis).
- Gestion des fiches Webtoon, couvertures, genres, statut, archivage et publication.
- Création de chapitres, import multiple d'images ou de ZIP, tri naturel des noms de fichiers.
- Programmation enregistrée dans `scheduled_at`. Pour publier automatiquement à l'heure prévue, configure une tâche planifiée (Supabase Cron/Edge Function) qui vérifie aussi la validité des droits avant publication.
- Gestion des utilisateurs, rôles et indicateur de suspension.
- Gestion des dossiers de licences et territoires.
- Statistiques de base et revenus publicitaires importés.

### Installation de la migration admin
1. Dans Supabase SQL Editor, exécute `supabase/admin-dashboard.sql`.
2. Dans Supabase Storage, crée un bucket `onix-media`. Ce starter attend un bucket public pour servir les images ; configure les règles d'upload pour les administrateurs uniquement.
3. La clé `service_role` ne doit JAMAIS être utilisée dans le navigateur ou placée dans `NEXT_PUBLIC_*`.
4. Pour la suspension effective des sessions, ajouter une fonction Edge/route serveur qui utilise la clé service_role en secret pour bannir/révoquer l'utilisateur Auth. Le champ `profiles.suspended_at` seul est un état administratif et n'invalide pas à lui seul les jetons de session.
5. Pour des statistiques fiables, instrumenter le lecteur côté serveur avec des événements de lecture dédupliqués. `reading_history` compte les historiques actifs, pas les impressions brutes.
6. Le tableau de bord stocke les heures de programmation mais un Cron/Edge Function doit assurer la publication effective à l'heure prévue.
7. La validation juridique doit vérifier le contrat et la portée territoriale réelle. L'interface ne remplace pas la vérification humaine des preuves de droits.

### Limites fonctionnelles à traiter avant mise en production
Les opérations d'administration Auth sensibles (suspension/révocation effective, suppression d'un compte Auth, promotion sécurisée d'un admin) nécessitent une API serveur/Edge Function protégée. L'import ZIP extrait les fichiers image dans le navigateur et envoie les pages une par une ; fixer des limites de taille, quotas et contrôles MIME côté serveur avant ouverture publique. Les changements d'ordre après import nécessitent une fonctionnalité de réorganisation dédiée. Les revenus publicitaires ne sont pas connectés à une régie par défaut.


## Monétisation publicitaire (lecture gratuite)
- Page d'administration : `/admin/monetisation` (rôle admin requis).
- Emplacements prévus : haut de l'accueil, après les sélections de l'accueil, haut du catalogue, insertion dans le catalogue.
- Les publicités ne sont chargées que si l'utilisateur a accepté les publicités ET la personnalisation dans le panneau de consentement ; si la personnalisation est refusée, aucune publicité AdSense n’est chargée dans cette première version. L'utilisateur peut rouvrir les préférences via le bouton « Cookies ».
- Exécuter `supabase/monetisation.sql` dans Supabase SQL Editor.
- Dans `/admin/monetisation`, renseigner l'identifiant éditeur `ca-pub-…` et l'identifiant de chaque unité publicitaire récupérés dans AdSense. Ne pas inventer ces valeurs.
- Le rapport financier est récupéré via l'API Google AdSense Reporting v2. Configurer les variables serveur listées dans `.env.example` après création d'un client OAuth Google et obtention d'un refresh token autorisé à lire le compte AdSense. Le compte et les droits API doivent être réellement actifs.
- Les montants affichés proviennent des rapports Google AdSense. Aucune donnée de revenu n'est générée localement à titre d'exemple. Les rapports peuvent être estimés/ajustés par Google ; ils ne constituent pas nécessairement un paiement final.
- Les impressions et clics du tableau sont les métriques du rapport AdSense synchronisé, pas des clics comptés artificiellement par le site.
- Le consentement local intégré est un contrôle de préférence basique, pas une CMP certifiée. Avant l'activation de Google AdSense, vérifie les obligations légales dans les pays ciblés et utilise une CMP certifiée Google si nécessaire (notamment pour les visiteurs EEE/Royaume-Uni/Suisse). La politique de confidentialité doit expliquer les partenaires publicitaires, finalités, durées et droits des visiteurs.
- Aucun emplacement ne s'affiche tant qu'il n'est pas activé, configuré avec les vrais identifiants et accepté par le visiteur. La lecture reste gratuite et sans blocage par publicité.

### Limites / tâches avant production
Le rapport AdSense nécessite un compte éditeur accepté, l'API AdSense activée dans le projet Google Cloud, OAuth et un compte AdSense valide. Les variables secrètes doivent être définies dans l'hébergement (Vercel/serveur), jamais dans le code client. Pour une intégration robuste, faire vérifier la configuration OAuth, la CMP, les règles de consentement applicables à chaque territoire, les politiques AdSense et les paramètres de sécurité par un professionnel avant mise en ligne.

## Architecture Backend (migration 0002)
Consulte `BACKEND-ARCHITECTURE.md` pour le modèle relationnel, les contrats API, les règles de sécurité et le guide d'installation Windows. Après les trois scripts historiques (`schema.sql`, `admin-dashboard.sql`, `monetisation.sql`), exécuter `supabase/migrations/0002_backend_architecture.sql`.

La nouvelle migration ajoute `users`, `roles`, `user_roles`, `genres`, `webtoon_genres`, `pages`, `favorites`, `reading_progress`, `reading_sessions`, `licenses`, `advertisements`, `reports` et `login_security_events`, tout en conservant les tables historiques utilisées par l'interface actuelle. Les fichiers envoyés par l'administration passent désormais par `/api/storage/upload` pour une validation serveur du rôle, du format réel et de la taille.

Les protections de connexion (limitation des tentatives, vérification email, CAPTCHA/MFA) doivent aussi être activées dans Supabase Dashboard > Authentication. Les sauvegardes automatiques/PITR dépendent du plan Supabase et doivent être configurées dans le tableau de bord ; voir le guide détaillé.
