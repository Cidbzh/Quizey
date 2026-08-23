# Quizey

**Plus tu quiz, plus tu sais.**

Quizey est un fichier `.html` autonome pour la révision de **tout le lycée** : mathématiques (spécialité) et physique-chimie par **année** (Seconde / Première / Terminale), allemand et anglais par niveau (A2 / A2+ / B1). Aucune installation, aucun compte, aucune connexion internet requise : vous l'ouvrez dans votre navigateur et vous vous entraînez.

Chaque question est générée à l'affichage : vous ne voyez donc jamais deux fois les mêmes nombres, et la même question n'est pas resservie tant que le lot disponible (chapitres × niveau) n'est pas épuisé. Chaque réponse s'accompagne de la méthode de résolution, et non d'un simple indicatif.

Vos progrès, vos points faibles et vos records restent stockés sur votre machine et ne sont jamais transmis. Hors ligne, l'application ne contacte aucun service et utilise les polices du système. En ligne, la seule requête extérieure possible est le chargement des polices d'écriture (Google Fonts), si le navigateur n'en a pas encore — aucune donnée n'y est envoyée.

![L'accueil — matière maths : la carte « À réviser », les stats, les points faibles](img/accueil-maths.png)

## Comment s'entraîner

**Entraînement libre** — en mathématiques et en physique-chimie, choisissez d'abord votre **année** (Seconde, Première ou Terminale — en maths, une 4ᵉ année, **Terminale (maths expertes)**, est aussi proposée), puis **un thème — ou plusieurs à la fois** : les tuiles sélectionnées s'empilent (un récapitulatif avec un bouton « Tous » permet de tout effacer d'un coup) pour un entraînement mixte — et un niveau (facile, moyen, difficile — affiché A2, A2+, B1 pour les langues), et progressez à votre rythme. **Terminale (maths expertes)** suit le programme officiel des maths expertes (complexes, arithmétique, graphes & chaînes de Markov) et se choisit comme une année, au même titre que Seconde / Première / Terminale. Le mode **Auto** (difficulté adaptative) ajuste automatiquement le niveau proposé en fonction de vos dernières réponses sur le chapitre, afin de vous servir un exercice exigeant sans être rédhibitoire.

**À réviser** — Quizey met en œuvre la méthode d'apprentissage par **répétition espacée** : chaque question ratée est replanifiée selon un intervalle croissant, une bonne réponse la repousse progressivement (demain, puis 3 jours, 7 jours, 2 semaines) tandis qu'une erreur la ramène rapidement. Après cinq réponses correctes consécutives, une question est considérée comme **acquise** et retirée de la liste de révision. La carte d'accueil indique le nombre de révisions **échéues pour la journée**.

Le bouton « Passer » n'est pas pénalisant : la question concernée est simplement remise en file d'attente.

![Une question de trigonométrie — son mini-visuel, puis la correction détaillée](img/question-correction.png)

La correction présente la méthode de résolution, et non uniquement le résultat ; lorsque la question s'y prête, un visuel (courbe, schéma, graphique) accompagne le texte.

Quizey identifie en outre vos **points faibles** (croisement thème × niveau, sur vos 100 dernières réponses) et propose un entraînement ciblé sur chacun.

## Contenu

- **Mathématiques** (spécialité) — par année, d'après les programmes officiels (BO) : **Seconde** (6 thèmes : logique & ensembles, algorithmique, nombres & algèbre, fonctions & variations, vecteurs & droites, stats & probabilités) · **Première** (9 : logique & algorithmique, fonctions & variations, suites, équations & polynômes du 2ᵉ degré, dérivées, exponentielle, trigonométrie, vecteurs & produit scalaire, probabilités) · **Terminale** (8 : logique & listes, combinatoire & dénombrement, espace & vecteurs 3D, suites & convergence, exponentielle & logarithme, sinus & cosinus, dérivées/primitives/intégrales, probabilités binomiales) · **Terminale (maths expertes)** — 4ᵉ année (3 : nombres complexes, arithmétique, graphes & chaînes de Markov)
- **Physique-chimie** — par année : **Seconde** (6 thèmes : quantité de matière, solutions & dilution, énergie, forces & mouvement, signaux & ondes, électricité) · **Première** (8 : mécanique & Newton, forces & champs, énergie, quantités de matière, stœchiométrie & état final, cinétique, ondes & lumière, électricité) · **Terminale** (6 : ondes & optique, transformations nucléaires, cinétique, énergie (bilan), circuit RC, thermodynamique)
- **Allemand** — 6 thèmes, 100 % QCM : vocabulaire, conjugaison, articles, nombres · dates · heures, phrases utiles, mini-traductions (niveaux A2 · A2+ · B1)
- **Anglais** — 6 thèmes, 100 % QCM : vocabulaire, verbes & temps, articles & quantifieurs, questions, phrases utiles, mini-traductions (niveaux A2 · A2+ · B1)

![Le mode allemand A2 — 100 % QCM](img/accueil-allemand.png)

## Niveau Quizey

Chaque matière a **son propre niveau** : chaque bonne réponse rapporte de l'expérience (XP) — 5, 10 ou 15 points selon le niveau de la question, plus 5 dès que votre série atteint 3 bonnes réponses d'affilée. À chaque palier franchi, une animation de montée de niveau vous félicite : le numéro du niveau passe en avant-plan dans un anneau qui se remplit, avec une gerbe d'étincelles (les confettis, eux, vous attendent à la fin d'une session de révision). Votre niveau progresse sur une courbe croissante : chaque palier demande plus d'XP que le précédent, et vos progrès en maths n'affectent jamais l'allemand, ni inversement.

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
