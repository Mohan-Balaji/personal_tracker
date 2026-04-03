import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { formatCompletedTime, getTimelineDateKey } from '../utils/timeline-date';
import { useAppTheme } from '../utils/theme-context';

const { width } = Dimensions.get('window');

const TICKER_LOGS = [
  { id: 1, time: "6:30 AM", event: "Woke up", icon: "🌅" },
  { id: 2, time: "7:45 AM", event: "Breakfast", icon: "🍳" },
  { id: 3, time: "8:30 AM", event: "Left for office", icon: "🚗" },
  { id: 4, time: "9:15 AM", event: "Reached office", icon: "🏢" },
  { id: 5, time: "1:00 PM", event: "Lunch", icon: "🍱" },
  { id: 6, time: "4:30 PM", event: "Evening Snack", icon: "☕" },
  { id: 7, time: "6:30 PM", event: "Left office", icon: "🏃" },
  { id: 8, time: "7:15 PM", event: "Reached home", icon: "🏠" },
  { id: 9, time: "10:30 PM", event: "Sleep", icon: "🌙" },
];

export default function TimelineScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [isLocationSharing, setIsLocationSharing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [customStatus, setCustomStatus] = useState("");
  const [logTimes, setLogTimes] = useState({});
  const [logNotes, setLogNotes] = useState({});
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [logoutConfirmText, setLogoutConfirmText] = useState('');
  const { themeMode: appThemeMode, setAppThemeMode } = useAppTheme();
  const [deviceStats, setDeviceStats] = useState({ 
    name: "Mohan's Device", 
    level: 1, 
    state: 0,
    networkType: 'CELLULAR',
    networkConnected: true,
    carrier: 'Searching...'
  });

  // Sync to the precise day so it resets automatically every day, and never randomly!
  const todayDate = getTimelineDateKey();
  const ADMIN_DOC = `mohan_${todayDate}`;

  useEffect(() => {
    // REAL-TIME SYNC
    const unsub = onSnapshot(doc(db, "users", ADMIN_DOC), (docSnapshot) => {
      setIsLoading(false);
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.logs) setLogs(data.logs);
        if (data.logTimes) setLogTimes(data.logTimes);
        if (data.logNotes) setLogNotes(data.logNotes);
        if (data.locationSharing !== undefined) setIsLocationSharing(data.locationSharing);
        if (data.customStatus) setCustomStatus(data.customStatus);
        
        setDeviceStats({
          name: data.deviceName || "Mohan's Phone",
          level: data.batteryLevel !== undefined ? data.batteryLevel : 1,
          state: data.batteryState || 0,
          networkType: data.networkType || 'CELLULAR',
          networkConnected: data.networkConnected !== false,
          carrier: data.carrier || 'No Sim'
        });
      } else {
        // No logs pushed today yet
        setLogs([]);
        setLogTimes({});
        setLogNotes({});
        setCustomStatus("");
      }
    }, (error) => {
      console.error("Realtime listener failed:", error);
    });
    return () => unsub();
  }, []);

  const toggleThemeMode = async () => {
    const next = appThemeMode === 'dark' ? 'light' : 'dark';
    await setAppThemeMode(next);
  };

  const isDark = appThemeMode === 'dark';
  const theme = {
    screenBg: isDark ? '#0F172A' : '#F2F2F7',
    headerBg: isDark ? '#1E293B' : '#FFFFFF',
    headerBorder: isDark ? '#334155' : '#D1D1D6',
    title: isDark ? '#F8FAFC' : '#1C1C1E',
    subtitle: isDark ? '#94A3B8' : '#6E6E73',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    cardBorder: isDark ? '#334155' : '#E5E5EA',
    chipBg: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EAF3FF',
    inputBg: isDark ? '#0F172A' : '#F7F7FA',
    inputBorder: isDark ? '#334155' : '#D1D1D6',
    inputText: isDark ? '#FFFFFF' : '#1C1C1E',
  };

  const handleLogout = async () => {
    if (logoutConfirmText.trim().toUpperCase() !== 'YES') {
      Alert.alert('Confirmation Required', 'Type YES to confirm logout.');
      return;
    }
    await AsyncStorage.removeItem('sessionEmail');
    setIsLogoutModalVisible(false);
    setLogoutConfirmText('');
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.screenBg }]}> 
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}> 
          <View style={styles.brandingHeader}>
            <View style={styles.brandingProfile}>
              <Image 
                source={{ uri: 'https://avatars.githubusercontent.com/u/134158954?s=400&u=b7ebd207fd6f6a08ba4c76ebb3ed1d61cb547776&v=4' }} 
                style={styles.logoImage} 
              />
              <View>
                <Text numberOfLines={1} style={[styles.brandingTitle, { color: theme.title }]}>Mohan Balaji Track</Text>
                <Text numberOfLines={1} style={styles.brandingSubtitle}>Live GPS Dashboard</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.themeBtn} onPress={toggleThemeMode}>
                <Text style={styles.themeBtnText}>{appThemeMode === 'dark' ? 'Light' : 'Dark'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={() => setIsLogoutModalVisible(true)}>
                <Ionicons name="log-out-outline" size={20} color="#F87171" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerTopLine}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.title }]}>{deviceStats.name}</Text>
              <Text style={styles.statusText}>
                🟢 Location Sync Active
              </Text>
            </View>
          </View>

          <Text style={[styles.bottomStatusTitle, { color: theme.subtitle }]}>Device Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
            <View style={[styles.metricBadge, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, !deviceStats.networkConnected && styles.badgeOffline]}>
              <Text style={styles.metricIcon}>{deviceStats.networkType === 'WIFI' ? '📶' : '📡'}</Text>
              <Text style={[styles.metricText, { color: theme.subtitle }]}> 
                {!deviceStats.networkConnected ? 'Offline' : (deviceStats.networkType === 'WIFI' ? 'Wi-Fi Connected' : `Cellular (${deviceStats.carrier})`)}
              </Text>
            </View>
            <View style={[
              styles.metricBadge,
              deviceStats.state === 2 ? styles.batteryBadgeCharging : styles.batteryBadge
            ]}>
              <Text style={styles.metricIcon}>{deviceStats.state === 2 ? '⚡' : '🔋'}</Text>
              <Text style={[styles.metricText, { color: theme.subtitle }]}> 
                {Math.round(deviceStats.level * 100)}% {deviceStats.state === 2 ? 'Charging' : 'Active'}
              </Text>
            </View>
          </ScrollView>
        </View>

        <View style={styles.content}>
          <View style={styles.timelineSectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>Daily Updates</Text>
            <Text style={[styles.sectionDate, { backgroundColor: theme.chipBg }]}> 
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          
          {isLoading ? (
            <Text style={{color: '#94A3B8', textAlign: 'center', marginTop: 20}}>Live syncing with Firebase...</Text>
          ) : (
            <>
            {customStatus ? (
              <View style={[styles.customStatusCard, { backgroundColor: theme.chipBg }]}> 
                <View style={styles.pulseIndicator} />
                <View>
                  <Text style={styles.customStatusHeader}>Currently Doing:</Text>
                  <Text style={[styles.customStatusText, { color: theme.title }]}>"{customStatus}"</Text>
                </View>
              </View>
            ) : null}

            {TICKER_LOGS.map((log, index) => {
            const isCompleted = logs.includes(log.id);
            const isCurrent = !isCompleted && (index === 0 || logs.includes(TICKER_LOGS[index-1].id));

            return (
              <View key={log.id} style={[styles.logCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }, isCompleted && styles.logCardCompleted, isCurrent && styles.logCardCurrent]}>
                <View style={styles.logLeft}>
                  {isCompleted ? (
                    <View style={styles.checkWrapper}>
                      <Text style={styles.checkIcon}>✓</Text>
                    </View>
                  ) : (
                    <View style={[styles.iconCircle, isCurrent && styles.iconCircleCurrent]}>
                      <Text style={styles.emoji}>{log.icon}</Text>
                    </View>
                  )}
                  <View style={styles.titleColumn}>
                    <Text style={[styles.logEvent, { color: theme.title }, isCompleted && styles.logEventCompleted]}>{log.event}</Text>
                    {isCompleted && logTimes[log.id] && (
                      <Text style={styles.actualTimeText}>Done at {logTimes[log.id]}</Text>
                    )}
                    {isCompleted && logNotes[log.id] && (
                      <Text style={styles.timelineNoteText}>Note: {logNotes[log.id]}</Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.logTime, { color: theme.subtitle }]}>{log.time}</Text>
              </View>
            );
            })}

            <View style={{ height: 8 }} />
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.logoutModalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}> 
            <Text style={styles.logoutModalTitle}>Confirm Logout</Text>
            <Text style={styles.logoutModalHint}>Type YES, then tap Yes to logout.</Text>
            <TextInput
              style={[styles.logoutInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              placeholder="Type YES"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              value={logoutConfirmText}
              onChangeText={setLogoutConfirmText}
            />
            <View style={styles.logoutActionsRow}>
              <TouchableOpacity
                style={styles.logoutNoBtn}
                onPress={() => {
                  setIsLogoutModalVisible(false);
                  setLogoutConfirmText('');
                }}
              >
                <Text style={styles.logoutNoText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutYesBtn} onPress={handleLogout}>
                <Text style={styles.logoutYesText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scrollContent: { paddingBottom: 128 },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  
  brandingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  brandingProfile: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  logoImage: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#3B82F6', marginRight: 10 },
  brandingTitle: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC' },
  brandingSubtitle: { fontSize: 11, color: '#3B82F6', fontWeight: 'bold', letterSpacing: 0.3 },

  headerTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  statusText: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  themeBtn: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.35)', marginRight: 4 },
  themeBtnText: { color: '#93C5FD', fontWeight: '700', fontSize: 12 },
  
  metricsRow: { flexDirection: 'row', gap: 12, paddingBottom: 5 },
  metricBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginRight: 12 },
  batteryBadge: { borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  batteryBadgeCharging: { borderColor: 'rgba(245, 158, 11, 0.5)', backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  badgeOffline: { borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  metricIcon: { fontSize: 16, marginRight: 8 },
  metricText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  bottomStatusTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 10, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.8 },

  content: { flex: 1, padding: 20 },
  timelineSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  sectionDate: { fontSize: 13, color: '#3B82F6', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden' },
  
  customStatusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#3B82F6' },
  pulseIndicator: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6', marginRight: 16, shadowColor: '#3B82F6', shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  customStatusHeader: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold', marginBottom: 4 },
  customStatusText: { fontSize: 18, color: '#F8FAFC', fontWeight: 'bold' },

  logCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  logCardCompleted: { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' },
  logCardCurrent: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: '#3B82F6' },
  
  logLeft: { flexDirection: 'row', alignItems: 'center' },
  checkWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  checkIcon: { color: '#10B981', fontSize: 16, fontWeight: 'bold' },
  
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconCircleCurrent: { backgroundColor: '#3B82F6' },
  emoji: { fontSize: 16 },
  
  titleColumn: { justifyContent: 'center' },
  logEvent: { fontSize: 16, color: '#F8FAFC', fontWeight: '600' },
  logEventCompleted: { color: '#10B981', textDecorationLine: 'line-through', marginBottom: 2 },
  actualTimeText: { color: '#10B981', fontSize: 13, fontWeight: 'bold' },
  timelineNoteText: { color: '#3B82F6', fontSize: 13, fontStyle: 'italic', fontWeight: '600', marginTop: 3 },
  logTime: { fontSize: 14, color: '#94A3B8', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoutModalCard: { width: '100%', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 18 },
  logoutModalTitle: { color: '#F8FAFC', fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  logoutModalHint: { color: '#94A3B8', fontSize: 13, marginBottom: 12 },
  logoutInput: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#FFFFFF', marginBottom: 14 },
  logoutActionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  logoutNoBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginRight: 10 },
  logoutNoText: { color: '#CBD5E1', fontWeight: '600' },
  logoutYesBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.45)' },
  logoutYesText: { color: '#F87171', fontWeight: '700' }
});
