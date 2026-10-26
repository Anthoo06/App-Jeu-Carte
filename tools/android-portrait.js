// Verrouille l'appli Android en mode portrait (l'écran est pensé pour un téléphone tenu droit).
// Lancé par « npm run android:prepare », juste après la génération du projet Android.
const fs = require('fs');
const file = 'android/app/src/main/AndroidManifest.xml';
const xml = fs.readFileSync(file, 'utf8');
if (!xml.includes('android:screenOrientation')) {
  fs.writeFileSync(file, xml.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"'));
}
