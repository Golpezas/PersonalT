/**
 * Meta — Editar
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MetaForm } from '@/components/forms/MetaForm';

type Params = { id: string; metaId: string };

export default function MetaEditarScreen() {
  const { id, metaId } = useLocalSearchParams<Params>();
  return <MetaForm clienteId={id} metaId={metaId} />;
}