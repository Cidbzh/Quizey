# Quizey — PWA + hébergement (spec de conception)

Date : 2026-08-25 · Statut : validée (Cid) · Approche : **① PWA minimal**

## Objectif

Permettre à un élève d'« installer » Quizey sur son téléphone — icône sur l'écran
d'accueil, plein écran, utilisable **hors ligne** — via un simple **lien à partager**,
en partant sur une **version vierge** (pas les stats de quelqu'un d'autre).

Le fichier `Quizey.html` **reste le canon** : autonome, utilisable en local comme avant.

## Constats (déjà vrai → rien à coder)

- Les stats sont **100 % dans `localStorage`** (9 appels, aucun IndexedDB/cookie),
  soit **par appareil/navigateur**. Premier lancement = `{ans:0, good:0, …}` (ligne 4508).
  → **Un nouvel appareil = app vierge.** La contrainte « vierge par utilisateur » est
  **déjà remplie par construction** ; les `ans:` dans le fichier sont des *bonnes réponses
  de questions* (contenu), pas des stats d'utilisateur.
- L'app est **déjà responsive** (meta viewport, CSS mobile, test « téléphone/ordinateur »).
  → La contrainte « tourne sur téléphone » est **déjà remplie** ; la PWA n'ajoute que
  l'installation (icône/plein écran) + l'offline une fois servie.
- Repo `Cidbzh/Quizey` → URL Pages **`https://cidbzh.github.io/Quizey/`**.
- `logo.svg` (628 o, « Q à la plume », 64×64) dispo → base des icônes.
- Playwright déjà installé (`.shots/make-shots.js`) + Node v24 → rendu PNG **sans nouvelle dépendance**.

## Décisions (validées)

| Décision | Valeur |
|---|---|
| Approche | ① PWA minimal (pas de bouton d'install custom, pas d'API share) |
| Icône | **maskable** (logo centré + marge sûre ≈ 20 %) + icône iOS |
| Hébergement | GitHub Pages, source `main` / racine |
| Chemins | **relatifs partout** (le site est servi sous `/Quizey/`) |

## Fichiers

**Nouveaux (racine, additifs, à commit) :**
- `manifest.webmanifest` — `name: "Quizey"`, `description` = slogan (non réécrit),
  `display: "standalone"`, `start_url` **relatif** → `Quizey.html`, `background_color` +
  `theme_color` (palette de l'app), icônes 192 (`any`) / 512 (`any maskable`).
- `sw.js` — service worker **sans dépendance** : pré-cache de l'app shell à l'`install`
  (`./`, `./Quizey.html`, `./index.html`, `./manifest.webmanifest`, icônes), **cache-first**
  avec repli réseau, constante `CACHE` versionnée + nettoyage des anciennes à l'`activate`,
  n'intercepte que les `GET` **même origine** (les polices Google échouent silencieusement
  hors ligne → repli sur les stacks système, déjà prévu par design).
- `icon-192.png` — logo sur fond de marque, 192 (purpose `any`).
- `icon-512.png` — logo sur fond de marque, 512, **marge sûre maskable**.
- `apple-touch-icon.png` — 180, plein (iOS n'a pas de maskable ; sinon iOS capture l'écran).
- `index.html` — **redirect** vers `Quizey.html` (URL racine propre).

**Modifié (additif, tous gardés) — `Quizey.html` :**
- `<link rel="manifest" href="./manifest.webmanifest">`, `<link rel="icon">` (192/512),
  `<link rel="apple-touch-icon">`, `<meta name="theme-color">`.
- Enregistrement SW **gardé** :
  `if ('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost'))`
  + `.catch(()=>{})` → en `file://`, **rien ne s'enregistre**, usage local **inchangé**.

**Local (gitignoré, jamais commité) :** `.shots/make-icons.js` — rendu des 3 PNG depuis
`logo.svg` (reprend le setup Playwright de `make-shots.js`).

## Invariants respectés

Fichier unique intact & autonome en local · **aucune stat d'utilisateur** dans les nouveaux
fichiers · slogan non réécrit (réutilisé tel quel en `description`) · **278 tests restent verts** ·
zéro dépendance ajoutée · usage `file://` strictement identique (enregistrement SW inopérant).

## Tests (ajoutés à `_qz_verify.js`)

- `[PWA-1]` `manifest.webmanifest` = JSON valide (name, `start_url`, `icons` non vide).
- `[PWA-2]` `sw.js` compile (syntaxe) via `vm.Script`.
- `[PWA-3]` `Quizey.html` contient `<link rel="manifest">` + `<link rel="icon">` + `theme-color`.
- `[PWA-4]` l'enregistrement SW est **gardé** (contrôle `https:`/`localhost` présent).
- `[PWA-5]` `index.html` pointe bien vers `Quizey.html`.
- + les **278 tests existants** restent verts.

## Étapes d'implémentation (ordre)

1. Générer `icon-192/512/apple-touch` depuis `logo.svg` (`.shots/make-icons.js`).
2. Écrire `manifest.webmanifest`.
3. Écrire `sw.js`.
4. Écrire `index.html` (redirect).
5. Câbler `Quizey.html` (links + enregistrement SW gardé).
6. Ajouter les tests `[PWA-*]` à `_qz_verify.js`.
7. `node _qz_verify.js` → **tous verts** (278 + nouveaux).
8. Commit + push + **activation GitHub Pages** (`main`/racine) + vérif de `https://cidbzh.github.io/Quizey/`.

## Hors périmètre (à plus tard)

Bouton d'installation personnalisé (`beforeinstallprompt`) · API `share` (partager un score) ·
splash screen · cache des polices Google · variante d'icône thème sombre.

## Risques / points de vigilance

- **Chemins absolus** (`/sw.js`) = broken sous `/Quizey/` → **tout en relatif**.
- `start_url` → `Quizey.html` (l'app), **pas** `index.html` (qui redirect).
- **iOS** ignore `maskable` → prévoir `apple-touch-icon.png` (180) séparément.
- GitHub Pages : vérifier que `main`/racine sert bien `index.html` sur `/Quizey/`.
