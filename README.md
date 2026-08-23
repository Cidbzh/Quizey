# Quizey

**Plus tu quiz, plus tu sais.**

Quizey est une application de révision pour **tout le lycée** qui tient dans **un seul fichier** : **mathématiques** (spécialité) et **physique-chimie** par année, **allemand** et **anglais** par niveau. Ouvrez-le dans votre navigateur et entraînez-vous — **sans installation, sans compte, sans connexion, sans données envoyées**.

![L'accueil — matière maths : la carte « À réviser », les stats, les points faibles](img/accueil-maths.png)

## Particularité

- **D'après les programmes officiels (BO)** — chaque thème reprend le programme officiel de l'année concernée ; les langues couvrent A2 · A2+ · B1.
- **Révision par répétition espacée** — une question ratée revient à intervalle croissant (demain, puis 3 jours, 7 jours, 2 semaines) ; après **cinq bonnes réponses d'affilée**, elle est **acquise** et sort de la liste.
- **Questions générées à l'affichage** — vous ne voyez jamais deux fois les mêmes nombres, et la même question n'est pas resservie tant que le lot disponible n'est pas épuisé.
- **Correction par la méthode** — chaque réponse s'accompagne de la **méthode de résolution**, pas d'un simple indicatif ; un visuel (courbe, schéma, graphique) accompagne la question quand elle s'y prête.

## Comment s'entraîner

**Entraînement libre** — choisissez votre **année** (Seconde, Première ou Terminale) et **un thème — ou plusieurs à la fois** (les tuiles sélectionnées s'empilent), puis un **niveau** (facile / moyen / difficile ; A2 · A2+ · B1 pour les langues). En maths, l'option **« Maths expertes »** (Terminale) ajoute les 3 chapitres officielles — nombres complexes, arithmétique, graphes & chaînes de Markov. Le mode **Auto** ajuste la difficulté selon vos dernières réponses sur le chapitre.

**À réviser** — la liste de vos questions à refaire. La carte d'accueil indique le nombre de révisions **échéues aujourd'hui** et un **temps estimé « ≈ N min »**.

Le bouton « Passer » n'est pas pénalisant : la question concernée est simplement remise en file d'attente.

![Une question de trigonométrie — son mini-visuel, puis la correction détaillée](img/question-correction.png)

Quizey identifie en outre vos **points faibles** (croisement thème × niveau, sur vos 100 dernières réponses) et propose un entraînement ciblé sur chacun.

## Contenu

- **Mathématiques** (spécialité) : **Seconde** (6 thèmes) · **Première** (9) · **Terminale** (8) · option **« Maths expertes »** (3)
- **Physique-chimie** : **Seconde** (9 thèmes) · **Première** (13) · **Terminale** (13)
- **Allemand** — 6 thèmes, 100 % QCM (A2 · A2+ · B1)
- **Anglais** — 6 thèmes, 100 % QCM (A2 · A2+ · B1)

![Le mode allemand A2 — 100 % QCM](img/accueil-allemand.png)

## Niveau Quizey

Chaque matière a **son propre niveau** : chaque bonne réponse rapporte de l'expérience (XP) — 5, 10 ou 15 points selon le niveau de la question, plus 5 dès que votre série atteint 3 bonnes réponses d'affilée. À chaque palier franchi, une animation de montée de niveau vous félicite.

C'est une motivation, pas un verrou : le niveau ne débloque aucun contenu, et reste stocké sur votre machine.

## Installation — deux possibilités

**Option 1 · via le terminal.** Dans votre console :

```bash
git clone https://github.com/Cidbzh/Quizey.git
```

Puis double-cliquez sur `Quizey/Quizey.html`.

**Option 2 · via le navigateur.** Accédez à la page [Releases](https://github.com/Cidbzh/Quizey/releases) et téléchargez le fichier (le `.html` direct s'il y figure, sinon « Source code (zip) »). Décompressez, puis double-cliquez sur `Quizey.html`.

Une fois le fichier en votre possession, il vous appartient : clé USB, médiathèque, labo du lycée — sur n'importe quel poste.

## Licence

MIT — voir le fichier `LICENSE`.
