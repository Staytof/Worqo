import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Briefcase,
  Wrench,
  Sparkles,
  Send,
  MapPin,
  Star,
  ChevronRight,
  Search,
  Zap,
  Shield,
  Clock,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'conserto', label: 'Conserto', icon: Wrench, color: '#1A6BFF', bg: '#E8F0FF', active: true },
  { id: 'limpeza', label: 'Limpeza', icon: Sparkles, color: '#10B981', bg: '#D1FAE5', active: false },
  { id: 'freelas', label: 'Freelas', icon: Briefcase, color: '#F59E0B', bg: '#FEF3C7', active: false },
  { id: 'rapido', label: 'Urgente', icon: Zap, color: '#EF4444', bg: '#FEE2E2', active: false },
];

const FEATURED_WORKERS = [
  {
    id: 1,
    name: 'Carlos M.',
    role: 'Eletricista',
    rating: 4.9,
    reviews: 128,
    price: 'R$ 80/h',
    avatar: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
    badge: 'Top',
  },
  {
    id: 2,
    name: 'Ana P.',
    role: 'Faxineira',
    rating: 4.8,
    reviews: 97,
    price: 'R$ 60/h',
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
    badge: 'Popular',
  },
  {
    id: 3,
    name: 'Ricardo T.',
    role: 'Encanador',
    rating: 4.7,
    reviews: 64,
    price: 'R$ 90/h',
    avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2',
    badge: null,
  },
];

const RECENT_SERVICES = [
  { id: 1, label: 'Troca de tomada', time: '2h atrás', status: 'Concluído' },
  { id: 2, label: 'Limpeza residencial', time: 'Ontem', status: 'Concluído' },
];

export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState('conserto');
  const [serviceText, setServiceText] = useState('');
  const maxChars = 120;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>Worko</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn}>
              <Bell size={20} color="#1A6BFF" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero greeting */}
        <View style={styles.heroSection}>
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingSmall}>Olá, Jessica</Text>
              <Text style={styles.greetingBig}>Do que você precisa?</Text>
            </View>
            <TouchableOpacity style={styles.jobsBadge}>
              <Briefcase size={18} color="#1A6BFF" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <TouchableOpacity style={styles.searchBar} activeOpacity={0.8}>
            <Search size={16} color="#9CA3AF" />
            <Text style={styles.searchPlaceholder}>Buscar serviços ou profissionais...</Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    isActive && styles.categoryCardActive,
                    { backgroundColor: isActive ? cat.color : cat.bg },
                  ]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.85}
                >
                  <Icon size={22} color={isActive ? '#FFFFFF' : cat.color} strokeWidth={2} />
                  <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive, { color: isActive ? '#FFFFFF' : cat.color }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Request service card */}
        <View style={styles.section}>
          <View style={styles.requestCard}>
            <View style={styles.requestCardHeader}>
              <Text style={styles.requestCardTitle}>Descreva seu serviço</Text>
              <Text style={styles.charCount}>{serviceText.length}/{maxChars}</Text>
            </View>
            <TextInput
              style={styles.serviceInput}
              multiline
              numberOfLines={3}
              placeholder="Ex.: Meu chuveiro parou de funcionar e preciso de um eletricista urgente."
              placeholderTextColor="#C4C4C4"
              value={serviceText}
              onChangeText={(t) => setServiceText(t.slice(0, maxChars))}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                serviceText.trim().length > 0 ? styles.submitBtnActive : styles.submitBtnDisabled,
              ]}
              disabled={serviceText.trim().length === 0}
              activeOpacity={0.85}
            >
              <Text style={[styles.submitBtnText, serviceText.trim().length === 0 && styles.submitBtnTextDisabled]}>
                Solicitar serviço
              </Text>
              <Send size={16} color={serviceText.trim().length > 0 ? '#FFFFFF' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trust strip */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Shield size={16} color="#10B981" />
            <Text style={styles.trustText}>Verificados</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Star size={16} color="#F59E0B" />
            <Text style={styles.trustText}>Avaliados</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Clock size={16} color="#1A6BFF" />
            <Text style={styles.trustText}>Rápido</Text>
          </View>
        </View>

        {/* Nearby banner */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profissionais perto de você</Text>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <ChevronRight size={14} color="#1A6BFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapCard}>
            <Image
              source={{ uri: 'https://images.pexels.com/photos/29926504/pexels-photo-29926504.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' }}
              style={styles.mapImage}
              resizeMode="cover"
            />
            <View style={styles.mapOverlay}>
              <MapPin size={16} color="#FFFFFF" />
              <Text style={styles.mapOverlayText}>Vila Judas Tadeu, SP</Text>
            </View>
            <TouchableOpacity style={styles.mapExpandBtn}>
              <Text style={styles.mapExpandText}>Abrir mapa</Text>
              <ChevronRight size={14} color="#1A6BFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured workers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destaques da semana</Text>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <ChevronRight size={14} color="#1A6BFF" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workersRow}>
            {FEATURED_WORKERS.map((worker) => (
              <TouchableOpacity key={worker.id} style={styles.workerCard} activeOpacity={0.9}>
                <View style={styles.workerAvatarWrapper}>
                  <Image source={{ uri: worker.avatar }} style={styles.workerAvatar} />
                  {worker.badge && (
                    <View style={styles.workerBadge}>
                      <Text style={styles.workerBadgeText}>{worker.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.workerName}>{worker.name}</Text>
                <Text style={styles.workerRole}>{worker.role}</Text>
                <View style={styles.workerRatingRow}>
                  <Star size={11} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.workerRating}>{worker.rating}</Text>
                  <Text style={styles.workerReviews}>({worker.reviews})</Text>
                </View>
                <Text style={styles.workerPrice}>{worker.price}</Text>
                <TouchableOpacity style={styles.hireBtn}>
                  <Text style={styles.hireBtnText}>Contratar</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recent services */}
        <View style={[styles.section, styles.sectionLast]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Serviços recentes</Text>
          </View>
          {RECENT_SERVICES.map((svc) => (
            <TouchableOpacity key={svc.id} style={styles.recentRow} activeOpacity={0.8}>
              <View style={styles.recentIcon}>
                <Wrench size={16} color="#1A6BFF" />
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel}>{svc.label}</Text>
                <Text style={styles.recentTime}>{svc.time}</Text>
              </View>
              <View style={styles.recentStatusBadge}>
                <Text style={styles.recentStatusText}>{svc.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {},
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A6BFF',
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  // Hero
  heroSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingSmall: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    marginBottom: 2,
  },
  greetingBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  jobsBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  searchPlaceholder: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1,
  },

  // Categories
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionLast: {
    marginBottom: 8,
  },
  categoriesRow: {
    paddingRight: 8,
    gap: 10,
  },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    gap: 6,
    minWidth: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardActive: {
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },

  // Request card
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  serviceInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 88,
    lineHeight: 22,
    marginBottom: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  submitBtnActive: {
    backgroundColor: '#1A6BFF',
    shadowColor: '#1A6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitBtnTextDisabled: {
    color: '#9CA3AF',
  },

  // Trust strip
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  trustItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trustDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  trustText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A6BFF',
  },

  // Map card
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapImage: {
    width: '100%',
    height: 160,
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mapExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  mapExpandText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A6BFF',
  },

  // Workers
  workersRow: {
    gap: 12,
    paddingRight: 8,
  },
  workerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  workerAvatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  workerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EEF3FF',
  },
  workerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: '#1A6BFF',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  workerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  workerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  workerRole: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },
  workerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  workerRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  workerReviews: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  workerPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A6BFF',
    marginBottom: 10,
  },
  hireBtn: {
    backgroundColor: '#EEF3FF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  hireBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A6BFF',
  },

  // Recent
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
  },
  recentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  recentTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  recentStatusBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recentStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
});
