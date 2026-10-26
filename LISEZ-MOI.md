# Agenda de rendez-vous : AYOH LUXURY BOUAKÉ

Une seule application pour l'entreprise et ses employés. L'en-tête (en haut) et la barre de navigation (en bas) restent fixes : seul le contenu au milieu défile.

## Ce que l'on peut faire
- **Ajouter** (bouton doré « + ») : nom, téléphone, option WhatsApp, date, heure, urgence, remarque.
- **Agenda** : Aujourd'hui, Demain, Après-demain, avec « À recevoir » et « Terminés ». Sur chaque client : Appeler, WhatsApp (message de confirmation prêt), Terminé, Modifier, Supprimer.
- **Calendrier** : n'importe quel jour, futur ou passé.
- **Bloquer** : des jours entiers, ou seulement **certaines heures** (ex. de 12:00 à 15:00, ou le soir de 18:00 à 00:00). Boutons rapides 1 h, 2 h, 3 h, 4 h, 6 h. Jours fermés chaque semaine.
- **Réglages** : nom, heure d'ouverture et de fermeture (de 00:00 jusqu'à **minuit**), et **durée d'un rendez-vous libre en minutes** (15, 30, 45, 60, 75, 100… ce que vous voulez, 5 minutes minimum).

Numéros : « 07 00 00 00 01 » devient automatiquement +225 07 00 00 00 01. Pour un autre pays, tapez le numéro avec « + », ou changez `countryCode` dans `config.js`.

## Mettre l'application en ligne (obligatoire pour l'installer sur téléphone)
Un téléphone n'installe une application que si elle est sur un lien **https**. Deux façons simples :

**Option A : Netlify Drop (la plus rapide, 1 minute)**
1. Décompressez le zip sur un ordinateur.
2. Allez sur app.netlify.com/drop et glissez le **dossier décompressé**.
3. Netlify donne un lien https. Partagez ce lien à l'équipe.

**Option B : GitHub Pages**
1. Créez un dépôt GitHub, « Add file > Upload files », déposez **tout le contenu** du dossier (gardez `icons/`).
2. Settings > Pages > Source : *Deploy from a branch*, branche `main`, dossier `/ (root)`.
3. Après 1 à 2 minutes : `https://VOTRE-NOM.github.io/VOTRE-DEPOT/`.

## Installer sur le téléphone
- **Android (Chrome)** : ouvrez le lien, touchez « Installer » (bandeau ou Réglages), ou menu ⋮ > Installer l'application.
- **iPhone (Safari)** : ouvrez le lien dans Safari, Partager > Sur l'écran d'accueil.

## Partager les données entre tous les téléphones (Firebase, gratuit)
Sans cette étape, chaque téléphone a ses propres données.
1. console.firebase.google.com > créer un projet.
2. **Firestore Database** > Créer une base (mode production).
3. **Authentication** > Commencer > activer **E-mail/Mot de passe**. Dans Paramètres > *Domaines autorisés*, ajoutez votre domaine (ex. `VOTRE-NOM.github.io` ou `xxx.netlify.app`).
4. Authentication > Utilisateurs > **Ajouter un utilisateur** : un compte unique pour toute l'équipe.
5. Firestore > Règles : collez `firestore.rules`, Publier.
6. Paramètres du projet > Vos applications > Web `</>` : copiez `apiKey`, `authDomain`, `projectId` dans `config.js` (section `firebase`), puis remettez `config.js` en ligne.

Le lien est public : la connexion protège les noms et numéros de vos clients.
