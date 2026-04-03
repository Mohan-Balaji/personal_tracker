import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { LogBox, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from './firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

import AdminScreen from './screens/AdminScreen';
import ChatScreen from './screens/ChatScreen';
import LoginScreen from './screens/LoginScreen';
import MapScreen from './screens/MapScreen';
import TimelineScreen from './screens/TimelineScreen';
import { registerPushToken } from './utils/push-notifications';
import { getTimelineDateKey } from './utils/timeline-date';
import { ThemeProvider, useAppTheme } from './utils/theme-context';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ADMIN_EMAIL = 'bmohanbalaji1976@gmail.com';

// Universal Unread Hook
function useUnreadMessages(email) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let initialLoad = true;
    const q = query(collection(db, 'family_chat'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          
          let myName = 'Family Member';
          if (email === 'bmohanbalaji1976@gmail.com') myName = 'Mohan';
          else if (email === 'mohanbalaji801@gmail.com') myName = 'Kalaiselvi';
          else if (email === 'mohanbalaji144@gmail.com') myName = 'Baskar';

          if (msg.sender !== myName) {
            setUnread(prev => prev + 1);
            Notifications.scheduleNotificationAsync({
              content: {
                title: `New Message from ${msg.sender}`,
                body: msg.text,
                sound: true,
              },
              trigger: null,
            });
          }
        }
      });
    });
    return () => unsub();
  }, [email]);

  return { unread, setUnread };
}

// Universal Timeline Pusher for Parents
function useTimelineNotifications(email) {
  useEffect(() => {
    // Admin does not need self-notifications
    if (email === 'bmohanbalaji1976@gmail.com') return;

    let previousLogs = [];
    let previousNotes = {};
    let previousManualId = null;
    let isFirstLoad = true;

    const todayDate = getTimelineDateKey();
    const ADMIN_DOC = `mohan_${todayDate}`;

    const TICKER_DICT = {
      1: "Woke up", 2: "Breakfast", 3: "Left for office", 4: "Reached office",
      5: "Lunch", 6: "Evening Snack", 7: "Left office", 8: "Reached home", 9: "Sleep"
    };

    const unsub = onSnapshot(doc(db, "users", ADMIN_DOC), (docSnapshot) => {
      if (!docSnapshot.exists()) return;
      const data = docSnapshot.data();
      const newLogs = data.logs || [];
      const newNotes = data.logNotes || {};
      const manualNotification = data.manualNotification || null;

      if (isFirstLoad) {
        previousLogs = newLogs;
        previousNotes = newNotes;
        previousManualId = manualNotification?.id || null;
        isFirstLoad = false;
        return;
      }

      // Check for newly ticked checkpoints
      newLogs.forEach(numId => {
        if (!previousLogs.includes(numId)) {
          const title = TICKER_DICT[numId] || 'Checkpoint';
          const noteText = newNotes[numId] ? `\n📝 "${newNotes[numId]}"` : '';
          Notifications.scheduleNotificationAsync({
            content: {
              title: "✅ Timeline Update",
              body: `Mohan marked: ${title}${noteText}`,
              sound: true,
            },
            trigger: null,
          });
        }
      });

      // Check for newly edited notes on ALREADY checked checkpoints!
      Object.keys(newNotes).forEach(strId => {
        const numId = parseInt(strId, 10);
        if (previousLogs.includes(numId) && previousNotes[strId] !== newNotes[strId]) {
          const title = TICKER_DICT[numId] || 'Checkpoint';
          Notifications.scheduleNotificationAsync({
            content: {
              title: "📝 Note Added",
              body: `${title}: "${newNotes[strId]}"`,
              sound: true,
            },
            trigger: null,
          });
        }
      });

      // Manual admin-triggered notification event fallback.
      if (
        manualNotification?.id &&
        manualNotification?.message &&
        previousManualId !== manualNotification.id
      ) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 Admin Update',
            body: manualNotification.message,
            sound: true,
          },
          trigger: null,
        });
      }

      previousLogs = newLogs;
      previousNotes = newNotes;
      previousManualId = manualNotification?.id || previousManualId;
    });

    return () => unsub();
  }, [email]);
}

// Bottom Navigation for Parents
function ParentTabs({ route, navigation }) {
  const { email } = route.params || {};
  const { unread, setUnread } = useUnreadMessages(email);
  const { themeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useTimelineNotifications(email); // Active Timeline Listener

  const isDark = themeMode === 'dark';
  const isTablet = width >= 768;
  const bottomInset = isTablet
    ? (Platform.OS === 'android' ? Math.max(insets.bottom, 2) : Math.max(insets.bottom, 2))
    : (Platform.OS === 'android' ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 8));

  useEffect(() => {
    if (!email) return;
    registerPushToken(db, email, 'parent');
  }, [email]);

  // Clear unread count when focusing on the tab navigator Chat screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (e) => {
      const state = e.data.state;
      if (state) {
        const routeName = state.routes[state.index].name;
        if (routeName === 'Chat') setUnread(0);
      }
    });
    return unsubscribe;
  }, [navigation, setUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Timeline') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: isDark ? '#60A5FA' : '#2563EB',
        tabBarInactiveTintColor: isDark ? '#94A3B8' : '#6B7280',
        tabBarActiveBackgroundColor: isDark ? 'rgba(96, 165, 250, 0.08)' : '#E8F0FF',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          borderRadius: 999,
          marginHorizontal: 4,
          marginVertical: 6,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
          overflow: 'hidden',
        },
        tabBarStyle: {
          marginHorizontal: 12,
          marginBottom: bottomInset,
          backgroundColor: isDark ? '#0B1220' : '#F9F9FB',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          borderWidth: 0.8,
          borderColor: isDark ? '#243244' : '#D8DEE9',
          borderRadius: 28,
          overflow: 'hidden',
          paddingBottom: (Platform.OS === 'ios' ? 8 : 6) + Math.floor(bottomInset / 4),
          paddingTop: 7,
          height: (Platform.OS === 'ios' ? 70 : 64) + Math.floor(bottomInset / 3),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 10,
        }
      })}
    >
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        initialParams={{ email }} 
        options={{ 
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444' }
        }}
        listeners={{ tabPress: () => setUnread(0) }}
      />
    </Tab.Navigator>
  );
}

// Bottom Navigation for Admin (Mohan)
function AdminTabs({ route, navigation }) {
  const { email } = route.params || {};
  const { unread, setUnread } = useUnreadMessages(email);
  const { themeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isDark = themeMode === 'dark';
  const isTablet = width >= 768;
  const bottomInset = isTablet
    ? (Platform.OS === 'android' ? Math.max(insets.bottom, 2) : Math.max(insets.bottom, 2))
    : (Platform.OS === 'android' ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 8));

  useEffect(() => {
    if (!email) return;
    registerPushToken(db, email, 'admin');
  }, [email]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (e) => {
      const state = e.data.state;
      if (state) {
        const routeName = state.routes[state.index].name;
        if (routeName === 'Chat') setUnread(0);
      }
    });
    return unsubscribe;
  }, [navigation, setUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Live Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: isDark ? '#34D399' : '#059669',
        tabBarInactiveTintColor: isDark ? '#94A3B8' : '#6B7280',
        tabBarActiveBackgroundColor: isDark ? 'rgba(52, 211, 153, 0.08)' : '#E6FBF2',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          borderRadius: 999,
          marginHorizontal: 4,
          marginVertical: 6,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
          overflow: 'hidden',
        },
        tabBarStyle: {
          marginHorizontal: 12,
          marginBottom: bottomInset,
          backgroundColor: isDark ? '#0B1220' : '#F9F9FB',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          borderWidth: 0.8,
          borderColor: isDark ? '#243244' : '#D8DEE9',
          borderRadius: 28,
          overflow: 'hidden',
          paddingBottom: (Platform.OS === 'ios' ? 8 : 6) + Math.floor(bottomInset / 4),
          paddingTop: 7,
          height: (Platform.OS === 'ios' ? 68 : 62) + Math.floor(bottomInset / 3),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 10,
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminScreen} />
      <Tab.Screen name="Live Map" component={MapScreen} initialParams={{ isAdmin: true }} />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        initialParams={{ email }} 
        options={{ 
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444' }
        }}
        listeners={{ tabPress: () => setUnread(0) }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [themeMode, setThemeMode] = useState('dark');
  const [bootState, setBootState] = useState({
    ready: false,
    initialRoute: 'Login',
    email: null,
  });

  useEffect(() => {
    const hydrateTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appThemeMode');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeMode(savedTheme);
        }
      } catch (err) {
        // ignore
      }
    };

    hydrateTheme();
  }, []);

  const setAppThemeMode = async (nextMode) => {
    setThemeMode(nextMode);
    await AsyncStorage.setItem('appThemeMode', nextMode);
  };

  useEffect(() => {
    const hydrateSession = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('sessionEmail');
        if (savedEmail) {
          const normalizedEmail = savedEmail.toLowerCase().trim();
          const initialRoute = normalizedEmail === ADMIN_EMAIL ? 'AdminRoot' : 'ParentRoot';
          setBootState({ ready: true, initialRoute, email: normalizedEmail });
          return;
        }
      } catch (err) {
        // Fall through to Login on read errors.
      }
      setBootState({ ready: true, initialRoute: 'Login', email: null });
    };

    hydrateSession();
  }, []);

  if (!bootState.ready) return null;

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: themeMode === 'dark' ? '#0F172A' : '#F2F2F7',
      card: themeMode === 'dark' ? '#0B1220' : '#F9F9FB',
      border: themeMode === 'dark' ? '#1F2937' : '#E5E5EA',
      text: themeMode === 'dark' ? '#F8FAFC' : '#1C1C1E',
      primary: themeMode === 'dark' ? '#60A5FA' : '#2563EB',
    },
  };

  return (
    <ThemeProvider value={{ themeMode, setAppThemeMode }}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator 
          initialRouteName={bootState.initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          {/* Pass the routing to the unified Tab containers */}
          <Stack.Screen name="ParentRoot" component={ParentTabs} initialParams={{ email: bootState.email }} />
          <Stack.Screen name="AdminRoot" component={AdminTabs} initialParams={{ email: bootState.email }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

// OS-Level Background Location Engine
const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Sync Failed:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    const loc = locations[0];
    if (loc) {
      // Find today's document natively in the background thread
      const todayDate = new Date().toISOString().split('T')[0];
      const ADMIN_DOC = `mohan_${todayDate}`;
      try {
        const sharingState = await AsyncStorage.getItem('isSharingLocation');
        const updateData = {
           adminLiveLocation: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
           timestamp: new Date().toISOString()
        };
        // Explicitly duplicate coordinates to the Public payload strictly if Privacy is inactive!
        if (sharingState !== 'false') {
           updateData.liveLocation = updateData.adminLiveLocation;
        }

        await setDoc(doc(db, "users", ADMIN_DOC), updateData, { merge: true });
      } catch (err) {}
    }
  }
});
