import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList } from 'lucide-react-native';

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pedidos</Text>
      </View>
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <ClipboardList size={36} color="#D1D5DB" />
        </View>
        <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
        <Text style={styles.emptySubtitle}>Quando você solicitar um serviço, ele aparecerá aqui.</Text>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
