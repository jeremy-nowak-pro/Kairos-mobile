import { View, Text, StyleSheet } from 'react-native'

export default function ShoppingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Courses</Text>
      <Text style={styles.subtitle}>À venir</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 26, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 4 },
})
