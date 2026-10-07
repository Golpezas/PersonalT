/**
 * Input Component — campo de texto.
 *
 * Acepta dos modos:
 * - **controlado** (react-hook-form): pasás `control` + `name`
 * - **descontrolado**: pasás `value` + `onChange`
 *
 * Modo moderno: anillo de foco que se ilumina (borda primary), alto contraste
 * en modo oscuro y mensajes de error/ayuda alineados con el token de color.
 */

import React from 'react';
import { TextInput, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Controller } from 'react-hook-form';
import { splitLayoutStyle } from './splitLayoutStyle';

interface InputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  control?: any;
  name?: string;
  rules?: any;
  defaultValue?: unknown;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  value?: string;
  placeholderTextColor?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'numeric' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Alto compacto para grids densos */
  compact?: boolean;
  style?: any;
  [key: string]: any;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      control,
      name,
      rules,
      defaultValue,
      onChange,
      onBlur,
      placeholder,
      placeholderTextColor,
      compact = false,
      style,
      disabled,
      required,
      multiline,
      ...props
    },
    ref
  ) => {
    const t = useTheme();
    const isControlled = control && name;
    const { outerStyle, innerStyle } = splitLayoutStyle(style);

    const wrapperStyle = {
      flexDirection: 'row' as const,
      alignItems: multiline ? ('flex-start' as const) : ('center' as const),
      backgroundColor: disabled ? t.colors.surfaceAlt : t.colors.input,
      borderWidth: 1,
      borderColor: error ? t.colors.danger : t.colors.border,
      borderRadius: t.radius.md,
      paddingHorizontal: t.spacing.md,
      gap: t.spacing.sm,
      minHeight: compact ? 40 : 48,
      paddingVertical: multiline ? t.spacing.md : compact ? t.spacing.sm : t.spacing.md };

    const textStyle = {
      flex: 1,
      fontSize: 15,
      fontWeight: '500' as const,
      color: disabled ? t.colors.textSubtle : t.colors.text,
      minHeight: multiline ? (props.numberOfLines ?? 4) * 22 : compact ? 24 : 24,
      textAlignVertical: multiline ? ('top' as const) : ('center' as const),
      paddingVertical: 0 };

    const renderTextInput = (extra?: Record<string, any>) => (
      <TextInput
        ref={ref}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? t.colors.placeholder}
        multiline={multiline}
        editable={!disabled}
        style={[textStyle, innerStyle]}
        onChangeText={(v) => onChange?.(v)}
        onBlur={onBlur}
        {...props}
        {...extra}
      />
    );

    // TextInput solo muestra `value` si es string: un número (p. ej. defaultValues
    // numéricos del form) se vería vacío. Se convierte solo para mostrar; el
    // `onChangeText` sigue entregando el texto crudo.
    const body = isControlled ? (
      <Controller
        control={control}
        name={name}
        rules={rules}
        defaultValue={defaultValue}
        render={({ field }) =>
          renderTextInput({
            value:
              field.value == null || (typeof field.value === 'number' && Number.isNaN(field.value))
                ? ''
                : String(field.value),
            onChangeText: field.onChange,
            onBlur: () => {
              field.onBlur();
              onBlur?.();
            } })
        }
      />
    ) : (
      renderTextInput(
        defaultValue !== undefined && props.value === undefined
          ? { defaultValue: String(defaultValue) }
          : undefined
      )
    );

    return (
      <View style={[{ gap: 6, width: '100%' }, outerStyle]}>
        {label ? (
          <Text
            style={[
              t.typography.smallStrong,
              { color: error ? t.colors.danger : t.colors.textMuted },
            ]}
          >
            {label}
            {required ? <Text style={{ color: t.colors.danger }}> *</Text> : null}
          </Text>
        ) : null}

        <View style={wrapperStyle}>
          {leftIcon ? <View style={{ paddingLeft: 2 }}>{leftIcon}</View> : null}
          {body}
          {rightIcon ? <View style={{ paddingRight: 2 }}>{rightIcon}</View> : null}
        </View>

        {error ? (
          <Text style={[t.typography.caption, { color: t.colors.danger }]}>{error}</Text>
        ) : helperText ? (
          <Text style={[t.typography.caption, { color: t.colors.textSubtle }]}>{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';