import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import * as Cellular from 'expo-cellular';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebaseConfig';
import { sendPushToRole } from '../utils/push-notifications';
import { formatCompletedTime, getTimelineDateKey } from '../utils/timeline-date';
import { useAppTheme } from '../utils/theme-context';

const CHECKPOINTS = [
  { id: 1, title: "Woke up", expected: "6:30 AM", icon: "🌅" },
  { id: 2, title: "Breakfast", expected: "7:45 AM", icon: "🍳" },
  { id: 3, title: "Left for office", expected: "8:30 AM", icon: "🚗" },
  { id: 4, title: "Reached office", expected: "9:15 AM", icon: "🏢" },
  { id: 5, title: "Lunch", expected: "1:00 PM", icon: "🍱" },
  { id: 6, title: "Evening Snack", expected: "4:30 PM", icon: "☕" },
  { id: 7, title: "Left office", expected: "6:30 PM", icon: "🏃" },
  { id: 8, title: "Reached home", expected: "7:15 PM", icon: "🏠" },
  { id: 9, title: "Sleep", expected: "10:30 PM", icon: "🌙" },
];

export default function AdminScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const [customStatusInput, setCustomStatusInput] = useState('');
  const [activeCustomStatus, setActiveCustomStatus] = useState('');
  const [logTimes, setLogTimes] = useState({});
  const [logNotes, setLogNotes] = useState({});
  const [activeEditId, setActiveEditId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(null);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [logoutConfirmText, setLogoutConfirmText] = useState('');
  const { themeMode: appThemeMode, setAppThemeMode } = useAppTheme();

  // We use the current date so it automatically resets every true morning to a fresh timeline!
  const todayDate = getTimelineDateKey();
  const ADMIN_DOC = `mohan_${todayDate}`;

  useEffect(() => {
    const loadState = async () => {
      try {
        const d = await getDoc(doc(db, "users", ADMIN_DOC));
        if (d.exists()) {
          const data = d.data();
          if (data.logs) setLogs(data.logs);
          if (data.logTimes) setLogTimes(data.logTimes);
          if (data.logNotes) setLogNotes(data.logNotes);
          if (data.locationSharing !== undefined) {
            setIsSharingLocation(data.locationSharing);
            AsyncStorage.setItem('isSharingLocation', data.locationSharing ? 'true' : 'false');
          }
          if (data.customStatus) setActiveCustomStatus(data.customStatus);
        }
      } catch (err) {
        console.error("Firebase Load", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadState();

    const syncHardware = async () => {
      try {
        // NetInfo.fetch() BYPASSES the silent caching glitch found on Android!
        const state = await NetInfo.fetch();
        const level = await Battery.getBatteryLevelAsync();
        const bstate = await Battery.getBatteryStateAsync();
        const carrierInfo = Cellular.carrier || 'No Sim';

        const brandText = Device.brand ? Device.brand.charAt(0).toUpperCase() + Device.brand.slice(1) : '';
        const modelText = Device.modelName || Device.deviceName || 'Device';
        
        await setDoc(doc(db, "users", ADMIN_DOC), {
          deviceName: brandText ? `${brandText} ${modelText}` : modelText,
          networkType: state.type === 'wifi' ? 'WIFI' : 'CELLULAR',
          networkConnected: state.isConnected,
          carrier: carrierInfo,
          batteryLevel: level > -1 ? level : 1,
          batteryState: bstate,
          timestamp: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        // ignore safe fails
      }
    };

    syncHardware();
    
    // Aggressive un-blockable 3-second heartbeat
    const timer = setInterval(syncHardware, 3000);

    const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

    const startLocationSync = async () => {
      try {
        // 1. Get foreground permission first required by Android 11+
        let fStatus = await Location.requestForegroundPermissionsAsync();
        if (fStatus.status !== 'granted') {
          console.error('Foreground location permission denied');
          return;
        }

        // 2. Get true background permission!
        let bStatus = await Location.requestBackgroundPermissionsAsync();
        if (bStatus.status !== 'granted') {
          console.error('Background location permission denied');
          return;
        }

        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced, // Saves heavy battery inside pocket
            timeInterval: 10000,                  // 10 second updates minimum
            distanceInterval: 10,                 // Only fire if they moved 10 meters perfectly
            deferredUpdatesInterval: 5000,
            showsBackgroundLocationIndicator: true, 
            foregroundService: {
              notificationTitle: "Mohan Tracker Active",
              notificationBody: "Live tracking is streaming securely to parents.",
              notificationColor: "#10B981"
            }
          });
        }
      } catch (e) {
        console.error("Task Manager Setup Error", e);
      }
    };

    startLocationSync();

    return () => {
      clearInterval(timer);
    };
  }, []);

  const toggleThemeMode = async () => {
    const next = appThemeMode === 'dark' ? 'light' : 'dark';
    await setAppThemeMode(next);
  };

  const isDark = appThemeMode === 'dark';
  const theme = {
    screenBg: isDark ? '#0F172A' : '#F2F2F7',
    headerTitle: isDark ? '#FFFFFF' : '#1C1C1E',
    subtitle: isDark ? '#94A3B8' : '#6E6E73',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    cardBorder: isDark ? '#334155' : '#E5E5EA',
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    inputBg: isDark ? '#0F172A' : '#F7F7FA',
    inputBorder: isDark ? '#334155' : '#D1D1D6',
    inputText: isDark ? '#FFFFFF' : '#1C1C1E',
    rail: isDark ? '#334155' : '#D1D1D6',
  };

  const handleLog = async (id) => {
    if (logs.includes(id)) {
      Alert.alert(
        "Unmark Checkpoint",
        "Are you sure you want to remove this log and mark it as pending?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, Unmark", style: "destructive", onPress: async () => {
              const newLogs = logs.filter(logId => logId !== id);
              const newTimes = { ...logTimes };
              delete newTimes[id];
              
              const newNotes = { ...logNotes };
              delete newNotes[id];
              
              setLogs(newLogs);
              setLogTimes(newTimes);
              setLogNotes(newNotes);
              
              try {
                await setDoc(doc(db, "users", ADMIN_DOC), { 
                  logs: newLogs,
                  logTimes: newTimes,
                  logNotes: newNotes,
                  timestamp: new Date().toISOString()
                }, { merge: true });
              } catch(e) {}
          }}
        ]
      );
      return;
    }

    const checkpoint = CHECKPOINTS.find(cp => cp.id === id);
    const checkpointTitle = checkpoint?.title || 'this checkpoint';

    Alert.alert(
      'Confirm Timeline Update',
      `Mark ${checkpointTitle} as completed?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Add Note',
          onPress: () => {
            setPendingCompletion({
              id,
              title: checkpointTitle,
              note: logNotes[id] || '',
            });
          },
        },
        {
          text: 'No Note',
          onPress: async () => {
            await completeCheckpoint(id, checkpointTitle, '');
          },
        },
      ]
    );
  };

  const completeCheckpoint = async (id, checkpointTitle, noteText) => {
    const trimmedNote = noteText.trim();
    const newLogs = [...logs, id];
    const timeNow = formatCompletedTime();
    const newTimes = { ...logTimes, [id]: timeNow };
    const newNotes = trimmedNote ? { ...logNotes, [id]: trimmedNote } : logNotes;
    const noteSuffix = trimmedNote ? `\n📝 "${trimmedNote}"` : '';
    const notificationMessage = `Mohan marked: ${checkpointTitle}${noteSuffix}`;

    setLogs(newLogs);
    setLogTimes(newTimes);
    if (trimmedNote) setLogNotes(newNotes);

    try {
      await setDoc(doc(db, "users", ADMIN_DOC), {
        logs: newLogs,
        logTimes: newTimes,
        logNotes: trimmedNote ? newNotes : logNotes,
        locationSharing: isSharingLocation,
        manualNotification: {
          id: `${Date.now()}`,
          message: notificationMessage,
          by: 'Mohan',
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString()
      }, { merge: true });

      const sent = await sendPushToRole(db, {
        role: 'parent',
        title: '✅ Timeline Update',
        body: notificationMessage,
        excludeEmail: 'bmohanbalaji1976@gmail.com',
        data: { type: 'timeline', checkpointId: id },
      });

      if (!sent) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '✅ Timeline Update',
            body: notificationMessage,
            sound: true,
          },
          trigger: null,
        });
      }

      Alert.alert('✅ Updated', `${checkpointTitle} completed${trimmedNote ? ' with note' : ''}.`);
    } catch (err) {
      console.error("Firebase Save Error:", err);
      alert("Error saving! Check if your Firestore database was created in the console.");
    }
  };

  const saveNote = async (id) => {
    const newNotes = { ...logNotes, [id]: editNoteText.trim() };
    setLogNotes(newNotes); // instant ui update
    setActiveEditId(null);
    try {
      await setDoc(doc(db, "users", ADMIN_DOC), { 
        logNotes: newNotes,
        timestamp: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  };

  const togglePrivacy = async () => {
    const newState = !isSharingLocation;
    setIsSharingLocation(newState);
    AsyncStorage.setItem('isSharingLocation', newState ? 'true' : 'false');
    
    try {
      await setDoc(doc(db, "users", ADMIN_DOC), { 
        locationSharing: newState 
      }, { merge: true });
    } catch (err) {
      console.error("Privacy Save Error:", err);
    }
  };

  const updateCustomStatus = async () => {
    if (!customStatusInput.trim()) return;
    try {
      await setDoc(doc(db, "users", ADMIN_DOC), {
        customStatus: customStatusInput.trim(),
        timestamp: new Date().toISOString()
      }, { merge: true });
      setActiveCustomStatus(customStatusInput.trim());
      setCustomStatusInput('');
    } catch (err) {
      console.error("Status Sync Error:", err);
    }
  };

  const sendNotification = async (cpId) => {
    const checkpoint = CHECKPOINTS.find(cp => cp.id === cpId);
    if (!checkpoint) return;
    
    const noteText = logNotes[cpId] ? `\n📝 "${logNotes[cpId]}"` : '';
    const notificationMessage = `Mohan marked: ${checkpoint.title}${noteText}`;
    
    Alert.alert(
      'Send Notification',
      `Send notification: "${notificationMessage}"?`,
      [
        {
          text: 'No',
          onPress: () => console.log('Notification cancelled'),
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const sent = await sendPushToRole(db, {
                role: 'parent',
                title: '✅ Timeline Update',
                body: notificationMessage,
                excludeEmail: 'bmohanbalaji1976@gmail.com',
                data: { type: 'timeline', checkpointId: cpId },
              });

              if (!sent) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '✅ Timeline Update',
                    body: notificationMessage,
                    sound: true,
                  },
                  trigger: null,
                });
              }

              await setDoc(
                doc(db, 'users', ADMIN_DOC),
                {
                  manualNotification: {
                    id: `${Date.now()}`,
                    message: notificationMessage,
                    by: 'Mohan',
                    createdAt: new Date().toISOString(),
                  },
                  timestamp: new Date().toISOString(),
                },
                { merge: true }
              );

              Alert.alert('✅ Sent', `Notification sent for ${checkpoint.title}`);
            } catch (err) {
              console.error("Notification Error:", err);
              Alert.alert('❌ Error', 'Failed to send notification');
            }
          },
          style: 'default',
        },
      ],
      { cancelable: false }
    );
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
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>My Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.themeBtn} onPress={toggleThemeMode}>
            <Text style={styles.themeBtnText}>{appThemeMode === 'dark' ? 'Light' : 'Dark'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setIsLogoutModalVisible(true)}>
            <Text style={styles.logoutText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <Text style={{color: '#94A3B8', textAlign: 'center', marginTop: 20}}>Loading secure data...</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
            {/* Privacy Toggle Widget */}
            <View style={[styles.privacyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}> 
              <View style={styles.privacyTextWrapper}>
                <Text style={[styles.privacyTitle, { color: theme.text }]}>Live Location Privacy</Text>
                <Text style={[styles.privacySubtitle, { color: theme.subtitle }]}>
                  {isSharingLocation ? "Your parents can track your location." : "Location hidden for privacy."}
                </Text>
              </View>
              <Switch 
                value={isSharingLocation}
                onValueChange={togglePrivacy}
                trackColor={{ false: '#334155', true: '#10B981' }}
                thumbColor={'#FFFFFF'}
              />
            </View>

            {/* Custom Status Broadcaster */}
            <View style={[styles.statusBroadcastCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}> 
              <Text style={[styles.broadcastTitle, { color: theme.text }]}>Broadcast Current Activity</Text>
              {activeCustomStatus ? (
                <Text style={styles.activeStatusDisplay}>Currently: "{activeCustomStatus}"</Text>
              ) : null}
              <View style={styles.broadcastInputRow}>
                <TextInput 
                  style={[styles.statusInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                  placeholder="E.g. In meeting, learning..."
                  placeholderTextColor="#64748B"
                  value={customStatusInput}
                  onChangeText={setCustomStatusInput}
                />
                <TouchableOpacity style={styles.broadcastBtn} onPress={updateCustomStatus}>
                  <Text style={styles.broadcastBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text }]}>Log Your Day</Text>
            {CHECKPOINTS.map((cp, index) => {
          const isLogged = logs.includes(cp.id);
          const isNext = !isLogged && (index === 0 || logs.includes(CHECKPOINTS[index-1].id));

          return (
            <View key={cp.id} style={styles.timelineRow}>
              <View style={styles.timelineLineContainer}>
                <View style={[styles.timelineDot, isLogged ? styles.dotLogged : (isNext ? styles.dotNext : null)]} />
                {index !== CHECKPOINTS.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: theme.rail }, isLogged ? styles.lineLogged : null]} />
                )}
              </View>

              <View style={[
                styles.checkpointCardWrapper,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                isLogged && styles.cardLogged,
                isNext && styles.cardNext
              ]}>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={styles.checkpointCardMain}
                  onPress={() => handleLog(cp.id)}
                >
                  <View style={styles.cpIconWrapper}>
                    <Text style={styles.cpIcon}>{cp.icon}</Text>
                  </View>
                  <View style={styles.cpTextWrapper}>
                    <Text style={[styles.cpTitle, { color: theme.text }, isLogged ? styles.textLogged : null]}>{cp.title}</Text>
                    <Text style={[styles.cpTime, { color: theme.subtitle }]}>Expected: {cp.expected}</Text>
                    {logNotes[cp.id] ? (
                      <Text style={styles.noteDisplay}>"{logNotes[cp.id]}"</Text>
                    ) : null}
                  </View>
                  {isLogged && (
                    <View style={styles.completedBadgeBlock}>
                      <Text style={styles.actualRecordedTime}>{logTimes[cp.id]}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <TouchableOpacity 
                          style={styles.editBtn} 
                          onPress={() => { setActiveEditId(cp.id); setEditNoteText(logNotes[cp.id] || ''); }}
                        >
                          <Text style={{fontSize: 16}}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.notifyBtn} 
                          onPress={() => sendNotification(cp.id)}
                        >
                          <Text style={{fontSize: 16}}>🔔</Text>
                        </TouchableOpacity>
                        <View style={styles.checkWrapper}>
                          <Text style={styles.checkIcon}>✓</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Inline Editing Block */}
                {activeEditId === cp.id && (
                  <View style={styles.inlineEditBlock}>
                    <TextInput
                      style={[styles.inlineEditInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                      placeholder="Add a note (e.g. had Biryani)"
                      placeholderTextColor="#64748B"
                      value={editNoteText}
                      onChangeText={setEditNoteText}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.saveNoteBtn} onPress={() => saveNote(cp.id)}>
                      <Text style={styles.saveNoteText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        <View style={{height: 120}} />
      </ScrollView>
        )}
      </View>

      <Modal
        visible={!!pendingCompletion}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingCompletion(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.noteModalCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}> 
            <Text style={styles.logoutModalTitle}>Add Completion Note</Text>
            <Text style={styles.logoutModalHint}>Optional note for {pendingCompletion?.title || 'this checkpoint'}.</Text>
            <TextInput
              style={[styles.logoutInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
              placeholder="Write a note or leave blank"
              placeholderTextColor="#64748B"
              value={pendingCompletion?.note || ''}
              onChangeText={(text) => setPendingCompletion((current) => current ? { ...current, note: text } : current)}
            />
            <View style={styles.logoutActionsRow}>
              <TouchableOpacity
                style={styles.logoutNoBtn}
                onPress={() => setPendingCompletion(null)}
              >
                <Text style={styles.logoutNoText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutYesBtn}
                onPress={async () => {
                  if (!pendingCompletion) return;
                  const { id, title, note } = pendingCompletion;
                  setPendingCompletion(null);
                  await completeCheckpoint(id, title, note || '');
                }}
              >
                <Text style={styles.logoutYesText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 },
  dateText: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  logoutText: { color: '#F87171', fontWeight: 'bold', fontSize: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  themeBtn: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.35)', marginRight: 6 },
  themeBtnText: { color: '#93C5FD', fontWeight: '700', fontSize: 13 },
  
  privacyCard: { marginHorizontal: 24, marginTop: 10, padding: 20, backgroundColor: '#1E293B', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#334155' },
  privacyTextWrapper: { flex: 1, marginRight: 16 },
  privacyTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  privacySubtitle: { fontSize: 13, color: '#94A3B8' },

  statusBroadcastCard: { marginHorizontal: 24, marginTop: 16, padding: 20, backgroundColor: '#1E293B', borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  broadcastTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF', marginBottom: 6 },
  activeStatusDisplay: { fontSize: 14, color: '#3B82F6', fontWeight: 'bold', marginBottom: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, alignSelf: 'flex-start' },
  broadcastInputRow: { flexDirection: 'row', alignItems: 'center' },
  statusInput: { flex: 1, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#FFF', marginRight: 12 },
  broadcastBtn: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  broadcastBtnText: { color: '#FFF', fontWeight: 'bold' },

  timelineScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 160, flexGrow: 1 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 15, marginLeft: 10, marginTop: 15 },
  timelineRow: { flexDirection: 'row', minHeight: 100 },
  timelineLineContainer: { width: 30, alignItems: 'center' },
  timelineDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#334155', marginTop: 34, zIndex: 2, borderWidth: 3, borderColor: '#0F172A' },
  dotLogged: { backgroundColor: '#10B981' },
  dotNext: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6', shadowOpacity: 0.8, shadowRadius: 10 },
  timelineLine: { position: 'absolute', top: 50, bottom: -34, width: 2, backgroundColor: '#334155', zIndex: 1 },
  lineLogged: { backgroundColor: '#10B981' },
  checkpointCardWrapper: { flex: 1, backgroundColor: '#1E293B', marginVertical: 12, marginLeft: 16, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  checkpointCardMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardNext: { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  cardLogged: { borderColor: '#064E3B', backgroundColor: 'rgba(16, 185, 129, 0.05)', opacity: 0.8 },
  cpIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cpIcon: { fontSize: 22 },
  cpTextWrapper: { flex: 1 },
  cpTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 4 },
  cpTime: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  noteDisplay: { fontSize: 13, color: '#3B82F6', fontStyle: 'italic', marginTop: 4, fontWeight: '600' },
  textLogged: { color: '#10B981', textDecorationLine: 'line-through' },
  completedBadgeBlock: { alignItems: 'flex-end', justifyContent: 'center' },
  actualRecordedTime: { color: '#10B981', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  editBtn: { marginRight: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
  notifyBtn: { marginRight: 10, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  checkWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.2)', justifyContent: 'center', alignItems: 'center' },
  checkIcon: { color: '#10B981', fontSize: 18, fontWeight: 'bold' },

  inlineEditBlock: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  inlineEditInput: { flex: 1, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, color: '#FFF', padding: 10, marginRight: 10 },
  saveNoteBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  saveNoteText: { color: '#FFFFFF', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoutModalCard: { width: '100%', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 18 },
  noteModalCard: { width: '100%', backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 18 },
  logoutModalTitle: { color: '#F8FAFC', fontWeight: 'bold', fontSize: 18, marginBottom: 8 },
  logoutModalHint: { color: '#94A3B8', fontSize: 13, marginBottom: 12 },
  logoutInput: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#FFFFFF', marginBottom: 14 },
  logoutActionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  logoutNoBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#334155', marginRight: 10 },
  logoutNoText: { color: '#CBD5E1', fontWeight: '600' },
  logoutYesBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.45)' },
  logoutYesText: { color: '#F87171', fontWeight: '700' }
});
