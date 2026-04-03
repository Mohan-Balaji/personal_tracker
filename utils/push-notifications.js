import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

async function ensureNotificationPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let finalStatus = current.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  return finalStatus === 'granted';
}

export async function registerPushToken(db, email, role) {
  if (!email) return null;

  try {
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    let tokenResponse;
    if (projectId) {
      tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    } else {
      tokenResponse = await Notifications.getExpoPushTokenAsync();
    }

    const token = tokenResponse?.data;
    if (!token) return null;

    const normalizedEmail = email.toLowerCase().trim();
    await setDoc(
      doc(db, 'push_tokens', normalizedEmail),
      {
        email: normalizedEmail,
        role,
        token,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return token;
  } catch (err) {
    console.warn('Push token registration failed:', err);
    return null;
  }
}

async function sendExpoMessages(messages) {
  if (!messages.length) return false;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    return response.ok;
  } catch (err) {
    console.warn('Push send failed:', err);
    return false;
  }
}

export async function sendPushToOthers(db, options) {
  const { title, body, excludeEmail, data } = options;

  try {
    const snapshot = await getDocs(collection(db, 'push_tokens'));
    const normalizedExclude = (excludeEmail || '').toLowerCase().trim();

    const messages = snapshot.docs
      .map((d) => d.data())
      .filter((item) => item?.token && item?.email && item.email !== normalizedExclude)
      .map((item) => ({
        to: item.token,
        sound: 'default',
        title,
        body,
        channelId: 'default',
        data: data || {},
      }));

    return await sendExpoMessages(messages);
  } catch (err) {
    console.warn('Push send to others failed:', err);
    return false;
  }
}

export async function sendPushToRole(db, options) {
  const { role, title, body, excludeEmail, data } = options;

  try {
    const snapshot = await getDocs(collection(db, 'push_tokens'));
    const normalizedExclude = (excludeEmail || '').toLowerCase().trim();

    const messages = snapshot.docs
      .map((d) => d.data())
      .filter(
        (item) =>
          item?.token &&
          item?.email &&
          item?.role === role &&
          item.email !== normalizedExclude
      )
      .map((item) => ({
        to: item.token,
        sound: 'default',
        title,
        body,
        channelId: 'default',
        data: data || {},
      }));

    return await sendExpoMessages(messages);
  } catch (err) {
    console.warn('Push send to role failed:', err);
    return false;
  }
}
