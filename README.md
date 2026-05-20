# Kairos Mobile

Application mobile pour gérer le quotidien à deux — événements, listes de courses, rappels. Compagnon de [kairos](../kairos) (version web Next.js).

Conçu pour les couples, partenaires et collocataires. Chaque groupe partage un espace isolé avec des droits égaux pour tous les membres.

## Stack

- Expo SDK 54 / React Native
- React 19, TypeScript strict
- Supabase (auth + base de données)
- expo-router (navigation file-based)
- pnpm

## Prérequis

- Node.js 20+
- pnpm
- [Expo Go](https://expo.dev/go) sur ton téléphone

## Démarrage

```bash
pnpm install
pnpm start
```

Scanner le QR code avec Expo Go.

## Variables d'environnement

Créer un fichier `.env.local` à la racine :

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Structure

```
app/          # Écrans (expo-router, file-based)
lib/          # Supabase client, utilitaires
assets/       # Images, fonts
context/      # React context providers
```

## Fonctionnalités

- Espaces partagés — créer ou rejoindre via code d'invitation
- Événements communs avec notifications push
- Listes de courses synchronisées en temps réel

## Relation avec la version web

Le backend Supabase est partagé. Les politiques RLS garantissent l'isolation des espaces. Les API routes Next.js existantes sont consommées pour la logique métier.
