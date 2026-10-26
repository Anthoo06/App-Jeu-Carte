# La Donne épurée : design

Date : 2026-10-26 · Fichier concerné : `www/index.html` (l'APK est refait par le workflow existant)

## Objectif

Rendre l'appli épurée, facile à comprendre, intuitive et rapide : un tirage en 1 à 2 appuis.

Usage visé, à parts égales :
- la même bande à chaque fois : cocher qui est là et tirer ;
- un nouveau groupe : taper vite une liste de prénoms.

Problème signalé : les couleurs se ressemblent toutes, on distingue mal qui est quoi.

## Structure

Un seul écran principal, sans barre d'onglets. En haut à droite :
- **⚙** ouvre les Paramètres en plein écran (flèche ← pour revenir) ;
- **🕘** ouvre l'Historique en plein écran. Ce bouton n'est visible que si « Afficher l'historique » est activé.

## Écran principal (de haut en bas)

1. **Ajout** : un champ « Prénom, Prénom… » et un bouton **+**. Les virgules, points-virgules et retours à la ligne séparent les prénoms (au collage, les retours à la ligne deviennent des virgules). Le champ est vidé après l'ajout et le clavier reste ouvert. Les doublons sont ignorés, avec un message court. Maximum 60 joueurs.
2. **Joueurs en pastilles** : un appui inverse présent ↔ absent. Un petit × sur la pastille supprime le joueur. En dessous :
   - le compteur « N présents sur M » ;
   - un lien discret « Tout effacer », qui demande confirmation par un second appui.
3. **💾 Sauvegarder** : une petite fenêtre demande un nom. Si le nom existe déjà (sans tenir compte des majuscules), la liste est mise à jour. Elle enregistre les prénoms et leur présence.
4. **📂 Charger** : une fenêtre liste les sauvegardes (nom et nombre de joueurs). Un appui charge la liste et remplace les joueurs actuels. La poubelle supprime, avec confirmation. Les contraintes qui citent un joueur disparu sont retirées.
5. **Taille des groupes**, en boutons segmentés **Duos · Trios · Autre**. « Autre » affiche un champ chiffré « joueurs par groupe » (de 2 à 10, valeur par défaut 4). La valeur choisie est mémorisée.
6. **Case « Éviter les paires déjà vues »**, juste au-dessus du bouton de tirage, **toujours visible**. Elle se base sur les tirages enregistrés en arrière-plan.
7. **Aperçu** : une ligne du type « 7 joueurs → 1 trio + 2 duos », avec « + 1 remplaçant » si besoin. Si des contraintes sont actives, une seconde ligne l'indique (« 2 contraintes actives »).
8. **TIRER AU SORT** : le seul bouton plein de l'écran, rouge vif. Les erreurs (moins de 2 présents, contraintes impossibles) s'affichent juste en dessous.
9. **Résultat** :
   - une carte par groupe, avec les prénoms en gros ;
   - chaque groupe a sa couleur franche : bande de couleur et étiquette « Groupe 1 », « Groupe 2 »… ;
   - les remplaçants sont dans une carte à part, en pointillés ;
   - les boutons sont « Copier » (texte simple) et « ★ Garder » (favori), ce dernier seulement si l'historique est affiché ;
   - un défilement automatique amène au résultat après le tirage.

## Couleurs (une couleur par rôle)

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | blanc cassé uni | presque noir |
| Bouton « Tirer au sort » | rouge vif plein | rouge vif plein |
| Joueur présent | pastille bleu foncé, texte blanc | bleu vif, texte blanc |
| Joueur absent | pastille gris clair, texte gris barré | gris foncé, texte gris barré |
| Boutons secondaires | contour fin, fond transparent | idem |
| Segment sélectionné (Duos / Trios / Autre) | fond encre, texte clair | inversé |
| Groupes du résultat | palette de 8 couleurs distinctes (rouge, bleu, vert, orange, violet, turquoise, rose, brun) qui tourne en boucle | mêmes teintes, éclaircies |

Le contraste du texte respecte au moins le niveau AA. On garde les polices embarquées : Archivo, et DM Mono pour les chiffres.

## Paramètres ⚙

**Tirage**
- **Si le compte n'est pas rond** : Agrandir des groupes (par défaut) · Un groupe plus petit · Remplaçants (mis de côté à tour de rôle).
- **Contraintes** : « À séparer » et « À réunir ». On choisit deux joueurs dans des listes, puis Ajouter. Chaque contrainte est listée avec un ×. Les contradictions sont refusées avec un message.
- **Mode suspense** : interrupteur. Les cartes arrivent face cachée ; un appui en retourne une, et le bouton « Tout révéler » les retourne toutes.

**Historique**
- Les tirages sont **toujours enregistrés** en arrière-plan (les 50 derniers, plus les favoris), pour que « Éviter les paires déjà vues » fonctionne.
- **Afficher l'historique** : interrupteur, coupé par défaut. Il ne fait que montrer ou cacher le bouton 🕘 et « ★ Garder ».

**Ambiance**
- Animation du tirage (oui par défaut).
- Vibration (oui par défaut).
- Thème : automatique, clair ou sombre.

**Sauvegarde**
- **Exporter** : un texte JSON qui contient tout (joueurs et présences, listes, contraintes, historique, tous les réglages), avec un bouton **Copier**.
- **Importer** : on colle le texte puis on touche **Importer**. L'import remplace toutes les données **y compris les réglages**, efface le résultat affiché, revient à l'écran principal et affiche « Import terminé ». **Aucun tirage n'est lancé.** Un texte invalide donne un message clair et ne change rien.
- **Tout réinitialiser**, avec confirmation par un second appui.

## Historique 🕘 (plein écran)

- La liste des tirages : date, groupes avec leur couleur, remplaçants.
- Pour chaque tirage : ★ favori, Copier, ×.
- Un filtre « Favoris seulement » et « Vider (sauf favoris) ».
- Un bloc repliable « Paires les plus fréquentes ».

## Fonctions retirées

- Le mode « par nombre d'équipes » : « Autre » le remplace.
- L'option « Équilibrer au maximum ».
- Le choix de la taille de l'historique (fixée à 50) et de la mémoire anti-répétition (tout l'historique est utilisé).
- Le choix du nom des groupes (cartes A♠ / équipes / lettres) : c'est désormais « Groupe 1, 2… » avec une couleur.
- L'interrupteur « Sauvegarde automatique » : la sauvegarde se fait toujours automatiquement.
- L'aide « Mettre sur l'écran d'accueil ».
- La barre d'onglets en bas.

## Données et compatibilité

- Clé de stockage : `la-donne:v2`. Au premier lancement, les données `la-donne:v1` sont reprises : joueurs, listes, contraintes, historique, réglages compatibles. Les valeurs retirées reprennent leur valeur par défaut.
- Les listes sauvegardées gardent désormais la présence de chaque joueur. Les anciennes listes (prénoms seuls) se chargent avec tout le monde présent.
- Un import de texte v1 est accepté, avec la même conversion.
- L'algorithme de tirage (`planSizes`, `drawGroups`…) est conservé tel quel, sans les branches `count` et `balanced` devenues inutiles.
- Le code est découpé : `www/logic.js` (tirage, pur), `www/store.js` (données, conversion v1, pur), `www/app.js` (écran), `www/style.css`. Les deux fichiers purs sont testés avec `node --test`.
- Le bouton retour d'Android ferme la fenêtre ou la page ouverte (Paramètres, Historique, Sauvegarder, Charger) au lieu de quitter l'appli : chaque couche ouverte ajoute une entrée d'historique du navigateur (`#reglages`…).

## Vérification

- Tests rapides de la logique en Node : tailles de groupes pour chaque cas de reste ; contraintes respectées ; conversion v1 → v2 ; import qui ne lance pas de tirage.
- Captures Playwright en largeur téléphone (390 px), en clair et en sombre :
  - écran principal ;
  - résultat avec 4 groupes ;
  - Paramètres ;
  - Historique ;
  - fenêtres Sauvegarder et Charger.
- Envoi sur GitHub, puis contrôle que le workflow APK est vert.

## Ajout : case « banc » (2026-10-26)

- Sur l'écran principal, sous l'aperçu, la case « Mettre N joueur(s) sur le banc » n'apparaît que si le nombre de présents ne tombe pas juste pour la taille choisie. N est le reste de la division.
- Case cochée : les joueurs en trop vont sur le banc, à tour de rôle. Case décochée : on suit le réglage « Si le compte n'est pas rond » des Paramètres, qui ne propose plus que Agrandir des groupes / Un groupe plus petit. Le choix est mémorisé (`settings.bench`).
- L'ancien réglage « Remplaçants » est converti en case cochée. « Remplaçants » devient « Sur le banc » partout.
