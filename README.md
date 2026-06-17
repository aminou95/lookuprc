# Sidjilcom Lookup DZ

Application Next.js 15 pour rechercher des entreprises via un formulaire CNRC de style Sidjilcom, afficher les details premium quand une session serveur Sidjilcom est configuree, et archiver les resultats dans Supabase ou Google Sheets.

## Stack

- Next.js 15 App Router
- TypeScript
- TailwindCSS
- API Routes
- Cheerio pour parser le HTML Sidjilcom
- Supabase ou Google Sheets pour l'historique
- AppSheet pour verification des clients PHY

## Installation

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

Le chemin recommande pour la production est Vercel.

1. Importez le depot GitHub dans Vercel.
2. Framework preset: `Next.js`.
3. Build command: laissez la valeur par defaut `next build`.
4. Ajoutez dans Vercel > Settings > Environment Variables:
   - `SIDJILCOM_COOKIE`
   - `SIDJILCOM_P_AUTH`
   - `SIDJILCOM_ADMIN_KEY`
   - `SIDJILCOM_LOOKUP_URL`
   - variables Supabase si vous voulez enregistrer l'historique
   - variables Google Sheets si vous voulez enregistrer l'historique dans Sheets
   - variables AppSheet si vous voulez verifier vos clients AppSheet
5. Redeployez apres chaque mise a jour de session Sidjilcom.

`SIDJILCOM_COOKIE`, `SIDJILCOM_P_AUTH`, `SIDJILCOM_ADMIN_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APPSHEET_ACCESS_KEY` et `GOOGLE_PRIVATE_KEY` doivent rester uniquement cote serveur.

## Deploiement Netlify

Le projet contient `netlify.toml` et `@netlify/plugin-nextjs`.

1. Importez le depot dans Netlify.
2. Build command: `npm run build`.
3. Publish directory: `.next`.
4. Ajoutez dans Netlify > Site configuration > Environment variables:
   - `SIDJILCOM_COOKIE`
   - `SIDJILCOM_P_AUTH`
   - `SIDJILCOM_ADMIN_KEY`
   - `SIDJILCOM_LOOKUP_URL`
   - variables Supabase si vous voulez enregistrer l'historique
   - variables Google Sheets si vous voulez enregistrer l'historique dans Sheets
   - variables AppSheet si vous voulez verifier vos clients AppSheet
5. Deploy.

En production Netlify, mettez a jour `SIDJILCOM_COOKIE` et `SIDJILCOM_P_AUTH` dans les variables d'environnement quand votre session Sidjilcom expire, puis redeployez.

La route API garde le cookie Sidjilcom cote serveur. Le cookie n'est jamais expose au navigateur.
