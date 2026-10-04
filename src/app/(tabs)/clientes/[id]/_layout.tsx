/**
 * Cliente [id] Layout - Stack Navigator
 */

import { Stack } from 'expo-router';

export default function ClienteLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right' }}
    />
  );
}