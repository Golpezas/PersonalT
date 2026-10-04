/**
 * Meta — Nueva
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MetaForm } from '@/components/forms/MetaForm';

type Params = { id: string };

export default function MetaNuevaScreen() {
  const { id } = useLocalSearchParams<Params>();
  return <MetaForm clienteId={id} />;
}