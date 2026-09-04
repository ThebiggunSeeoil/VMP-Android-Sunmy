import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
  TextInput,
} from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { vmsApi } from '../../api/vmsApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEMS_PER_PAGE = 20;

export const HistoryScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { guardhouse } = useAppStore();

  // Selected date in YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [fetchMetrics, setFetchMetrics] = useState<{ fetchMs: number; source: string }>({
    fetchMs: 0,
    source: 'slim',
  });

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'pending' | 'missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Fetch History data for selected date
  const loadHistory = useCallback(
    async (showSpinner = true) => {
      if (!guardhouse?.serviceId) return;
      if (showSpinner) setLoading(true);

      try {
        const res = await vmsApi.getHistoryTransactions({
          service_name: guardhouse.serviceId,
          start_date: selectedDate,
          end_date: selectedDate,
        });

        if (res.status && Array.isArray(res.data)) {
          // Sort latest first by updated or created or checkin_datetime
          const sorted = [...res.data].sort((a, b) => {
            const dateA = new Date(a.updated || a.created || a.checkin_datetime || 0).getTime();
            const dateB = new Date(b.updated || b.created || b.checkin_datetime || 0).getTime();
            return dateB - dateA;
          });
          setHistoryData(sorted);
          setFetchMetrics({
            fetchMs: res.fetchMs || 0,
            source: res.source || 'slim',
          });
        } else {
          setHistoryData([]);
        }
      } catch (err) {
        console.warn('Error loading history:', err);
        setHistoryData([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [guardhouse?.serviceId, selectedDate]
  );

  useEffect(() => {
    setCurrentPage(1);
    loadHistory(true);
  }, [loadHistory]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory(false);
  }, [loadHistory]);

  // Date Navigation Helpers
  const shiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-${newD}`);
  };

  const setToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Format date display (DD/MM/YYYY)
  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${Number(y) + 543}`;
  };

  const isToday = useMemo(() => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return selectedDate === todayStr;
  }, [selectedDate]);

  // Status Categorization
  const getStatusKey = (item: any): 'done' | 'pending' | 'missing' => {
    if (!item?.checkin_datetime) return 'missing';
    return item.checkout_datetime ? 'done' : 'pending';
  };

  // Count summaries
  const statusCounts = useMemo(() => {
    const counts = { done: 0, pending: 0, missing: 0 };
    historyData.forEach((item) => {
      counts[getStatusKey(item)] += 1;
    });
    return counts;
  }, [historyData]);

  // Filtered & Searched Data
  const filteredData = useMemo(() => {
    let result = historyData;

    if (statusFilter !== 'all') {
      result = result.filter((item) => getStatusKey(item) === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        const house = (item.number_house || item.house_number_key?.house_number || '').toLowerCase();
        const name = (item.name || item.visitor_name || item.address_name || '').toLowerCase();
        const plate = (item.car_number || item.vehicle || '').toLowerCase();
        const reason = (item.reason_entry_file?.name || item.reason_entry || '').toLowerCase();
        return house.includes(q) || name.includes(q) || plate.includes(q) || reason.includes(q);
      });
    }

    return result;
  }, [historyData, statusFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Handle open item detail
  const handleItemPress = async (item: any) => {
    setSelectedItem(item);
    setDetailLoading(true);

    try {
      const detail = await vmsApi.getHistoryTransactionDetail(item.id);
      if (detail && detail.id) {
        setSelectedItem((prev: any) => ({ ...prev, ...detail, _detail_loaded: true }));
      }
    } catch (err) {
      console.warn('Detail load error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCheckoutFromDetail = (item: any) => {
    setSelectedItem(null);
    if (navigation) {
      navigation.navigate('CheckOut', { scannedCode: item.id || item.visitor_qr_code });
    }
  };

  return (
    <View style={styles.container}>
      {/* Sleek Compact Header (Saves vertical space) */}
      <View style={styles.compactHeader}>
        <View style={styles.compactHeaderLeft}>
          <View style={styles.compactHeaderIconCircle}>
            <Text style={styles.compactHeaderIconText}>🕒</Text>
          </View>
          <View>
            <Text style={styles.compactHeaderEyebrow}>HISTORY HUB</Text>
            <Text style={styles.compactHeaderTitle}>ประวัติการ เข้า : ออก</Text>
          </View>
        </View>
        <View style={styles.compactHeaderRight}>
          <Text style={styles.compactVillageBadge} numberOfLines={1}>
            {guardhouse?.villageName || guardhouse?.name || 'ป้อม รปภ.'}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
            title="กำลังอัปเดตประวัติ..."
            titleColor="#64748B"
          />
        }
      >
        {/* Summary Card (Status Badges + Date Controls + Metrics) */}
        <View style={styles.summaryCard}>
          {/* Status Row */}
          <View style={styles.summaryTopRow}>
            <View style={styles.statusBadgesRow}>
              <Text style={styles.summaryTitle}>📋 ประวัติ</Text>
              <TouchableOpacity
                style={[
                  styles.statusMiniBadge,
                  styles.badgeDone,
                  statusFilter === 'done' && styles.statusBadgeActiveDone,
                ]}
                onPress={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
                activeOpacity={0.75}
              >
                <Text style={[styles.badgeDoneText, statusFilter === 'done' && styles.badgeTextActive]}>
                  ✅ {statusCounts.done}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusMiniBadge,
                  styles.badgePending,
                  statusFilter === 'pending' && styles.statusBadgeActivePending,
                ]}
                onPress={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                activeOpacity={0.75}
              >
                <Text style={[styles.badgePendingText, statusFilter === 'pending' && styles.badgeTextActive]}>
                  🟡 {statusCounts.pending}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusMiniBadge,
                  styles.badgeMissing,
                  statusFilter === 'missing' && styles.statusBadgeActiveMissing,
                ]}
                onPress={() => setStatusFilter(statusFilter === 'missing' ? 'all' : 'missing')}
                activeOpacity={0.75}
              >
                <Text style={[styles.badgeMissingText, statusFilter === 'missing' && styles.badgeTextActive]}>
                  ❌ {statusCounts.missing}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filter Toggle Button */}
            <TouchableOpacity
              style={[styles.filterIconBtn, (statusFilter !== 'all' || searchQuery) && styles.filterIconBtnActive]}
              onPress={() => setShowFilterModal(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.filterIconBtnText}>🎛️</Text>
            </TouchableOpacity>
          </View>

          {/* Date Selector Row */}
          <View style={styles.dateControlRow}>
            <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftDate(-1)} activeOpacity={0.7}>
              <Text style={styles.dateArrowText}>◀</Text>
            </TouchableOpacity>

            <View style={styles.dateDisplayPill}>
              <Text style={styles.dateDisplayText}>{formatDisplayDate(selectedDate)} 📅</Text>
            </View>

            <TouchableOpacity style={styles.dateArrowBtn} onPress={() => shiftDate(1)} activeOpacity={0.7}>
              <Text style={styles.dateArrowText}>▶</Text>
            </TouchableOpacity>

            {!isToday && (
              <TouchableOpacity style={styles.todayBtn} onPress={setToday} activeOpacity={0.7}>
                <Text style={styles.todayBtnText}>วันนี้</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsRow}>
            <Text style={styles.metricsText}>
              {historyData.length} รายการ • โหลด {fetchMetrics.fetchMs}ms/{fetchMetrics.source}
            </Text>
            {statusFilter !== 'all' && (
              <TouchableOpacity onPress={() => setStatusFilter('all')} style={styles.clearFilterBadge}>
                <Text style={styles.clearFilterText}>
                  กรอง: {statusFilter === 'done' ? 'ออกแล้ว' : statusFilter === 'pending' ? 'ยังอยู่' : 'ไม่สมบูรณ์'} ✕
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Pagination Header Controls */}
        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              activeOpacity={0.75}
            >
              <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>
                ⬅️ ก่อนหน้า
              </Text>
            </TouchableOpacity>

            <View style={styles.pageIndicatorPill}>
              <Text style={styles.pageIndicatorText}>{currentPage} / {totalPages}</Text>
            </View>

            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              activeOpacity={0.75}
            >
              <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>
                ถัดไป ➡️
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>กำลังโหลดข้อมูลประวัติ...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredData.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>ไม่พบรายการประวัติ</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `ไม่พบผลการค้นหา "${searchQuery}" ในวันที่เลือก`
                : `ไม่มีรายการบันทึกการเข้า-ออก ในวันที่ ${formatDisplayDate(selectedDate)}`}
            </Text>
            {statusFilter !== 'all' && (
              <TouchableOpacity style={styles.resetFilterBtn} onPress={() => setStatusFilter('all')}>
                <Text style={styles.resetFilterBtnText}>แสดงทุกสถานะ</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* History Cards List */}
        {!loading &&
          paginatedData.map((item, index) => {
            const displayIndex = filteredData.length - (currentPage - 1) * ITEMS_PER_PAGE - index;
            const houseNumber = item.number_house || item.house_number_key?.house_number || '-';
            const visitorName = item.name || item.visitor_name || item.address_name || item.house_number_key?.address_name || '';
            const statusKey = getStatusKey(item);

            const checkinTime = item.checkin_datetime
              ? new Date(item.checkin_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
              : '?';
            const checkoutTime = item.checkout_datetime
              ? new Date(item.checkout_datetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
              : '?';
            const timeRange = `${checkinTime} - ${checkoutTime}`;

            const visitorType = item.visitor_type === 'qr_code'
              ? '📲 QR Code'
              : item.visitor_type === 'pass_exchange'
              ? '🪪 แลกบัตรผ่าน'
              : item.visitor_type === 'temp_qr_code'
              ? '🧾 บัตรชั่วคราว'
              : '📲 QR Code';

            const reasonName = item.reason_entry_file?.name || item.reason_entry || 'ติดต่อทั่วไป';
            const vehicleSummary = item.car_number || item.vehicle
              ? `${item.car_number || item.vehicle}${item.color_vehicle ? ` (${item.color_vehicle})` : ''}`
              : '';

            return (
              <TouchableOpacity
                key={item.id || String(index)}
                style={styles.historyCard}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.8}
              >
                {/* Card Top Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardHeadingLeft}>
                    <View style={styles.indexCircle}>
                      <Text style={styles.indexCircleText}>{displayIndex}</Text>
                    </View>
                    <View style={styles.houseTitleWrap}>
                      <Text style={styles.houseTitleText}>บ้านเลขที่: {houseNumber}</Text>
                      {Boolean(visitorName) && (
                        <Text style={styles.personNameText} numberOfLines={1}>
                          👤 คุณ {visitorName}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Status Pill */}
                  <View
                    style={[
                      styles.cardStatusPill,
                      statusKey === 'done'
                        ? styles.cardStatusDone
                        : statusKey === 'pending'
                        ? styles.cardStatusPending
                        : styles.cardStatusMissing,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardStatusText,
                        statusKey === 'done'
                          ? styles.cardStatusTextDone
                          : statusKey === 'pending'
                          ? styles.cardStatusTextPending
                          : styles.cardStatusTextMissing,
                      ]}
                    >
                      {statusKey === 'done' ? '✅ ออกแล้ว' : statusKey === 'pending' ? '🟡 ยังอยู่' : '❌ ไม่สมบูรณ์'}
                    </Text>
                  </View>
                </View>

                {/* Meta Chips Grid */}
                <View style={styles.chipsGrid}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>📅 {formatDisplayDate(selectedDate)}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>⏱️ {timeRange}</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{visitorType}</Text>
                  </View>
                  <View style={[styles.chip, styles.chipReason]}>
                    <Text style={styles.chipText} numberOfLines={1}>📝 เหตุผล: {reasonName}</Text>
                  </View>
                  {Boolean(vehicleSummary) && (
                    <View style={[styles.chip, styles.chipVehicle]}>
                      <Text style={styles.chipText} numberOfLines={1}>🚗 {vehicleSummary}</Text>
                    </View>
                  )}
                </View>

                {/* Footer Hint */}
                <View style={styles.cardFooterHint}>
                  <Text style={styles.hintText}>ℹ️ แตะเพื่อดูรายละเอียดเพิ่มเติม</Text>
                </View>
              </TouchableOpacity>
            );
          })}

        {/* Bottom Pagination */}
        {totalPages > 1 && !loading && (
          <View style={[styles.paginationRow, { marginTop: 14, marginBottom: 20 }]}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              activeOpacity={0.75}
            >
              <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>
                ⬅️ ก่อนหน้า
              </Text>
            </TouchableOpacity>

            <View style={styles.pageIndicatorPill}>
              <Text style={styles.pageIndicatorText}>{currentPage} / {totalPages}</Text>
            </View>

            <TouchableOpacity
              style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
              disabled={currentPage === totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              activeOpacity={0.75}
            >
              <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>
                ถัดไป ➡️
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal
        visible={Boolean(selectedItem)}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderEyebrow}>รายละเอียดการติดต่อ</Text>
                <Text style={styles.modalHeaderTitle}>
                  🏠 บ้านเลขที่ {selectedItem?.number_house || selectedItem?.house_number_key?.house_number || '-'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={() => setSelectedItem(null)}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailLoading && (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>กำลังโหลดข้อมูลเต็ม...</Text>
              </View>
            )}

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Photo Showcase */}
              {(selectedItem?.picture_id_card || selectedItem?.picture_car_number) && (
                <View style={styles.modalPhotosRow}>
                  {selectedItem.picture_id_card ? (
                    <TouchableOpacity
                      style={styles.modalPhotoBox}
                      onPress={() => setZoomedImage(selectedItem.picture_id_card)}
                    >
                      <Image source={{ uri: selectedItem.picture_id_card }} style={styles.modalPhotoImg} resizeMode="cover" />
                      <View style={styles.modalPhotoTag}>
                        <Text style={styles.modalPhotoTagText}>🪪 บัตรประชาชน</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  {selectedItem.picture_car_number ? (
                    <TouchableOpacity
                      style={styles.modalPhotoBox}
                      onPress={() => setZoomedImage(selectedItem.picture_car_number)}
                    >
                      <Image source={{ uri: selectedItem.picture_car_number }} style={styles.modalPhotoImg} resizeMode="cover" />
                      <View style={styles.modalPhotoTag}>
                        <Text style={styles.modalPhotoTagText}>🚗 ป้ายทะเบียน</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Status Section */}
              <View style={styles.detailSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>สถานะปัจจุบัน:</Text>
                  <Text
                    style={[
                      styles.detailValueBold,
                      getStatusKey(selectedItem) === 'done' ? styles.textGreen : styles.textYellow,
                    ]}
                  >
                    {getStatusKey(selectedItem) === 'done' ? '✅ ออกจากโครงการแล้ว' : '🟡 ยังอยู่ภายในโครงการ'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>เหตุผลการเข้า:</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem?.reason_entry_file?.name || selectedItem?.reason_entry || '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ชื่อผู้มาติดต่อ:</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem?.name || selectedItem?.visitor_name || selectedItem?.address_name || '-'}
                  </Text>
                </View>

                {Boolean(selectedItem?.id_number) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>เลขบัตรประชาชน:</Text>
                    <Text style={styles.detailValue}>{selectedItem.id_number}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ทะเบียนรถ:</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem?.car_number || selectedItem?.vehicle || '-'} {selectedItem?.color_vehicle ? `(${selectedItem.color_vehicle})` : ''}
                  </Text>
                </View>
              </View>

              {/* Timeline Section */}
              <View style={styles.detailSection}>
                <Text style={styles.sectionHeaderTitle}>⏱️ บันทึกเวลาเข้า - ออก</Text>
                <View style={styles.timelineRow}>
                  <View style={styles.timelineDotGreen} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>เวลาเข้า (Check-In)</Text>
                    <Text style={styles.timelineTime}>
                      {selectedItem?.checkin_datetime
                        ? new Date(selectedItem.checkin_datetime).toLocaleString('th-TH')
                        : '-'}
                    </Text>
                    {Boolean(selectedItem?.checkinBy?.name) && (
                      <Text style={styles.timelineGuard}>รปภ: {selectedItem.checkinBy.name}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.timelineRow}>
                  <View style={selectedItem?.checkout_datetime ? styles.timelineDotRed : styles.timelineDotGray} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>เวลาออก (Check-Out)</Text>
                    <Text style={styles.timelineTime}>
                      {selectedItem?.checkout_datetime
                        ? new Date(selectedItem.checkout_datetime).toLocaleString('th-TH')
                        : 'ยังไม่ออกจากโครงการ'}
                    </Text>
                    {Boolean(selectedItem?.checkoutBy?.name) && (
                      <Text style={styles.timelineGuard}>รปภ: {selectedItem.checkoutBy.name}</Text>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              {getStatusKey(selectedItem) === 'pending' && (
                <TouchableOpacity
                  style={styles.modalCheckoutBtn}
                  onPress={() => handleCheckoutFromDetail(selectedItem)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCheckoutBtnText}>📤 บันทึกออก (Check-Out)</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalCloseFullBtn}
                onPress={() => setSelectedItem(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseFullBtnText}>ปิดหน้าต่าง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Search / Filter Sheet Modal ── */}
      <Modal
        visible={showFilterModal}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>🎛️ ตัวกรองและค้นหา</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterBody}>
              <Text style={styles.filterLabel}>ค้นหาตามคำ (บ้านเลขที่ / ทะเบียน / ชื่อ):</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="พิมพ์คำค้นหา..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              <Text style={[styles.filterLabel, { marginTop: 14 }]}>กรองตามสถานะ:</Text>
              <View style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
                  onPress={() => setStatusFilter('all')}
                >
                  <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextActive]}>
                    ทั้งหมด ({historyData.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, statusFilter === 'done' && styles.filterPillActive]}
                  onPress={() => setStatusFilter('done')}
                >
                  <Text style={[styles.filterPillText, statusFilter === 'done' && styles.filterPillTextActive]}>
                    ✅ ออกแล้ว ({statusCounts.done})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, statusFilter === 'pending' && styles.filterPillActive]}
                  onPress={() => setStatusFilter('pending')}
                >
                  <Text style={[styles.filterPillText, statusFilter === 'pending' && styles.filterPillTextActive]}>
                    🟡 ยังอยู่ ({statusCounts.pending})
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={() => {
                  setCurrentPage(1);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.applyFilterBtnText}>นำตัวกรองไปใช้</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Fullscreen Zoomed Image Viewer ── */}
      <Modal
        visible={Boolean(zoomedImage)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setZoomedImage(null)}
      >
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.zoomCloseBtn} onPress={() => setZoomedImage(null)}>
            <Text style={styles.zoomCloseText}>✕ ปิดรูปภาพ</Text>
          </TouchableOpacity>
          {zoomedImage && <Image source={{ uri: zoomedImage }} style={styles.zoomedImg} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactHeaderIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  compactHeaderIconText: {
    fontSize: 16,
  },
  compactHeaderEyebrow: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  compactHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  compactHeaderRight: {
    maxWidth: 150,
  },
  compactVillageBadge: {
    backgroundColor: '#1E293B',
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginRight: 8,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusMiniBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgePending: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  badgeMissing: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeActiveDone: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  statusBadgeActivePending: {
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
  },
  statusBadgeActiveMissing: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  badgeDoneText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    includeFontPadding: false,
  },
  badgePendingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#854D0E',
    includeFontPadding: false,
  },
  badgeMissingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
    includeFontPadding: false,
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  filterIconBtnText: {
    fontSize: 16,
  },
  dateControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateArrowText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '800',
  },
  dateDisplayPill: {
    flex: 1,
    height: 36,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dateDisplayText: {
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '800',
  },
  todayBtn: {
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  metricsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  clearFilterBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  clearFilterText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  pageBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pageBtnTextDisabled: {
    color: '#94A3B8',
  },
  pageIndicatorPill: {
    width: 65,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageIndicatorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  loadingWrapper: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resetFilterBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  indexCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  indexCircleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  houseTitleWrap: {
    flex: 1,
  },
  houseTitleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  personNameText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '700',
    marginTop: 1,
  },
  cardStatusPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStatusDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  cardStatusPending: {
    backgroundColor: '#FEFCE8',
    borderColor: '#F59E0B',
  },
  cardStatusMissing: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  cardStatusText: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  cardStatusTextDone: {
    color: '#065F46',
  },
  cardStatusTextPending: {
    color: '#92400E',
  },
  cardStatusTextMissing: {
    color: '#991B1B',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  chipReason: {
    backgroundColor: '#FDF4FF',
    borderColor: '#F0ABFC',
  },
  chipVehicle: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  cardFooterHint: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  hintText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1E3A8A',
  },
  modalHeaderEyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#EFF6FF',
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  modalPhotosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modalPhotoBox: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalPhotoImg: {
    width: '100%',
    height: '100%',
  },
  modalPhotoTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  modalPhotoTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  detailSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '900',
  },
  textGreen: {
    color: '#059669',
  },
  textYellow: {
    color: '#D97706',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    marginTop: 4,
    marginRight: 10,
  },
  timelineDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginTop: 4,
    marginRight: 10,
  },
  timelineDotGray: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
    marginTop: 4,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  timelineTime: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  timelineGuard: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalActionRow: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  modalCheckoutBtn: {
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCheckoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseFullBtn: {
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseFullBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  filterModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
  },
  filterBody: {
    padding: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  filterInput: {
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontSize: 14,
    color: '#0F172A',
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  applyFilterBtn: {
    marginTop: 18,
    height: 46,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    zIndex: 10,
  },
  zoomCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  zoomedImg: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_WIDTH * 0.95 * 1.3,
  },
});
