# Quizey

**Plus tu quiz, plus tu sais.**

Quizey est un fichier `.html` autonome pour la révision de **tout le lycée** : mathématiques (spécialité) et physique-chimie par **année** (Seconde / Première / Terminale), allemand et anglais par niveau (A2 / A2+ / B1). Aucune installation, aucun compte, aucune connexion internet requise : vous l'ouvrez dans votre navigateur et vous vous entraînez.

![L'accueil — matière maths : la carte « À réviser », les stats, les points faibles](img/accueil-maths.png)

## Particularité

Ce qui distingue Quizey d'une simple banque de questions :

- **D'après les programmes officiels (BO)** — chaque thème reprend le programme officiel de l'année concernée (maths spécialité, physique-chimie) ; les langues couvrent A2 · A2+ · B1.
- **Révision par répétition espacée** — une question ratée revient à intervalle croissant (demain, puis 3 jours, 7 jours, 2 semaines) ; une bonne réponse la repousse. Après **cinq bonnes réponses d'affilée**, elle est **acquise** et sort de la liste.
- **Questions générées à l'affichage** — vous ne voyez jamais deux fois les mêmes nombres, et la même question n'est pas resservie tant que le lot disponible (chapitres × niveau) n'est pas épuisé.
- **100 % hors ligne, données locales** — vos progrès, points faibles et records restent sur votre machine et ne sont jamais transmis. En ligne, la seule requête extérieure possible est le chargement des polices (Google Fonts) — aucune donnée n'y est envoyée.
- **Correction par la méthode** — chaque réponse s'accompagne de la **méthode de résolution**, pas d'un simple indicatif ; un visuel (courbe, schéma, graphique) accompagne la question quand elle s'y prête.
- **Niveau XP par matière** — de l'expérience et des paliers, purement motivation : le niveau ne débloque aucun contenu.

## Comment s'entraîner

**Entraînement libre** — choisissez votre **année** (Seconde, Première ou Terminale) et **un thème — ou plusieurs à la fois** (les tuiles sélectionnées s'empilent), puis un **niveau** (facile / moyen / difficile ; A2 · A2+ · B1 pour les langues), et progressez à votre rythme. En maths, l'option **« Maths expertes »** (Terminale) ajoute les 3 chapitres officielles — nombres complexes, arithmétique, graphes & chaînes de Markov — au pool. Le mode **Auto** ajuste la difficulté en fonction de vos dernières réponses sur le chapitre.

**À réviser** — la liste des questions à refaire, planifiée par répétition espacée. La carte d'accueil indique le nombre de révisions **échéues pour la journée** et un **temps estimé « ≈ N min »**.

Le bouton « Passer » n'est pas pénalisant : la question concernée est simplement remise en file d'attente.

![Une question de trigonométrie — son mini-visuel, puis la correction détaillée](img/question-correction.png)

Quizey identifie en outre vos **points faibles** (croisement thème × niveau, sur vos 100 dernières réponses) et propose un entraînement ciblé sur chacun.

## Contenu

- **Mathématiques** (spécialité) — par année, d'après les programmes officiels (BO) : **Seconde** (6 thèmes) · **Première** (9) · **Terminale** (8) · option **« Maths expertes »** (3 : complexes, arithmétique, graphes & chaînes de Markov)
- **Physique-chimie** — par année, d'après les programmes officiels (BO) : **Seconde** (9 thèmes) · **Première** (13) · **Terminale** (13)
- **Allemand** — 6 thèmes, 100 % QCM (niveaux A2 · A2+ · B1)
- **Anglais** — 6 thèmes, 100 % QCM (niveaux A2 · A2+ · B1)

![Le mode allemand A2 — 100 % QCM](img/accueil-allemand.png)

## Niveau Quizey

Chaque matière a **son propre niveau** : chaque bonne réponse rapporte de l'expérience (XP) — 5, 10 ou 15 points selon le niveau de la question, plus 5 dès que votre série atteint 3 bonnes réponses d'affilée. À chaque palier franchi, une animation de montée de niveau vous félicite.

C'est une motivation, pas un verrou : le niveau ne débloque aucun contenu, et comme le reste de vos progrès il reste stocké sur votre machine.

## Installation — deux possibilités

**Option 1 · via le terminal.** Dans votre console :

```bash
git clone https://github.com/Cidbzh/Quizey.git
```

Puis double-cliquez sur `Quizey/Quizey.html`.

**Option 2 · via le navigateur.** Accédez à la page [Releases](https://github.com/Cidbzh/Quizey/releases) et téléchargez le fichier (le `.html` direct s'il y figure, sinon « Source code (zip) »). Décompressez, puis double-cliquez sur `Quizey.html`.

Une fois le fichier en votre possession, il vous appartient : sur une clé USB, à la médiathèque, au laboratoire du lycée, sur n'importe quel poste, avec ou sans connexion.

## Licence

MIT — voir le fichier `LICENSE`.
