# La Donne

Appli qui tire au sort des duos, trios, quatuors ou équipes pour les jeux de cartes et de société.

## Installer l'appli sur Android

1. Sur ton téléphone, ouvre la page **Releases** du dépôt (release « apk »).
2. Touche **La-Donne.apk** pour le télécharger, puis ouvre le fichier.
3. Si le téléphone le demande, autorise « installer des applis inconnues » pour ton navigateur.

L'APK est refabriqué automatiquement par GitHub Actions à chaque modification
(`.github/workflows/android-apk.yml`). Une nouvelle version s'installe par-dessus l'ancienne
sans effacer joueurs, listes et historique.

## iPhone

Apple n'autorise pas l'installation d'un fichier d'appli sans compte développeur payant.
Il suffit d'ouvrir `www/index.html` hébergé en ligne (par exemple avec GitHub Pages) dans Safari,
puis Partager → « Sur l'écran d'accueil ».

## Contenu

- `www/index.html`, `www/style.css` : l'écran (un écran principal, Paramètres ⚙, Historique 🕘)
- `www/logic.js` : algorithme de tirage (tailles, contraintes, anti-répétition)
- `www/store.js` : données, reprise des anciennes sauvegardes, export / import
- `www/app.js` : affichage et actions
- `www/fonts/` : polices embarquées, l'appli marche sans connexion
- `tests/` : tests de la logique (`npm test`)
- `assets/` : icône et écran de démarrage
- `capacitor.config.json` : emballage Android avec Capacitor
- `android-debug.keystore` : clé de signature fixe (mot de passe `android`), pour que les mises à jour s'installent par-dessus
- `docs/superpowers/specs/` : le design de la version épurée

## Fabriquer l'APK sur son ordinateur

Il faut Node.js 22, Java 21 et le SDK Android :

```
npm ci
npm run android:prepare
cd android && ./gradlew assembleDebug
```
