# CRLook

Application Next.js 15 pour rechercher des entreprises via un formulaire CNRC de style Sidjilcom, afficher les details premium quand une session serveur Sidjilcom est configuree, et archiver les resultats dans Supabase ou Google Sheets.

## Stack

- Next.js 15 App Router
- TypeScript
- TailwindCSS
- API Routes
- Cheerio pour parser le HTML Sidjilcom
- Supabase ou Google Sheets pour l'historique
- AppSheet pour verification des clients PHY

## Installation locale

```bash
npm install
npm run dev
```

Ouvrez `http://localhost:3000`.

## Variables d'environnement

Copiez `.env.example` vers `.env.local`, puis renseignez:

```bash
SIDJILCOM_COOKIE="..."
SIDJILCOM_P_AUTH="..."
SIDJILCOM_ADMIN_KEY="..."
SIDJILCOM_LOOKUP_URL="https://sidjilcom.cnrc.dz/fr/group/sidjilcom/repertoire-des-commercants?p_p_id=dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&_dz_cnrc_sidjilcom_recherchedetaillee_portlet_RechercheDetailleePortlet_INSTANCE_yxIgukiX3JGK_javax.portlet.action=action"
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
APPSHEET_APP_ID="..."
APPSHEET_ACCESS_KEY="..."
APPSHEET_TABLE_NAME="CONTACT"
GOOGLE_SHEETS_SPREADSHEET_ID="..."
GOOGLE_SHEETS_SHEET_NAME="Recherches"
GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`SIDJILCOM_COOKIE`, `SIDJILCOM_P_AUTH`, `SIDJILCOM_ADMIN_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont utilises uniquement cote serveur. Ne les exposez jamais dans le frontend.

`SIDJILCOM_ADMIN_KEY` protege la page de mise a jour de session Sidjilcom dans `Parametres`.

## Routes principales

- `/recherche-cnrc`: recherche CNRC publique.
- `/historique`: recherches enregistrees.
- `/entreprises`: entreprises enregistrees.
- `/verification-phy`: verification AppSheet des clients avec `STATUT = PHY`.
- `/parametres`: configuration admin protegee.

## API

`POST /api/sidjilcom-lookup`

Payload:

```json
{
  "nrc1": "25",
  "nrc2": "A",
  "nrc3": "6175942",
  "nrc4": "00",
  "nrc5": "09"
}
```

La reponse contient la ligne de recherche et, si la session premium est valide, les details `detailsPP.jsp`.

## Supabase

Executez les migrations SQL dans `supabase/migrations` sur votre projet Supabase.

## Google Sheets

Google Sheets peut remplacer Supabase pour l'historique.

1. Creez un Google Sheet avec un onglet nomme `Recherches`.
2. Creez un Service Account dans Google Cloud et activez Google Sheets API.
3. Copiez l'email du service account dans `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Partagez le Google Sheet avec cet email en droit editeur.
5. Mettez l'ID du fichier dans `GOOGLE_SHEETS_SPREADSHEET_ID`.
6. Mettez la cle privee JSON dans `GOOGLE_PRIVATE_KEY`, en gardant les `\n`.

L'app ajoute automatiquement la ligne d'en-tete et journalise les recherches, details, secondaires et comptes sociaux.

## Deploiement Vercel

Chemin recommande si vous voulez un hebergement simple du frontend Next.js:

1. Importez le depot GitHub dans Vercel.
2. Framework preset: `Next.js`.
3. Laissez Vercel utiliser `next build`.
4. Ajoutez les variables d'environnement serveur:
   - `SIDJILCOM_COOKIE`
   - `SIDJILCOM_P_AUTH`
   - `SIDJILCOM_ADMIN_KEY`
   - `SIDJILCOM_LOOKUP_URL`
   - variables Supabase si vous utilisez l'historique
   - variables Google Sheets si vous utilisez l'historique dans Sheets
   - variables AppSheet si vous utilisez la verification PHY
5. Redeployez apres chaque mise a jour de session Sidjilcom.

`SIDJILCOM_COOKIE`, `SIDJILCOM_P_AUTH`, `SIDJILCOM_ADMIN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APPSHEET_ACCESS_KEY` et `GOOGLE_PRIVATE_KEY` doivent rester uniquement cote serveur.

## Deploiement sur serveur Node

Si vous voulez un hebergement classique sur VPS ou serveur dedie:

```bash
npm install
npm run build
npm start
```

Le serveur Next.js ecoute ensuite par defaut sur le port `3000`.

Exemple avec PM2:

```bash
pm2 start npm --name lookuprc -- start
```

## Note importante sur Sidjilcom

Le frontend peut etre heberge sans probleme sur Vercel.

En revanche, selon la politique reseau ou anti-bot de Sidjilcom, certaines executions serverless peuvent ne pas pouvoir joindre `sidjilcom.cnrc.dz`. Dans ce cas, gardez la meme application mais faites tourner le backend Next.js sur un serveur Node classique ou un VPS.
