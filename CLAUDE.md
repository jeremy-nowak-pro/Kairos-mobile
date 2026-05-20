# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm start          # Démarrage Expo (scanner QR avec Expo Go)
npm run ios        # Simulateur iOS
npm run android    # Simulateur Android
```

## Contexte projet

Kairos Mobile est la version React Native (Expo) de Kairos — une app familiale pour gérer des événements et des listes de courses.

Version web existante : `/Users/jeremy/Documents/dev/kairos` (Next.js + Supabase). Le backend Next.js est réutilisé tel quel. Cette app mobile le consomme via ses API routes.

## Architecture cible

- **Expo SDK 54**, React 19, TypeScript strict
- **Auth** : Supabase Auth (remplace le JWT custom du web)
- **Données** : Supabase directement + API routes Next.js existantes pour la logique métier
- **Notifications push** : Expo Push Notifications (remplace le webhook Discord)
- **Multi-tenant** : concept de `space` — chaque couple a son espace isolé via RLS Supabase

## Modèle de données à construire

- `spaces` — un espace par couple, avec un code d'invitation
- `space_members` — liaison user ↔ space
- `events` — ajouter `space_id` (existait sans dans le web)
- `shopping_lists` / `shopping_items` — ajouter `space_id`
- `push_tokens` — token Expo par appareil, lié à l'utilisateur

## Conventions React Native

- Pas de composants web (`<div>`, `<img>`, `<a>`) — utiliser `<View>`, `<Image>`, `<Pressable>`
- Navigation : `expo-router` (file-based, même logique que Next.js App Router)
- Styles : `StyleSheet.create()` — pas de Tailwind (non supporté nativement)
- Images : `expo-image` obligatoire — jamais `<Image>` de react-native directement
- Caméra / photos : `expo-image-picker`
- Stockage sécurisé des tokens : `expo-secure-store`

## Ce qui change par rapport au web

| Web (kairos) | Mobile (kairos-mobile) |
|---|---|
| JWT cookie httpOnly | expo-secure-store |
| `next/image` | expo-image |
| `next/link` | expo-router Link |
| FullCalendar | react-native-calendars |
| Tailwind CSS | StyleSheet.create() |
| Discord webhook | Expo Push Notifications |
