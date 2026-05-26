import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

const LAST_UPDATE = '26 mai 2026'

export default function PrivacyScreen() {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#ffffff" />
        </Pressable>
        <Text style={s.headerTitle}>Politique de confidentialité</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Dernière mise à jour : {LAST_UPDATE}</Text>

        <Section title="Responsable du traitement">
          <P>Jérémy Nowak — jeremy.nowak.pro@gmail.com</P>
          <P>Kairos est une application personnelle à usage familial et privé.</P>
        </Section>

        <Section title="Données collectées">
          <P>Kairos collecte et traite les données suivantes :</P>
          <Item>Adresse e-mail et mot de passe (authentification)</Item>
          <Item>Pseudo (affiché aux membres de l'espace)</Item>
          <Item>Événements créés : titre, date, lieu, description, pièces jointes</Item>
          <Item>Messages envoyés dans l'espace</Item>
          <Item>Photos attachées aux listes de courses</Item>
          <Item>Emploi du temps (image ou PDF)</Item>
          <Item>Token de notification push (identifiant appareil)</Item>
          <Item>Historique des lieux saisis — stocké uniquement sur ton appareil, jamais transmis</Item>
        </Section>

        <Section title="Finalités et base légale">
          <P>Les données sont traitées pour permettre le fonctionnement de l'application (base légale : exécution du contrat, Art. 6(1)(b) RGPD).</P>
          <P>Le token push est utilisé pour t'envoyer une notification quand un membre de ton espace publie un message. Seule la mention "Nouveau message" est transmise — aucun contenu n'est inclus (base légale : intérêt légitime, Art. 6(1)(f) RGPD).</P>
        </Section>

        <Section title="Sous-traitants">
          <Item>Supabase Inc. (Union Européenne — Frankfurt) : hébergement de la base de données, authentification, stockage des fichiers.</Item>
          <Item>Expo (États-Unis) : relais des notifications push. Seul l'identifiant de ton appareil et le texte générique "Nouveau message" sont transmis. Aucun contenu de message.</Item>
        </Section>

        <Section title="Durée de conservation">
          <Item>Messages : supprimés automatiquement après 12 mois</Item>
          <Item>Autres données : conservées jusqu'à suppression du compte</Item>
          <Item>Historique des lieux : stocké localement sur ton appareil, supprimé avec l'app</Item>
        </Section>

        <Section title="Tes droits">
          <P>Conformément au RGPD, tu disposes des droits suivants :</P>
          <Item>Accès à tes données (Art. 15)</Item>
          <Item>Rectification (Art. 16)</Item>
          <Item>Suppression / droit à l'oubli (Art. 17) — via le bouton "Supprimer mon compte" dans le profil</Item>
          <Item>Portabilité (Art. 20) — via le bouton "Exporter mes données" dans le profil</Item>
          <Item>Opposition au traitement (Art. 21)</Item>
          <P>Pour exercer ces droits ou pour toute question : jeremy.nowak.pro@gmail.com</P>
          <P>Tu peux également introduire une réclamation auprès de la CNIL (cnil.fr).</P>
        </Section>

        <Section title="Sécurité">
          <P>Les données sont hébergées en Europe sur des serveurs sécurisés. Les fichiers sont accessibles uniquement via des liens signés temporaires. Les communications sont chiffrées en transit (TLS).</P>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.itemRow}>
      <Text style={s.bullet}>·</Text>
      <Text style={s.itemText}>{children}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.30)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },

  body: { padding: 20 },
  updated: { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 24 },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  p: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 22,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: { fontSize: 16, color: 'rgba(255,255,255,0.40)', lineHeight: 22 },
  itemText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 22 },
})
