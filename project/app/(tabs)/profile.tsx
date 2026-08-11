import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star, MapPin, ChevronRight } from 'lucide-react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>
      <View style={styles.profileCard}>
        <Image
          source={{ uri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2' }}
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Jessica Silva</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color="#9CA3AF" />
            <Text style={styles.locationText}>Vila Judas Tadeu, SP</Text>
          </View>
          <View style={styles.ratingRow}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>4.9 · 12 avaliações</Text>
          </View>
        </View>
      </View>
      <View style={styles.menuList}>
        {['Editar perfil', 'Histórico de pedidos', 'Pagamentos', 'Notificações', 'Ajuda', 'Sair'].map((item) => (
          <TouchableOpacity key={item} style={styles.menuRow} activeOpacity={0.8}>
            <Text style={[styles.menuText, item === 'Sair' && styles.menuTextDanger]}>{item}</Text>
            <ChevronRight size={16} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#EEF3FF' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: '#9CA3AF' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  menuList: { marginHorizontal: 20, marginTop: 20 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 8,
  },
  menuText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  menuTextDanger: { color: '#EF4444' },
});
