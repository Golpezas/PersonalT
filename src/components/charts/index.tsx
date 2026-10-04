/**
 * ChartKit — gráficos reales con victory-native v42 + Skia.
 *
 * Notas de API (verificadas contra victory-native 42 / skia 2.14):
 *  - victory-native v42 expone `CartesianChart` / `Line` / `Bar` / `Area`
 *    (no existen `VictoryChart` ni `VictoryLine`).
 *  - `useChartPressState` devuelve SharedValues de Reanimated: para leerlos en JS
 *    hay que espejarlos con `useAnimatedReaction` + `runOnJS`.
 *  - Los ejes necesitan un `SkFont`; `matchFont` lo resuelve con la fuente del
 *    sistema, sin cargar un .ttf.
 *  - Skia 2.x: los paths se crean con factories (`Skia.Path.Polygon`,
 *    `Skia.Path.MakeFromText`), no con `moveTo/lineTo`.
 *  - `labelPosition` acepta 'inset' | 'outset' (no 'outside').
 *  - Los puntos de `PointsArray` traen `{x, xValue, y, yValue}` (sin cx/cy).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { CartesianChart, Line, Bar, useChartPressState } from 'victory-native';
import { Canvas, Path, matchFont, Group, Skia } from '@shopify/react-native-skia';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { CHART_CONFIG } from '@/constants';

const AXIS_FONT = matchFont({ fontFamily: 'System', fontSize: 10, fontWeight: '500' });
const LABEL_FONT = matchFont({ fontFamily: 'System', fontSize: 9, fontWeight: '600' });

export interface Serie {
  key: string;
  label: string;
  color: string;
}

export type ChartDatum = Record<string, any>;

const DEFAULT_HEIGHT = 200;

// ============================================
// Legend
// ============================================
export function ChartLegend({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <View style={styles.legend}>
      {series.map((s) => (
        <View key={s.key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: s.color }]} />
          <Text style={styles.legendText}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Espeja el índice del punto pulsado del chart en estado de React.
 * Necesario porque useChartPressState expone SharedValues (UI thread).
 */
function useSelectedIndex(pressState: { matchedIndex: { value: number } }) {
  const [idx, setIdx] = useState(-1);
  useAnimatedReaction(
    () => pressState.matchedIndex.value,
    (valor, previo) => {
      if (valor !== previo) runOnJS(setIdx)(valor);
    }
  );
  return idx;
}

// ============================================
// Line chart (antropometría / fuerza)
// ============================================
export interface LineChartProps {
  data: ChartDatum[];
  xKey: string;
  series: Serie[];
  height?: number;
  formatX?: (v: any) => string;
  formatY?: (v: number) => string;
  emptyMessage?: string;
}

export function LineChart({
  data,
  xKey,
  series,
  height = DEFAULT_HEIGHT,
  formatX,
  formatY,
  emptyMessage = 'Necesitas al menos 2 mediciones' }: LineChartProps) {
  // `seriesKey` identifica el conjunto de series: evita `yKeys.join(',')` dentro
  // de las dependencias (el lint de react-hooks exige expresiones simples).
  const seriesKey = series.map((s) => s.key).join(',');
  const yKeys = series.map((s) => s.key);
  const initial = useMemo(() => {
    const obj: Record<string, number> = {};
    yKeys.forEach((k) => (obj[k] = 0));
    return obj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey]);

  const pressState = useChartPressState({ x: xKey, y: initial } as any);
  const idxSeleccionado = useSelectedIndex(pressState as any);

  const dominioY = useMemo(() => {
    const claves = seriesKey ? seriesKey.split(',') : [];
    const valores = data.flatMap((d) =>
      claves.map((k) => d[k]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    );
    if (valores.length === 0) return undefined;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    return [min - rango * 0.18, max + rango * 0.18] as [number, number];
  }, [data, seriesKey]);

  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const puntoActivo = idxSeleccionado >= 0 ? data[idxSeleccionado] : null;
  const ultimo = data[data.length - 1];
  const primero = data[0];

  return (
    <View>
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey={xKey}
          yKeys={yKeys as any}
          chartPressState={pressState as any}
          domainPadding={{ left: 18, right: 18, top: 20, bottom: 10 }}
          {...(dominioY ? { domain: { y: dominioY } } : {})}
          padding={{ left: 40, right: 14, top: 8, bottom: 6 }}
          xAxis={{
            lineColor: '#cbd5e1',
            labelColor: CHART_CONFIG.textColor,
            font: AXIS_FONT,
            tickCount: Math.min(6, data.length),
            labelPosition: 'outset',
            labelOffset: 6,
            enableRescaling: false,
            formatXLabel: formatX }}
          yAxis={[
            {
              lineColor: '#e2e8f0',
              labelColor: CHART_CONFIG.textColor,
              font: AXIS_FONT,
              tickCount: 4,
              labelPosition: 'outset',
              labelOffset: 8,
              enableRescaling: false,
              formatYLabel: (v: any) => (formatY ? formatY(v) : `${Math.round(v * 10) / 10}`) },
          ]}
          frame={{ lineColor: '#e2e8f0', lineWidth: 0 }}
        >
          {({ points }) => (
            <>
              {series.map((s) => (
                <Line
                  key={s.key}
                  points={points[s.key] as any}
                  color={s.color}
                  strokeWidth={2.5}
                  strokeCap="round"
                  strokeJoin="round"
                  curveType="natural"
                  connectMissingData
                />
              ))}
            </>
          )}
        </CartesianChart>
      </View>

      {puntoActivo ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>
            Semana {formatX ? formatX(puntoActivo[xKey]) : puntoActivo[xKey]}
          </Text>
          {series.map((s) =>
            typeof puntoActivo[s.key] === 'number' ? (
              <View key={s.key} style={styles.tooltipRow}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.tooltipLabel}>{s.label}</Text>
                <Text style={styles.tooltipValue}>
                  {formatY ? formatY(puntoActivo[s.key]) : puntoActivo[s.key]}
                </Text>
              </View>
            ) : null
          )}
        </View>
      ) : (
        <View style={styles.summaryRow}>
          {series.map((s) => {
            const ini = primero?.[s.key];
            const fin = ultimo?.[s.key];
            const cambio = typeof ini === 'number' && typeof fin === 'number' ? fin - ini : null;
            return (
              <View key={s.key} style={styles.summaryItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{fin != null ? `${Math.round(fin * 10) / 10}` : '—'}</Text>
                {cambio != null && cambio !== 0 && (
                  <Text style={[styles.summaryDelta, cambio > 0 ? styles.deltaUp : styles.deltaDown]}>
                    {cambio > 0 ? '+' : ''}
                    {Math.round(cambio * 10) / 10}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.hint}>Arrastra sobre el gráfico para ver cada punto</Text>
      <ChartLegend series={series} />
    </View>
  );
}

// ============================================
// Bar chart (volumen semanal)
// ============================================
export function BarChart({
  data,
  xKey,
  series,
  height = DEFAULT_HEIGHT,
  formatY,
  emptyMessage = 'Sin datos' }: {
  data: ChartDatum[];
  xKey: string;
  series: Serie[];
  height?: number;
  formatY?: (v: number) => string;
  emptyMessage?: string;
}) {
  const yKeys = series.map((s) => s.key);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey={xKey}
          yKeys={yKeys as any}
          domainPadding={{ left: 18, right: 18, top: 20, bottom: 10 }}
          padding={{ left: 48, right: 14, top: 8, bottom: 6 }}
          xAxis={{
            lineColor: '#cbd5e1',
            labelColor: CHART_CONFIG.textColor,
            font: AXIS_FONT,
            labelPosition: 'outset',
            labelOffset: 6,
            enableRescaling: false }}
          yAxis={[
            {
              lineColor: '#e2e8f0',
              labelColor: CHART_CONFIG.textColor,
              font: AXIS_FONT,
              tickCount: 4,
              labelPosition: 'outset',
              labelOffset: 8,
              enableRescaling: false,
              formatYLabel: (v: any) => (formatY ? formatY(v) : `${Math.round(v)}`) },
          ]}
          frame={{ lineColor: '#e2e8f0', lineWidth: 0 }}
        >
          {({ points, chartBounds }) => (
            <>
              {series.map((s) => (
                <Bar
                  key={s.key}
                  points={points[s.key] as any}
                  chartBounds={chartBounds as any}
                  color={s.color}
                  innerPadding={0.4}
                  roundedCorners={{ topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }}
                />
              ))}
            </>
          )}
        </CartesianChart>
      </View>
      <ChartLegend series={series} />
    </View>
  );
}

// ============================================
// Radar chart (perímetros) — Skia puro
// ============================================
export interface RadarSerie {
  label: string;
  color: string;
  /** Valor normalizado 0..1 por eje */
  values: number[];
}

export function RadarChart({
  labels,
  series,
  height = 260 }: {
  labels: string[];
  series: RadarSerie[];
  height?: number;
}) {
  const [ancho, setAncho] = useState(0);

  if (labels.length < 3) {
    return (
      <View style={[styles.empty, { height }]} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        <Text style={styles.emptyText}>Se necesitan al menos 3 perímetros</Text>
      </View>
    );
  }

  const n = labels.length;
  const cx = ancho / 2;
  const cy = height / 2;
  const radio = Math.max(38, Math.min(ancho / 2 - 46, height / 2 - 34));

  const puntoEn = (i: number, ratio: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(ang) * radio * ratio, y: cy + Math.sin(ang) * radio * ratio };
  };

  const poligono = (ratios: number[]) =>
    Skia.Path.Polygon(
      ratios.map((r, i) => puntoEn(i, r)),
      true
    );

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}>
      {ancho > 0 && (
        <Canvas style={styles.canvas}>
          {/* Anillos concéntricos */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <Path
              key={`anillo-${ratio}`}
              path={poligono(labels.map(() => ratio))}
              style="stroke"
              strokeWidth={1}
              color={CHART_CONFIG.gridColor}
            />
          ))}
          {/* Ejes */}
          {labels.map((label, i) => {
            const p = puntoEn(i, 1);
            return (
              <Path
                key={`eje-${label}`}
                path={Skia.Path.Polygon([{ x: cx, y: cy }, p], false)}
                style="stroke"
                strokeWidth={1}
                color={CHART_CONFIG.gridColor}
              />
            );
          })}
          {/* Series */}
          {series.map((s) => (
            <Path
              key={`fill-${s.label}`}
              path={poligono(s.values.map((v) => Math.max(0.03, Math.min(1, v))))}
              style="fill"
              color={`${s.color}2e`}
            />
          ))}
          {series.map((s) => (
            <Path
              key={`stroke-${s.label}`}
              path={poligono(s.values.map((v) => Math.max(0.03, Math.min(1, v))))}
              style="stroke"
              strokeWidth={2}
              color={s.color}
            />
          ))}
          {/* Etiquetas de los ejes */}
          {labels.map((label, i) => {
            const p = puntoEn(i, 1.2);
            const w = LABEL_FONT.measureText(label).width;
            const path = Skia.Path.MakeFromText(label, p.x - w / 2, p.y + 3, LABEL_FONT);
            return path ? <Path key={`lbl-${label}`} path={path} color={CHART_CONFIG.textColor} /> : null;
          })}
        </Canvas>
      )}
      <ChartLegend series={series.map((s) => ({ key: s.label, label: s.label, color: s.color }))} />
    </View>
  );
}

// ============================================
// Heatmap de adherencia (grilla RN, sin Skia)
// ============================================
export function Heatmap({
  data,
  colorFor }: {
  /** Record<semanaComoString, adherencia 0..5> */
  data: Record<string, number>;
  colorFor: (v: number) => string;
}) {
  const semanas = useMemo(
    () => Object.keys(data).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b),
    [data]
  );

  if (semanas.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sin datos de adherencia</Text>
      </View>
    );
  }

  const min = semanas[0];
  const max = semanas[semanas.length - 1];
  const celdas = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const promedio = Math.round((semanas.reduce((a, s) => a + (data[String(s)] ?? 0), 0) / semanas.length) * 10) / 10;

  return (
    <View>
      <View style={styles.heatmap}>
        {celdas.map((sem) => {
          const v = data[String(sem)];
          return (
            <View
              key={sem}
              style={[styles.heatCell, { backgroundColor: v != null ? colorFor(v) : '#f1f5f9' }]}
            />
          );
        })}
      </View>
      <View style={styles.heatFooter}>
        <Text style={styles.heatLabel}>Sem {min}</Text>
        <Text style={styles.heatPromedio}>Promedio {promedio}/5</Text>
        <Text style={styles.heatLabel}>Sem {max}</Text>
      </View>
      <View style={styles.heatLegend}>
        {[1, 2, 3, 4, 5].map((v) => (
          <View key={v} style={styles.heatLegendItem}>
            <View style={[styles.heatScaleCell, { backgroundColor: colorFor(v) }]} />
            <Text style={styles.heatLabel}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================
// Selector de serie
// ============================================
export function SeriesPicker({
  options,
  value,
  onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View style={styles.picker}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[styles.pickerItem, value === o.key && styles.pickerItemActive]}
        >
          <Text style={[styles.pickerText, value === o.key && styles.pickerTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#64748b'},
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8},
  tooltip: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4 },
  tooltipTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tooltipLabel: { flex: 1, fontSize: 12, color: '#64748b'},
  tooltipValue: { fontSize: 12, fontWeight: '700', color: '#0f172a'},
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  summaryItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 2 },
  summaryLabel: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#0f172a'},
  summaryDelta: { fontSize: 11, fontWeight: '600'},
  deltaUp: { color: '#22c55e' },
  deltaDown: { color: '#ef4444' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  heatCell: { width: 22, height: 22, borderRadius: 5 },
  heatFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  heatLabel: { fontSize: 10, color: '#94a3b8'},
  heatPromedio: { fontSize: 12, fontWeight: '700', color: '#0f172a'},
  heatLegend: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center' },
  heatLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heatScaleCell: { width: 13, height: 13, borderRadius: 3 },
  picker: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9' },
  pickerItemActive: { backgroundColor: '#0ea5e9' },
  pickerText: { fontSize: 12, fontWeight: '600', color: '#64748b'},
  pickerTextActive: { color: '#fff' } });