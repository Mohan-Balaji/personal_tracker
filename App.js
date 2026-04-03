import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
    let isFirstLoad = true;

    const todayDate = new Date().toISOString().split('T')[0];
    const ADMIN_DOC = `mohan_${todayDate}`;

    const TICKER_DICT = {
      1: "Woke up", 2: "Breakfast", 3: "Left for office", 4: "Reached office",
      5: "Lunch", 6: "Evening Snack", 7: "Left office", 8: "Reached home"
    };

    const unsub = onSnapshot(doc(db, "users", ADMIN_DOC), (docSnapshot) => {
      if (!docSnapshot.exists()) return;
      const data = docSnapshot.data();
      const newLogs = data.logs || [];
      const newNotes = data.logNotes || {};

      if (isFirstLoad) {
        previousLogs = newLogs;
        previousNotes = newNotes;
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

      previousLogs = newLogs;
      previousNotes = newNotes;
    });

    return () => unsub();
  }, [email]);
}

// Bottom Navigation for Parents
function ParentTabs({ route, navigation }) {
  const { email } = route.params || {};
  const { unread, setUnread } = useUnreadMessages(email);
  useTimelineNotifications(email); // Active Timeline Listener

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
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: '#334155',
          paddingBottom: 5,
          paddingTop: 5,
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
        tabBarActiveTintColor: '#10B981', // Green for Admin vibe
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: '#334155',
          paddingBottom: 5,
          paddingTop: 5,
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
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        {/* Pass the routing to the unified Tab containers */}
        <Stack.Screen name="ParentRoot" component={ParentTabs} />
        <Stack.Screen name="AdminRoot" component={AdminTabs} />
      </Stack.Navigator>
    </NavigationContainer>
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
