import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LiffHeader } from '../../components/layout/LiffHeader';
import { LiffBottomNav } from '../../components/layout/LiffTabsAndNav';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type GuardQrPassRequest = {
  id: string;
  request_type: 'NEW' | 'DAMAGED';
  request_type_display?: string;
  house_number_text_display?: string;
  house_number_text?: string;
  reason_entry_exit_name?: string;
  status: RequestStatus;
  admin_name?: string | null;
  reject_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

const statusConfig: Record<RequestStatus, { label: string; color: string; background: string }> = {
  PENDING: { label: 'รอผู้ดูแลอนุมัติ', color: '#A16207', background: '#FEF3C7' },
  APPROVED: { label: 'อนุมัติแล้ว', color: '#047857', background: '#D1FAE5' },
  REJECTED: { label: 'ไม่อนุมัติ', color: '#B42318', background: '#FEE4E2' },
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

export const GuardQrPassRequestStatusScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { guardhouse, guard } = useAppStore();
  const [requests, setRequests] = useState<GuardQrPassRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | null>(null);

  const loadRequests = useCallback(async () => {
    if (!guardhouse?.serviceId || !guard?.id) {
      setRequests([]);
      setError('ไม่พบข้อมูล รปภ. หรือโครงการของเครื่องนี้');
      setLoading(false);
      return;
    }

    setError('');
    try {
      const items = await vmsApi.getGuardQrPassRequests(guardhouse.serviceId, guard.id);
      setRequests(items);
    } catch (requestError: any) {
      setError(requestError?.message || 'ไม่สามารถโหลดสถานะคำขอได้');
    } finally {
      setLoading(false);
    }
  }, [guard?.id, guardhouse?.serviceId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  const visibleRequests = statusFilter ? requests.filter((item) => item.status === statusFilter) : requests;

  return (
    <View style={styles.root}>
      <LiffHeader />
      <View style={styles.subHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText} numberOfLines={1}>‹ กลับหน้าหลัก</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle}>สถานะคำขอ</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRequests} tintColor="#2563EB" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>✓</Text></View>
          <View style={styles.headingTextWrap}>
            <Text style={styles.heading}>คำขอบัตร QR Code</Text>
            <Text style={styles.caption}>เฉพาะรายการที่ส่งจาก รปภ. เครื่องนี้</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          {(Object.keys(statusConfig) as RequestStatus[]).map((status) => {
            const config = statusConfig[status];
            const isActive = statusFilter === status;
            return <TouchableOpacity
              key={status}
              style={[styles.filterButton, isActive && { backgroundColor: config.background, borderColor: config.color }]}
              onPress={() => setStatusFilter(isActive ? null : status)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterText, isActive && { color: config.color }]}>{config.label}</Text>
            </TouchableOpacity>;
          })}
        </View>

        {loading && requests.length === 0 && <View style={styles.loadingWrap}><ActivityIndicator color="#2563EB" size="large" /></View>}
        {!loading && error ? <View style={styles.notice}><Text style={styles.noticeText}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); loadRequests(); }}><Text style={styles.retryText}>ลองใหม่</Text></TouchableOpacity></View> : null}
        {!loading && !error && visibleRequests.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>📋</Text><Text style={styles.emptyTitle}>{requests.length ? 'ไม่พบคำขอในสถานะนี้' : 'ยังไม่มีคำขอจากเครื่องนี้'}</Text><Text style={styles.emptyText}>{requests.length ? 'กดปุ่มสถานะเดิมอีกครั้งเพื่อแสดงรายการทั้งหมด' : 'เมื่อส่งคำขอออกบัตร QR Code แล้ว รายการจะแสดงที่นี่'}</Text></View> : null}

        {visibleRequests.map((item) => {
          const config = statusConfig[item.status] || statusConfig.PENDING;
          const typeLabel = item.request_type_display || (item.request_type === 'DAMAGED' ? 'บัตรเดิมชำรุด' : 'ขอออกบัตรใหม่');
          return <View key={item.id} style={styles.requestCard}>
            <View style={styles.cardTopRow}>
              <Text style={styles.requestType}>{typeLabel}</Text>
              <View style={[styles.statusTag, { backgroundColor: config.background }]}><Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text></View>
            </View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>บ้านเลขที่</Text><Text style={styles.detailValue}>{item.house_number_text_display || item.house_number_text || '-'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>เหตุผล</Text><Text style={styles.detailValue}>{item.reason_entry_exit_name || '-'}</Text></View>
            <View style={styles.divider} />
            <Text style={styles.timestamp}>ส่งคำขอ: {formatDateTime(item.created_at)}</Text>
            {item.status === 'APPROVED' && item.admin_name ? <Text style={styles.approvedText}>ผู้ถือบัตร: {item.admin_name}</Text> : null}
            {item.status === 'REJECTED' && item.reject_reason ? <Text style={styles.rejectedText}>เหตุผล: {item.reject_reason}</Text> : null}
          </View>;
        })}
      </ScrollView>
      <LiffBottomNav navigation={navigation} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  subHeader: { height: 58, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  backButton: { width: 114 }, backText: { fontSize: 15, fontWeight: '800', color: '#2563EB' },
  subHeaderTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center' }, headerSpacer: { width: 114 },
  content: { padding: 14, paddingBottom: 106 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  stepBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, headingTextWrap: { flex: 1 },
  heading: { fontSize: 20, fontWeight: '900', color: '#0F172A' }, caption: { marginTop: 1, fontSize: 13, color: '#64748B', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterButton: { flex: 1, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  loadingWrap: { paddingVertical: 52, alignItems: 'center' },
  requestCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#BFDBFE', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#1E3A5F', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, requestType: { color: '#0F172A', fontSize: 18, fontWeight: '900', flex: 1 },
  statusTag: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 7 }, statusText: { fontSize: 12, fontWeight: '900' },
  detailRow: { flexDirection: 'row', marginTop: 9 }, detailLabel: { color: '#64748B', width: 70, fontSize: 13, fontWeight: '700' }, detailValue: { color: '#0F172A', fontSize: 14, lineHeight: 20, fontWeight: '800', flex: 1 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 10 }, timestamp: { color: '#64748B', fontSize: 12, fontWeight: '600' }, approvedText: { color: '#047857', fontSize: 13, fontWeight: '800', marginTop: 6 }, rejectedText: { color: '#B42318', fontSize: 13, fontWeight: '800', marginTop: 6 },
  notice: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, padding: 14, alignItems: 'center' }, noticeText: { color: '#92400E', fontWeight: '700', fontSize: 14, textAlign: 'center' }, retryText: { color: '#1D4ED8', fontWeight: '900', fontSize: 14, marginTop: 8 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: '#DCEAFB' }, emptyIcon: { fontSize: 34 }, emptyTitle: { marginTop: 10, color: '#0F172A', fontSize: 17, fontWeight: '900' }, emptyText: { marginTop: 5, color: '#64748B', fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
});
