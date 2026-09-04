export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  role?: string;
  positionId?: number;
  positionName?: string;
  companyName?: string;
  serviceId?: string;
  serviceName?: string;
  apps?: UserAppRelation[];
}

export interface UserAppRelation {
  app_name: 'SecurityControls' | 'VisitorManagement' | 'MaintenanceFee';
  role_name: string;
  active: boolean;
  guard_position?: {
    id: number;
    guard_position: string;
    active: boolean;
  };
  guard_company?: Array<{
    id: string;
    service_name: string;
    SetOwner?: {
      owner_name: string;
      owner_short_name: string;
    };
  }>;
}

export interface GuardShift {
  id: string;
  guard_id?: string;
  serviceId?: string;
  service_name?: string;
  guardhouse_id?: string;
  guardhouse_name?: string;
  autoDoorControl?: boolean;
  autoDoorTimeSet?: number;
  service_packet_code?: string;
  guardhouse_detail?: {
    id: string;
    guardhouse_name: string;
    autoDoorControl: boolean;
    autoDoorTimeSet: number;
    ServiceName?: {
      id: string;
      service_name: string;
      ServicePacket?: {
        service_packet_code: string;
      };
    };
  };
}

export interface ReasonEntryExit {
  id: string;
  name: string;
  allow_first?: boolean;
  requires_house_number?: boolean;
  active: boolean;
  running_orderby?: number;
  icon?: string;
}

export interface FiledRequire {
  id?: string;
  service_name?: string;
  reason_entry?: boolean;
  number_house?: boolean;
  name?: boolean;
  id_number?: boolean;
  gender?: boolean;
  vehicle?: boolean;
  color_vehicle?: boolean;
  picture_id_card?: boolean;
  picture_car_number?: boolean;
  visitor_qr_code?: boolean;
}

export interface VisitorTransaction {
  id: string;
  visitor_qr_code: string;
  runningNumber?: number;
  using: boolean;
  current_transaction?: {
    id: string;
    reason_entry: string;
    number_house: string;
    name?: string;
    id_number?: string;
    vehicle?: string;
    picture_id_card?: string;
    picture_car_number?: string;
    checkin_datetime: string;
    checkout_datetime?: string | null;
    estramp_status: boolean;
    estramp_record?: string;
    reason_entry_file?: ReasonEntryExit;
  };
}

export interface CheckpointItem {
  id: string;
  name: string;
  qr_code?: string;
  nfc_tag?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  status: 'done' | 'pending' | 'cancel' | 'missed';
  checked_at?: string;
  photo_uri?: string;
  note?: string;
}

export interface CheckpointRound {
  id: string;
  title: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  points: CheckpointItem[];
  total: number;
  completed: number;
}
