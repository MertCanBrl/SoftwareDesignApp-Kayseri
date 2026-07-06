import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { runTransitDecisionPipeline } from '../agents/transitDecisionPipeline';
import type { AgentPipelineResult } from '../agents/agentTypes';
import { useAuth } from '../auth/AuthContext';
import { canAccessMunicipalityDashboard } from '../auth/accessControl';
import { StatCard } from '../components/StatCard';
import { theme } from '../constants/theme';
import { useSelection } from '../context/SelectionContext';
import { useStationFaults } from '../context/StationFaultContext';
import { getTopCapacityIssues } from '../municipality/capacityIssueDetector';
import {
  formatHourLabel,
  formatOccupancyPercent,
  formatSegmentLabel,
} from '../municipality/municipalityTextUtils';
import type {
  AggregatedRecommendation,
  LowDemandIssue,
  RecommendationPriority,
  RecommendationType,
} from '../municipality/municipalityTypes';
import type { OccupancyRiskLevel } from '../segmentOccupancy/segmentOccupancyTypes';
import { buildTransitNetwork } from '../transitNetwork/buildTransitNetwork';
import type { PassengerRow, StationRecord } from '../types';

const DEMO_DATE = '2025-03-12';
const DEMO_HOUR = 17;

const STATIC_ASSUMPTIONS: readonly string[] = [
  'Yön dağılımı heuristic olarak yapılmıştır.',
  'İniş verisi olmadığı için segment dolulukları tahminidir.',
  'Kararlar nihai operasyon planı değil, karar destek önerisidir.',
];

const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  ADD_SERVICE: 'Ek sefer',
  INCREASE_FREQUENCY: 'Frekans artırımı',
  REDUCE_FREQUENCY: 'Frekans azaltımı',
  PLATFORM_GUIDANCE: 'Peron yönlendirme',
  TRANSFER_MANAGEMENT: 'Aktarma yönetimi',
  MONITORING_REQUIRED: 'İzleme',
};

const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
};

const RISK_LABELS: Record<OccupancyRiskLevel, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  OVER_CAPACITY: 'Kapasite üstü',
};

const SAMPLE_STATIONS: { stationGroupId: string; yolcuSayisi: number }[] = [
  { stationGroupId: '1006001', yolcuSayisi: 540 },
  { stationGroupId: '1006005', yolcuSayisi: 380 },
  { stationGroupId: '1006010', yolcuSayisi: 450 },
  { stationGroupId: '1006015', yolcuSayisi: 520 },
  { stationGroupId: '1006018', yolcuSayisi: 755 },
  { stationGroupId: '1006019', yolcuSayisi: 1200 },
  { stationGroupId: '1006020', yolcuSayisi: 680 },
  { stationGroupId: '1006025', yolcuSayisi: 420 },
  { stationGroupId: '1006028', yolcuSayisi: 890 },
  { stationGroupId: '1006035', yolcuSayisi: 360 },
  { stationGroupId: '1006048', yolcuSayisi: 1100 },
  { stationGroupId: '1006057', yolcuSayisi: 950 },
  { stationGroupId: '1006066', yolcuSayisi: 290 },
  { stationGroupId: '1006070', yolcuSayisi: 340 },
  { stationGroupId: '1006075', yolcuSayisi: 310 },
];

function buildDemoPassengerRows(date: string, hour: number): PassengerRow[] {
  return SAMPLE_STATIONS.map((s) => ({
    tarih: date,
    durakId: s.stationGroupId,
    durakAd: '',
    saat: hour,
    yolcuSayisi: s.yolcuSayisi,
  }));
}

function toPassengerRows(
  rows: { tarih: string; durakId: string; durakAd: string; saat: number; yolcuSayisi: number }[]
): PassengerRow[] {
  return rows.map((r) => ({
    tarih: r.tarih,
    durakId: r.durakId,
    durakAd: r.durakAd,
    saat: r.saat,
    yolcuSayisi: r.yolcuSayisi,
  }));
}

function resolvePipelineInput(
  tarih: string | undefined,
  saat: number | undefined,
  passengerRows: { tarih: string; durakId: string; durakAd: string; saat: number; yolcuSayisi: number }[]
): { date: string; hour: number; rows: PassengerRow[] } {
  const date = tarih && tarih.length > 0 ? tarih : DEMO_DATE;
  const hour = typeof saat === 'number' ? saat : DEMO_HOUR;
  const hourRows = passengerRows.filter((r) => r.saat === hour);
  const rows =
    hourRows.length > 0 ? toPassengerRows(hourRows) : buildDemoPassengerRows(date, hour);
  return { date, hour, rows };
}

function runPipelineSafe(
  date: string,
  hour: number,
  passengerRows: PassengerRow[]
): { result: AgentPipelineResult | null; error: string | null } {
  try {
    const network = buildTransitNetwork();
    const result = runTransitDecisionPipeline({ date, hour, passengerRows, network });
    return { result, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bilinmeyen pipeline hatası';
    return { result: null, error: message };
  }
}

function AccessDeniedView() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.deniedWrap}>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedTitle}>Erişim kısıtlı</Text>
          <Text style={styles.deniedBody}>
            Bu alan yalnızca belediye yetkilileri içindir.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.primaryBtnText}>Vatandaş ekranına dön</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ListRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.listRow}>{children}</View>;
}

function stripDirectionSuffix(name: string): string {
  return name.replace(/ \((Gidiş|Dönüş)\)$/, '');
}

function buildUniqueStationOptions(
  stations: StationRecord[]
): { parentDurakId: string; durakAd: string }[] {
  const map = new Map<string, string>();
  for (const s of stations) {
    if (!map.has(s.parentDurakId)) {
      map.set(s.parentDurakId, stripDirectionSuffix(s.durakAd));
    }
  }
  return [...map.entries()]
    .map(([parentDurakId, durakAd]) => ({ parentDurakId, durakAd }))
    .sort((a, b) => a.durakAd.localeCompare(b.durakAd, 'tr'));
}

function FaultManagementSection() {
  const { stations } = useSelection();
  const { faults, reportFault, clearFault } = useStationFaults();
  const stationOptions = useMemo(() => buildUniqueStationOptions(stations), [stations]);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ parentDurakId: string; durakAd: string } | null>(null);
  const [description, setDescription] = useState('');

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return stationOptions.filter((s) => s.durakAd.toLocaleLowerCase('tr').includes(q)).slice(0, 8);
  }, [query, stationOptions]);

  const canSubmit = selected != null && description.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!selected || !description.trim()) return;
    reportFault(selected.parentDurakId, selected.durakAd, description.trim());
    setSelected(null);
    setQuery('');
    setDescription('');
  }, [selected, description, reportFault]);

  return (
    <SectionCard title="Arıza Bildirimi Yönetimi">
      <Text style={styles.faultHint}>
        Arıza/aksaklık yaşanan durağı seçip açıklama girin. Kullanıcılar durağın detay
        sayfasında bu uyarıyı görür. Arıza giderildiğinde aşağıdaki listeden manuel olarak
        kaldırın.
      </Text>

      {selected ? (
        <View style={styles.selectedStationRow}>
          <Text style={styles.selectedStationText}>Seçili durak: {selected.durakAd}</Text>
          <Pressable
            onPress={() => {
              setSelected(null);
              setQuery('');
            }}
          >
            <Text style={styles.changeStationText}>Değiştir</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Durak ara..."
            placeholderTextColor={theme.textMuted}
            style={styles.faultInput}
          />
          {filteredOptions.length > 0 ? (
            <View style={styles.stationOptionList}>
              {filteredOptions.map((opt) => (
                <Pressable
                  key={opt.parentDurakId}
                  onPress={() => {
                    setSelected(opt);
                    setQuery('');
                  }}
                  style={({ pressed }) => [styles.stationOptionRow, pressed && styles.pressed]}
                >
                  <Text style={styles.stationOptionText}>{opt.durakAd}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Örn: Arıza oluştu, sürelerde değişiklik olabilir."
        placeholderTextColor={theme.textMuted}
        style={[styles.faultInput, styles.faultTextArea]}
        multiline
        numberOfLines={3}
      />

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={({ pressed }) => [
          styles.primaryBtn,
          styles.faultSubmitBtn,
          !canSubmit && styles.primaryBtnDisabled,
          pressed && canSubmit && styles.pressed,
        ]}
      >
        <Text style={styles.primaryBtnText}>Arıza Bildir</Text>
      </Pressable>

      <View style={styles.activeFaultList}>
        <Text style={styles.activeFaultListTitle}>
          Aktif arızalar{faults.length ? ` (${faults.length})` : ''}
        </Text>
        {faults.length === 0 ? (
          <Text style={styles.emptyHint}>Şu anda bildirilmiş aktif arıza yok.</Text>
        ) : (
          faults.map((fault) => (
            <View key={fault.parentDurakId} style={styles.faultRow}>
              <View style={styles.faultRowBody}>
                <Text style={styles.faultRowTitle}>{fault.durakAd}</Text>
                <Text style={styles.faultRowDesc}>{fault.description}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => clearFault(fault.parentDurakId)}
                style={({ pressed }) => [styles.clearFaultBtn, pressed && styles.pressed]}
              >
                <Text style={styles.clearFaultBtnText}>Kaldır</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </SectionCard>
  );
}

function PriorityBadge({ priority }: { priority: RecommendationPriority }) {
  const tone =
    priority === 'CRITICAL'
      ? styles.badgeCritical
      : priority === 'HIGH'
        ? styles.badgeHigh
        : priority === 'MEDIUM'
          ? styles.badgeMedium
          : styles.badgeLow;
  return (
    <View style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

function RecommendationRow({ action }: { action: AggregatedRecommendation }) {
  return (
    <ListRow>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{RECOMMENDATION_TYPE_LABELS[action.type]}</Text>
        <PriorityBadge priority={action.priority} />
      </View>
      <Text style={styles.rowMeta}>Koridor: {action.corridorLabel}</Text>
      <Text style={styles.rowBody}>{action.message}</Text>
    </ListRow>
  );
}

function RiskSegmentRow({
  fromStationName,
  toStationName,
  occupancyRate,
  riskLevel,
}: {
  fromStationName: string;
  toStationName: string;
  occupancyRate: number;
  riskLevel: OccupancyRiskLevel;
}) {
  return (
    <ListRow>
      <Text style={styles.rowTitle}>
        {formatSegmentLabel(fromStationName, toStationName)}
      </Text>
      <Text style={styles.rowMeta}>
        Doluluk: %{formatOccupancyPercent(occupancyRate)} · Risk: {RISK_LABELS[riskLevel]}
      </Text>
    </ListRow>
  );
}

function LowDemandRow({ issue }: { issue: LowDemandIssue }) {
  return (
    <ListRow>
      <Text style={styles.rowTitle}>
        {formatSegmentLabel(issue.fromStationName, issue.toStationName)}
      </Text>
      <Text style={styles.rowMeta}>
        {formatHourLabel(issue.hour)} · Doluluk: %{formatOccupancyPercent(issue.occupancyRate)}
      </Text>
      <Text style={styles.rowBody}>{issue.reason}</Text>
    </ListRow>
  );
}

function MunicipalityDashboardContent({
  pipeline,
  pipelineError,
  date,
  hour,
}: {
  pipeline: AgentPipelineResult | null;
  pipelineError: string | null;
  date: string;
  hour: number;
}) {
  const analysis = pipeline?.outputs.municipalityAnalysis;
  const executiveSummary = pipeline?.outputs.executiveSummary;
  const hasAnalysis = Boolean(analysis);

  const metrics = useMemo(() => {
    if (!analysis) {
      return {
        critical: 0,
        capacityRisk: 0,
        affectedStations: 0,
        savings: 0,
        transfer: 0,
      };
    }
    const { actionPlan, capacityIssues, report, lowDemandIssues } = analysis;
    return {
      critical: actionPlan.criticalActions.length,
      capacityRisk: capacityIssues.length,
      affectedStations: report.affectedStations.length,
      savings: actionPlan.costSavingActions.length || lowDemandIssues.filter((i) => i.suggestReduceFrequency).length,
      transfer: actionPlan.transferManagementActions.length,
    };
  }, [analysis]);

  const topCritical = analysis?.actionPlan.criticalActions.slice(0, 5) ?? [];
  const topRiskSegments = analysis
    ? getTopCapacityIssues(analysis.capacityIssues, 5)
    : [];
  const savingsLowDemand =
    analysis?.lowDemandIssues.filter((i) => i.suggestReduceFrequency).slice(0, 5) ?? [];
  const savingsActions = analysis?.actionPlan.costSavingActions.slice(0, 5) ?? [];
  const transferActions = analysis?.actionPlan.transferManagementActions.slice(0, 5) ?? [];

  const contextNotes =
    analysis?.report.contextSummary?.length
      ? analysis.report.contextSummary
      : executiveSummary?.contextNotes ?? [];

  const assumptions = useMemo(() => {
    const fromReport = analysis?.report.assumptions ?? executiveSummary?.assumptions ?? [];
    return [...new Set([...STATIC_ASSUMPTIONS, ...fromReport])];
  }, [analysis, executiveSummary]);

  const showPipelineError = Boolean(pipelineError) || pipeline?.status === 'FAILED';
  const showNoData = !pipelineError && pipeline && !hasAnalysis;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Belediye Karar Destek Paneli</Text>
          <Text style={styles.headerDate}>
            {date} · {formatHourLabel(hour)}
          </Text>
          <View style={styles.estimateTag}>
            <Text style={styles.estimateTagText}>Tahmini analiz</Text>
          </View>
        </View>

        <FaultManagementSection />

        {showPipelineError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Analiz hatası</Text>
            <Text style={styles.errorBody}>
              {pipelineError ?? pipeline?.errorMessage ?? 'Pipeline tamamlanamadı.'}
            </Text>
          </View>
        ) : null}

        {showNoData ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Analiz üretilemedi</Text>
            <Text style={styles.errorBody}>
              Seçili tarih ve saat için belediye analizi oluşturulamadı. Veri veya pipeline
              adımlarını kontrol edin.
            </Text>
          </View>
        ) : null}

        {hasAnalysis ? (
          <>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <StatCard title="Kritik aksiyon" value={String(metrics.critical)} />
              </View>
              <View style={styles.metricCell}>
                <StatCard title="Kapasite riski" value={String(metrics.capacityRisk)} subtitle="segment" />
              </View>
              <View style={styles.metricCell}>
                <StatCard title="Etkilenen durak" value={String(metrics.affectedStations)} />
              </View>
              <View style={styles.metricCell}>
                <StatCard title="Tasarruf fırsatı" value={String(metrics.savings)} />
              </View>
              <View style={[styles.metricCell, styles.metricCellWide]}>
                <StatCard title="Aktarma yönetimi" value={String(metrics.transfer)} subtitle="aksiyon" />
              </View>
            </View>

            {executiveSummary ? (
              <SectionCard title="Yönetici özeti">
                <Text style={styles.execHeadline}>{executiveSummary.headline}</Text>
                <Text style={styles.execSummary}>{executiveSummary.summary}</Text>
              </SectionCard>
            ) : null}

            <SectionCard title="Kritik aksiyonlar">
              {topCritical.length ? (
                topCritical.map((action) => (
                  <RecommendationRow key={action.id} action={action} />
                ))
              ) : (
                <Text style={styles.emptyHint}>Kritik aksiyon bulunamadı.</Text>
              )}
            </SectionCard>

            <SectionCard title="Riskli segmentler">
              {topRiskSegments.length ? (
                topRiskSegments.map((seg) => (
                  <RiskSegmentRow
                    key={seg.segmentId}
                    fromStationName={seg.fromStationName}
                    toStationName={seg.toStationName}
                    occupancyRate={seg.occupancyRate}
                    riskLevel={seg.riskLevel}
                  />
                ))
              ) : (
                <Text style={styles.emptyHint}>Riskli segment listesi boş.</Text>
              )}
            </SectionCard>

            <SectionCard title="Tasarruf fırsatları">
              {savingsLowDemand.length ? (
                savingsLowDemand.map((issue) => (
                  <LowDemandRow key={issue.segmentId} issue={issue} />
                ))
              ) : savingsActions.length ? (
                savingsActions.map((action) => (
                  <RecommendationRow key={action.id} action={action} />
                ))
              ) : (
                <Text style={styles.emptyHint}>Düşük talep / tasarruf önerisi yok.</Text>
              )}
            </SectionCard>

            <SectionCard title="Aktarma yönetimi">
              {transferActions.length ? (
                transferActions.map((action) => (
                  <RecommendationRow key={action.id} action={action} />
                ))
              ) : (
                <Text style={styles.emptyHint}>Aktarma yönetimi önerisi yok.</Text>
              )}
            </SectionCard>

            <SectionCard title="Bağlam özeti">
              {contextNotes.length ? (
                contextNotes.map((note, i) => (
                  <Text key={`ctx-${i}`} style={styles.bullet}>
                    • {note}
                  </Text>
                ))
              ) : (
                <Text style={styles.emptyHint}>Bağlam bilgisi eklenmedi.</Text>
              )}
            </SectionCard>

            <SectionCard title="Varsayımlar">
              {assumptions.map((note, i) => (
                <Text key={`asm-${i}`} style={styles.bullet}>
                  • {note}
                </Text>
              ))}
            </SectionCard>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
        >
          <Text style={styles.ghostBtnText}>Vatandaş ekranına dön</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function MunicipalityDashboardScreen() {
  const { role } = useAuth();
  const allowed = canAccessMunicipalityDashboard(role);
  const { tarih, saat, passengerRows } = useSelection();

  const { date, hour, rows } = useMemo(
    () => resolvePipelineInput(tarih, saat, passengerRows),
    [tarih, saat, passengerRows]
  );

  const { result: pipeline, error: pipelineError } = useMemo(() => {
    if (!allowed) return { result: null, error: null };
    return runPipelineSafe(date, hour, rows);
  }, [allowed, date, hour, rows]);

  if (!allowed) {
    return <AccessDeniedView />;
  }

  return (
    <MunicipalityDashboardContent
      pipeline={pipeline}
      pipelineError={pipelineError}
      date={date}
      hour={hour}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  deniedWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  deniedCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 16,
    ...theme.shadow,
  },
  deniedTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  deniedBody: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: theme.cardRadius,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.9 },
  headerCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadow,
  },
  kicker: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerDate: {
    color: theme.textSecondary,
    fontSize: 15,
    marginBottom: 12,
  },
  estimateTag: {
    alignSelf: 'flex-start',
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  estimateTagText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  metricCell: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  metricCellWide: { width: '100%' },
  section: {
    backgroundColor: theme.surface,
    borderRadius: theme.cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...theme.shadow,
  },
  sectionTitle: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sectionBody: { padding: 12, gap: 8 },
  listRow: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  rowTitle: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  rowMeta: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  rowBody: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  badgeCritical: { backgroundColor: '#DC2626' },
  badgeHigh: { backgroundColor: '#EA580C' },
  badgeMedium: { backgroundColor: '#CA8A04' },
  badgeLow: { backgroundColor: theme.textMuted },
  execHeadline: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  execSummary: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  bullet: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  emptyHint: {
    color: theme.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    padding: 4,
  },
  errorCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderRadius: theme.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorBody: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
  faultHint: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  faultInput: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.textPrimary,
    fontSize: 14,
  },
  faultTextArea: {
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  selectedStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedStationText: { color: theme.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  changeStationText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  stationOptionList: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  stationOptionRow: {
    backgroundColor: theme.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  stationOptionText: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  faultSubmitBtn: { marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.4 },
  activeFaultList: { marginTop: 6, gap: 8 },
  activeFaultListTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '700' },
  faultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DC2626',
    padding: 12,
  },
  faultRowBody: { flex: 1 },
  faultRowTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '700' },
  faultRowDesc: { color: theme.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  clearFaultBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearFaultBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
