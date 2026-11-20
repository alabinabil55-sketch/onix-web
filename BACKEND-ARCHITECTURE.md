# ONIX WEB — Architecture Backend

## 1. Architecture retenue

- **Frontend / BFF** : Next.js 15 + React 19 + TypeScript. Les routes `src/app/api/**` constituent la couche serveur pour les opérations nécessitant une validation ou une clé privilégiée.
- **Identité** : Supabase Auth (email/mot de passe, vérification d'adresse, récupération de compte, sessions JWT).
- **Base** : PostgreSQL managé par Supabase. Les tables exposées sont protégées par RLS.
- **Fichiers** : Supabase Storage. Les couvertures publiques sont séparées des pages privées et des contrats/licences.
- **API data** : Supabase PostgREST, consommée via `supabase-js` et protégée par RLS ; API Next.js pour upload validé et signalements.
- **Évolutivité** : index sur les clés de lecture, pagination, stockage objet séparé, possibilité de déplacer les traitements ZIP vers une file de jobs/Edge Function quand le trafic augmente.

## 2. Tables et relations

| Table | Rôle / relations principales |
|---|---|
| `users` | Profil applicatif lié 1:1 à `auth.users` |
| `roles` | Référentiel `reader`, `creator`, `moderator`, `admin` |
| `user_roles` | N:N users ↔ roles, avec attribution et auteur |
| `webtoons` | Œuvres et métadonnées |
| `genres` | Référentiel des genres |
| `webtoon_genres` | N:N webtoons ↔ genres |
| `chapters` | N:1 webtoons |
| `pages` | N:1 chapters, ordre et chemin Storage |
| `favorites` | N:N users ↔ webtoons |
| `reading_history` | Historique de lecture conservé pour compatibilité |
| `reading_progress` | Dernière page / progression par user et chapter |
| `reading_sessions` | Sessions de lecture distinctes |
| `comments` | N:1 users et chapters, statut de modération |
| `notifications` | N:1 users, notification privée |
| `licenses` | N:1 webtoons, territoires, dates et validation |
| `advertisements` | Emplacements et identifiants de régie, sans revenus inventés |
| `ad_revenue_events` | Import de rapports réels AdSense (migration monétisation) |
| `reports` | Signalements de webtoon, chapitre, page, commentaire ou compte |
| `login_security_events` | Journal des événements de sécurité |
| `rights_records`, `ad_slots`, `chapter_pages`, `profiles`, `user_library` | Anciennes tables maintenues pour compatibilité de la version actuelle |

Relations principales : `webtoons 1—N chapters 1—N pages`; `users N—N roles`; `users N—N webtoons` via `favorites`; `webtoons N—N genres`; `users 1—N comments`, `notifications`, `reading_sessions` et `reports`.

## 3. API et contrats

Les tables PostgreSQL sont accessibles via Supabase REST (`/rest/v1/<table>`) avec JWT utilisateur et RLS. Ne jamais appeler l'API avec la clé `service_role` depuis le navigateur.

| Méthode | Route / ressource | Accès et comportement |
|---|---|---|
| GET | `/rest/v1/webtoons?is_published=eq.true` | Public : catalogue publié uniquement |
| GET | `/rest/v1/chapters?webtoon_id=eq.<uuid>&is_published=eq.true` | Public : chapitres publiés |
| GET | `/rest/v1/pages?chapter_id=eq.<uuid>&order=page_number.asc` | Public : pages de chapitres publiés selon RLS |
| GET/POST/DELETE | `/rest/v1/favorites` | JWT ; uniquement les favoris du compte connecté |
| GET/POST/PATCH | `/rest/v1/reading_progress` | JWT ; uniquement la progression du compte connecté |
| GET/POST | `/rest/v1/comments` | Lecture des commentaires visibles ; insertion sous identité du JWT |
| GET/PATCH | `/rest/v1/notifications` | JWT ; notifications personnelles seulement |
| GET/POST/PATCH | `/rest/v1/reports` | Création authentifiée ; lecture et traitement admin |
| POST | `/api/storage/upload` | Admin uniquement ; vérifie session, rôle, origine, taille et signature binaire avant Storage |
| POST | `/api/reports` | Authentifié ; valide le type, l'identifiant et la longueur du signalement |
| POST | `/api/admin/adsense-report` | Admin ; synchronisation serveur du rapport Google AdSense (module monétisation) |

Exemple de payload `POST /api/reports` :

```json
{
  "target_type": "chapter",
  "target_id": "UUID_DU_CHAPITRE",
  "reason": "Contenu inapproprié",
  "details": "Description facultative, 2000 caractères maximum"
}
```

Exemple `POST /api/storage/upload` : `multipart/form-data` avec `file`, `bucket` (`onix-media`, `onix-covers`, `onix-pages` ou `onix-archives`) et `path`. L'en-tête `Authorization: Bearer <access_token>` est obligatoire. Formats détectés par signature : JPEG, PNG, WebP et ZIP. Limites : 15 Mo par image, 50 Mo par ZIP source, 500 pages et 200 Mo décompressés maximum par archive dans l’import navigateur. La route ne décompresse pas les ZIP ; l'import de pages actuel les lit côté client puis transmet chaque image au validateur serveur.

## 4. Sécurité mise en place

- **Authentification** : Supabase Auth, JWT vérifié côté serveur avec `auth.getUser(token)`.
- **Autorisations** : rôles dans `roles`/`user_roles`, fonction `is_admin()` sécurisée et RLS sur les tables applicatives. Le rôle administrateur doit être attribué manuellement par une personne autorisée.
- **Comptes suspendus** : champ de suspension conservé dans `profiles` et `users`. Pour une révocation immédiate de toutes les sessions, utiliser Supabase Auth Admin côté serveur et une procédure de révocation ; le seul champ `suspended_at` ne révoque pas un JWT déjà émis.
- **SQL injection** : utiliser `supabase-js`/PostgREST avec paramètres structurés ; ne jamais concaténer des valeurs utilisateur dans du SQL dynamique. Les migrations utilisent des contraintes et des requêtes paramétrées.
- **XSS** : les commentaires sont du texte brut limité en longueur ; React échappe le texte par défaut. Ne pas utiliser `dangerouslySetInnerHTML` pour les contenus utilisateurs. Si du HTML riche est ajouté, appliquer une bibliothèque de sanitisation côté serveur avec liste blanche.
- **CSRF** : les routes Next.js mutatives vérifient l'origine de la requête et exigent le JWT. Ne pas accepter de mutation authentifiée par cookie tiers sans protection CSRF supplémentaire.
- **Fichiers** : contrôle des droits admin, taille, type réel par signature binaire, bucket autorisé et chemin ; ne pas se fier au nom ou au `Content-Type` déclaré par le navigateur. Les ZIP ne sont pas exécutés côté serveur.
- **Stockage** : contrats et preuves de licence dans `onix-private`; pages dans `onix-pages` privé ; couvertures publiques séparées. Les URL signées doivent être utilisées pour les objets privés.
- **Mots de passe / brute force** : gérés par Supabase Auth. Configurer les limites de connexion, CAPTCHA/Turnstile si nécessaire, vérification email, politique de mot de passe et MFA administrateur dans Supabase Dashboard > Authentication. Les valeurs de `supabase/config.toml` sont des réglages de départ, pas une preuve que les protections sont actives dans le projet hébergé.
- **Secrets** : `SUPABASE_SERVICE_ROLE_KEY` et les secrets Google uniquement dans les variables d'environnement du serveur/hébergeur. Jamais de préfixe `NEXT_PUBLIC_` pour ces secrets.
- **Sauvegardes** : activer les backups automatiques et, selon le plan Supabase, PITR ; exporter périodiquement une copie indépendante et tester une restauration. Une migration SQL ne peut pas activer une option de facturation ou de sauvegarde du fournisseur.

## 5. Installation Windows / VS Code

1. Décompresser le ZIP et ouvrir le dossier `onix-web` dans VS Code.
2. Dans Supabase, créer un projet et récupérer URL + clé anon publique.
3. Dans SQL Editor, exécuter dans cet ordre :
   - `supabase/schema.sql`
   - `supabase/admin-dashboard.sql`
   - `supabase/monetisation.sql`
   - `supabase/migrations/0002_backend_architecture.sql`
4. Vérifier que les tables sont présentes dans Table Editor. Ne pas créer manuellement les buckets : la migration tente de les créer et configure leurs limites.
5. Copier `.env.example` vers `.env.local` et renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Ajouter `SUPABASE_SERVICE_ROLE_KEY` uniquement pour les routes serveur d'upload et de rapports, puis redémarrer le serveur local.
7. Dans Supabase Auth, configurer les URL du site, les URL de redirection, SMTP de production, vérification email, CAPTCHA et limites de connexion.
8. Promouvoir un compte administrateur après création du compte :

```sql
-- Remplacer par l'UUID du compte propriétaire vérifié.
update public.profiles set role='admin' where id='UUID_DU_COMPTE';
insert into public.user_roles(user_id,role_id)
select 'UUID_DU_COMPTE', id from public.roles where code='admin'
on conflict do nothing;
```

9. Dans le terminal VS Code :

```powershell
npm install
npm run typecheck
npm run dev
```

10. Ouvrir `http://localhost:3000`. Tester avec un compte lecteur et un compte administrateur distincts. Vérifier qu'un lecteur ne peut ni lister les contrats, ni gérer les rôles, ni importer de fichiers.

## 6. Vérifications indispensables avant production

Cette archive contient les migrations et les routes décrites ci-dessus, mais l'installation dans le projet Supabase réel n'a pas été exécutée depuis cette session. Il faut appliquer les migrations sur un projet de test, vérifier les politiques RLS, tester les accès avec des comptes de rôles différents, exécuter `npm run typecheck` et `npm run build`, puis tester les limites de fichiers et les sauvegardes. L'import ZIP reste un traitement navigateur : pour des archives volumineuses ou du trafic important, déplacer extraction, antivirus, génération de miniatures et traitement d'images dans une file de tâches serveur isolée.

## État des validations

- Vérification de présence des tables, routes et fichiers de migration effectuée.
- Les dépendances Node.js n'ont pas pu être installées dans l'environnement de génération (installation interrompue par délai réseau) ; le contrôle TypeScript et le build Next.js restent donc à exécuter sur le PC Windows.
- La migration SQL n'a pas été exécutée sur une instance Supabase réelle : elle doit d'abord être testée sur un projet de développement et les politiques RLS doivent être vérifiées avec des comptes distincts.
- `login_security_events` est une table d'audit prête à être alimentée, mais elle n'est pas encore reliée à un webhook d'événements Auth. Les limites de connexion et la MFA doivent être configurées dans Supabase Auth.
