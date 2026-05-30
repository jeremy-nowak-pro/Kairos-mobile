# CLAUDE.md — kairos-mobile

App familiale React Native (Expo) pour gérer des événements partagés, listes de courses et chat en temps réel. Multi-tenant via le concept de `space` (un espace par couple/famille).

---

## Commandes

```bash
npm start          # Expo dev server (QR code → Expo Go)
npm run ios        # Simulateur iOS
npm run android    # Simulateur Android
npm test           # Jest
```

> **Expo HAS CHANGED** — avant d'écrire du code, consulter les docs versionnées : https://docs.expo.dev/versions/v54.0.0/

---

## Stack technique

| Couche | Tech |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19 |
| Language | TypeScript strict (`@/*` alias → racine) |
| Routing | Expo Router 6 (file-based, même logique que Next.js App Router) |
| Backend | Supabase (Auth + PostgreSQL + Realtime + Storage) |
| Auth tokens | `expo-secure-store` avec chunking (limite 2KB contournée) |
| Images | `expo-image` (jamais `<Image>` de react-native) |
| Icônes | `@expo/vector-icons` — Ionicons |
| Animations | Expo `Animated` API (pas de Reanimated) |
| Styles | `StyleSheet.create()` — pas de Tailwind, pas de NativeWind |
| Tests | Jest + jest-expo preset |
| Build | EAS Build (dev / preview / production) |

---

## Architecture

### Navigation (Expo Router)

```
app/
├── index.tsx           # Guard: redirige selon auth + space
├── _layout.tsx         # Root: AuthProvider + SpaceProvider
├── (auth)/             # Stack — login, register
├── (onboarding)/       # Stack — create space, join space
└── (app)/              # Tabs — app principale (protégée)
    ├── events/         # Liste, détail, création, édition
    ├── calendar.tsx    # Vue mois
    ├── shopping.tsx    # Listes de courses
    └── profile/        # Profil, membres, emplois du temps
```

**Flux de redirection dans `app/index.tsx` :**
1. Pas de session → `/(auth)/login`
2. Session sans space → `/(onboarding)`
3. Session + space → `/(app)/events`

### State management

Uniquement React Context — pas de Redux, pas de Zustand.

- **`context/auth.tsx`** — `useAuth()` : session, user, displayName, signIn/signUp/signOut
- **`context/space.tsx`** — `useSpace()` : espace courant, refresh()

Les deux hooks throwent si utilisés hors de leur Provider.

### Data layer (`lib/`)

Chaque fichier expose des fonctions async typées qui appellent Supabase directement. Pas de BFF, pas de middleware.

| Fichier | Responsabilité |
|---|---|
| `supabase.ts` | Client Supabase + adapteur SecureStore chunké |
| `spaces.ts` | Création/jointure d'espace via RPC Supabase |
| `events.ts` | CRUD événements, cascade delete (attachments + storage) |
| `shopping.ts` | Listes/items + **cache local** (expo-file-system) + photos |
| `chat.ts` | Messages, subscription Realtime, compteur non-lus |
| `attachments.ts` | Upload/delete fichiers → bucket `event-attachments` |
| `schedules.ts` | PDFs emplois du temps → bucket `schedules` (upsert par user) |
| `notifications.ts` | Token Expo push, envoi via `exp.host/--/api/v2/push/send` |
| `locations.ts` | Historique lieux autocomplete (tri par `used_count`) |
| `imageCache.ts` | Cache URLs signées Supabase Storage |
| `userColor.ts` | Couleur déterministe par nom (cycle de 4) |

**Pattern offline (shopping) :** écriture cache silencieuse, fallback sur `Documents/sc_*.json` en cas d'erreur réseau.

### Auth (Supabase)

- Email/password standard
- `expo-secure-store` avec chunking maison (clés `${key}.0`, `${key}.1`... par blocs de 1900 octets)
- `display_name` stocké dans `user_metadata` Supabase
- `detectSessionInUrl: false` (pas de parsing d'URL deep link)

### RLS

Toutes les tables sont protégées par Row-Level Security Supabase. Chaque requête est automatiquement scopée au `space_id` de l'utilisateur connecté. Ne jamais bypasser le client Supabase avec la service key côté client.

### Tables principales

- `spaces` — espace avec code d'invitation
- `space_members` — liaison user ↔ space
- `events` + `event_attachments` — événements du space
- `shopping_lists` + `shopping_items` — listes avec photos optionnelles
- `chat_messages` + `chat_reads` — messagerie temps réel
- `push_tokens` — tokens Expo par appareil
- `schedules` — emplois du temps (PDFs/images)
- `location_history` — historique lieux autocomplete

---

## Conventions React Native

- Jamais `<div>`, `<img>`, `<a>` — utiliser `<View>`, `<Image from expo-image>`, `<Pressable>`
- Styles : `StyleSheet.create()` uniquement
- Images : `expo-image` obligatoire
- Navigation : `expo-router` — `Link`, `useRouter()`, `useLocalSearchParams()`
- Animations : `Animated` d'expo — pas de bibliothèque externe
- Dates : `toLocaleDateString('fr-FR', {...})` — interface en français

## Design system — thème sombre (glassmorphisme)

L'app utilise un thème sombre avec un fond mesh-gradient animé et des surfaces en verre.

### Fond

```
Bg base          #070818   fond quasi-noir, derrière tout
Mesh gradient    palette analogue bleu-indigo-violet (5 couches sinusoïdales animées)
  — bleu royal   #2248b8
  — bleu-indigo  #3530b0
  — indigo       #4a1aaa
  — cobalt       #1a3cba
  — violet       #5e16a2
```

### GlassCard (composant `components/GlassCard.tsx`)

Technique de bordure dégradée — **ne pas recréer manuellement, utiliser le composant**.

```
Outer wrapper    LinearGradient diagonal  rgba(255,255,255,0.52) → rgba(255,255,255,0.07)
                 borderRadius: 15, padding: 1   ← c'est la "bordure"
Inner view       borderRadius: 14, overflow: 'hidden'
BlurView         intensity: 4, tint: 'light'  (absoluteFill)
Specular         LinearGradient top  rgba(255,255,255,0.18) → transparent  height 80
Depth            LinearGradient bottom  transparent → rgba(0,0,20,0.12)   height 50
```

Props :
- `style` — styles sur l'outer LinearGradient (margin, flex, sizing)
- `contentStyle` — styles sur l'inner View (padding, flexDirection)

Ne jamais mettre `padding` sur `style` — ça écraserait le `padding: 1` de la bordure.

### Surfaces modales / drawers

Pour les sheets et drawers (pas les cards) :

```
Bg               rgba(8, 16, 48, 0.92)
Overlay optionnel rgba(12, 6, 28, 0.82)  (sur BlurView intensity 55 tint dark)
Border           rgba(140, 170, 255, 0.20)  hairlineWidth
```

### Séparateurs

Standard unique dans toute l'app :

```
height: 1
backgroundColor: 'rgba(255,255,255,0.28)'
```

Pour les séparateurs de listes d'items (inset) : ajouter `marginLeft: 56` pour aligner après l'icône/avatar.

### Headers d'écran

```
paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20
borderBottomWidth: StyleSheet.hairlineWidth
borderBottomColor: 'rgba(255,255,255,0.30)'
Title  fontSize: 28, fontWeight: '700', color: '#ffffff'
```

### Texte

```
Primaire         #ffffff
Secondaire       rgba(255,255,255,0.75)
Tertiaire        rgba(255,255,255,0.45)
Labels section   fontSize 11, fontWeight 600, rgba(255,255,255,0.75), letterSpacing 0.8
Placeholder      rgba(255,255,255,0.35)
```

### Actions

```
Bouton principal  bg rgba(37,99,235,0.80)  border rgba(120,160,255,0.35)  hairlineWidth
Bouton secondaire bg rgba(25,55,140,0.5)   border rgba(120,160,255,0.3)   hairlineWidth
Texte bouton      rgba(255,255,255,0.95)
Input bg          rgba(255,255,255,0.08)   border rgba(140,170,255,0.20)  hairlineWidth
```

### États

```
Error            #e05555
Success          #34c759
Primary          #2563EB  (badges, hors contexte glass)
```

### Chat — bulles

```
Bulle propre     bg rgba(37,99,235,0.80)   border rgba(120,160,255,0.35)  texte #ffffff
Bulle autre      bg rgba(255,255,255,0.10)  border rgba(255,255,255,0.15)  texte rgba(220,232,255,0.95)
Nom expéditeur   rgba(180,200,255,0.60)  fontSize 11
Heure            rgba(255,255,255,0.35)   fontSize 10
```

### Règles

- `BlurView` toujours avec `overflow: 'hidden'` sur le conteneur parent
- Bordures : `StyleSheet.hairlineWidth` uniquement, jamais `borderWidth: 1`
- Pas de `shadow-*` — le verre se distingue par la bordure et le blur, pas l'ombre
- Le fond mesh-gradient est le seul endroit avec de la couleur saturée ; le reste de l'UI reste sobre
- Couleur accentuation unique : bleu `#2563EB` / `rgba(37,99,235,…)`

---

## Composants notables

| Composant | Description |
|---|---|
| `GlassCard` | Carte verre — bordure dégradée (LinearGradient padding:1) + BlurView intensity 4 |
| `ChatPanel` | Drawer droit animé, pan gesture, subscription Realtime. Fond rgba(8,16,48,0.92) |
| `TimePicker` | Scroll snap custom (pas de lib) |
| `CalendarPicker` | Modal date picker custom |
| `LocationInput` | Autocomplete avec historique local |
| `AttachmentSection` | Upload + liste fichiers event |

---

## Build & deploy

- **EAS Build** : `development` (APK interne) / `preview` (APK interne) / `production` (stores)
- Android package : `com.jeremypro.kairosmobile`
- EAS project ID : `ad4c8d9b-3498-474a-9173-066087734c73`
- Push notifications : nécessite un **native dev build** (pas Expo Go)
- Nouvelle architecture React Native activée (`newArchEnabled: true`)

---

## Projet web associé

`/Users/jeremy/Documents/dev/kairos` — Next.js + Supabase, même base de données.
