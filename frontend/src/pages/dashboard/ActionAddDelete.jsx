import React, { useState, useEffect, useRef } from 'react';
import { getBackendUrl, authedFetch } from '../../utils/api';
import ActionHistoryLog from './ActionHistoryLog';

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const addMinutesToTime = (time, minutesToAdd) => {
  if (!time) return '';
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';

  const totalMinutes = (hour * 60 + minute + minutesToAdd + 24 * 60) % (24 * 60);
  const nextHour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const nextMinute = String(totalMinutes % 60).padStart(2, '0');
  return `${nextHour}:${nextMinute}`;
};

const parseTimeToParts = (time) => {
  const [hourStr = '00', minuteStr = '00'] = (time || '00:00').split(':');
  return {
    hour: Number(hourStr),
    minute: Number(minuteStr)
  };
};

const formatTimeParts = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const DEFAULT_MAP_CENTER = { lat: 25.0478, lng: 121.5170 };
const DEFAULT_STATION_COORDS = { lat: 25.0, lng: 121.0 };
const LEAFLET_CSS_ID = 'leaflet-cdn-css';
const LEAFLET_JS_ID = 'leaflet-cdn-js';

let leafletAssetsPromise = null;
const geocodeCache = new Map();

const ensureLeafletAssets = () => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.L) return Promise.resolve(true);
  if (leafletAssetsPromise) return leafletAssetsPromise;

  leafletAssetsPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.L) resolve(true);
      else reject(new Error('Leaflet 載入失敗'));
    };

    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (document.getElementById(LEAFLET_JS_ID)) {
      finish();
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_JS_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error('Leaflet 載入失敗'));
    document.head.appendChild(script);
  });

  return leafletAssetsPromise;
};

const geocodeOpenStreetMap = async (query) => {
  const text = String(query || '').trim();
  if (!text) return null;

  if (geocodeCache.has(text)) {
    return geocodeCache.get(text);
  }

  const baseUrl = await getBackendUrl();
  const res = await fetch(`${baseUrl}/api/admin/stations/geocode?q=${encodeURIComponent(text)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status >= 500) {
      const error = new Error(payload?.message || '地圖定位服務暫時無法使用');
      error.code = 'GEOCODE_SERVICE_UNAVAILABLE';
      throw error;
    }
    return null;
  }

  const hit = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!hit) {
    geocodeCache.set(text, null);
    return null;
  }

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    geocodeCache.set(text, null);
    return null;
  }

  const result = {
    lat,
    lng,
    displayName: hit.display_name || ''
  };
  geocodeCache.set(text, result);
  return result;
};

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CHINESE_DIGIT_MAP = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const normalizeAddressUnits = (text) => String(text || '')
  .replace(/\s+/g, ' ')
  .replace(/\s*(段|巷|弄|號)\s*/g, '$1')
  .trim();

const chineseNumberToArabic = (text) => {
  const value = String(text || '').trim();
  if (!value) return '';

  return value
    .split('')
    .map((char) => (char in CHINESE_DIGIT_MAP ? String(CHINESE_DIGIT_MAP[char]) : char))
    .join('');
};

const normalizeChineseAddressDigits = (text) => normalizeAddressUnits(String(text || '')
  .replace(/([零一二三四五六七八九]+)(?=(段|巷|弄|號))/g, (match) => chineseNumberToArabic(match)));

const convertArabicAddressDigitsToChinese = (text) => normalizeAddressUnits(String(text || '')
  .replace(/(\d+)(?=(段|巷|弄|號))/g, (match) => match.split('').map((digit) => CHINESE_DIGITS[Number(digit)] ?? digit).join('')));

const buildAddressSearchCandidates = ({ city = '', district = '', village = '', detail = '', includeDetail = true }) => {
  const areaParts = [city, district, village].map((part) => String(part || '').trim()).filter(Boolean);
  const detailText = String(detail || '').trim();
  const orderedCandidates = [];
  const seen = new Set();

  const pushCandidate = (parts) => {
    const cleanParts = parts.map((part) => String(part || '').trim()).filter(Boolean);
    if (cleanParts.length === 0) return;

    // 🔥 調整順序：OSM 對於有「空格」分隔的台灣地址解析度，通常高於黏在一起的字
    [cleanParts.join(' '), cleanParts.join('')].forEach((candidate) => {
      if (!candidate || seen.has(candidate)) return;
      seen.add(candidate);
      orderedCandidates.push(candidate);
    });
  };

  if (includeDetail && detailText) {
    // 1. 第一優先：嘗試原本帶有「幾號」的各種數字變體（最精準狀況）
    const detailVariants = [
      normalizeAddressUnits(detailText),
      normalizeChineseAddressDigits(detailText),
      convertArabicAddressDigitsToChinese(detailText),
      convertArabicAddressDigitsToChinese(normalizeChineseAddressDigits(detailText))
    ]
      .map((item) => String(item || '').trim())
      .filter((item, index, arr) => item && arr.indexOf(item) === index);

    detailVariants.forEach((detailVariant) => {
      pushCandidate([...areaParts, detailVariant]);
    });

    // 2. 🔥 關鍵防禦：如果精準門牌在 OSM 查不到，自動切出「去掉門牌號碼」的純路段變體
    // 這個正則可以精準匹配並剃除如：「100號」、「55之2號」、「十號」、「三十一號」
    const streetOnlyDetail = detailText.replace(/(\d+|[零一二三四五六七八九十百]+)(之\d+)?號\s*$/g, '').trim();
    
    if (streetOnlyDetail && streetOnlyDetail !== detailText) {
      const streetVariants = [
        normalizeAddressUnits(streetOnlyDetail),
        normalizeChineseAddressDigits(streetOnlyDetail)
      ]
        .map((item) => String(item || '').trim())
        .filter((item, index, arr) => item && arr.indexOf(item) === index);

      streetVariants.forEach((streetVariant) => {
        pushCandidate([...areaParts, streetVariant]);
      });
    }
  }

  // 3. 最後手段：如果連路段都找不到，才退回到只搜尋行政區與鄉里
  pushCandidate(areaParts);

  console.log("送出給 API 的候選字清單：", orderedCandidates);
  // 因為增加了純路段的防禦機制，允許回傳擴大到前 6 個候選，讓後端迴圈去依序 try 出結果
  return orderedCandidates.slice(0, 6);
};

const TimePickerField = ({ value, minTime = '', onChange, label, helperText, disabled }) => {
  const { hour, minute } = parseTimeToParts(value);
  const minParts = parseTimeToParts(minTime);
  const hasMin = Boolean(minTime);

  useEffect(() => {
    if (hasMin && value && value < minTime) {
      onChange(minTime);
    }
  }, [hasMin, value, minTime, onChange]);

  const allowedHours = Array.from({ length: 24 }, (_, idx) => idx).filter((h) => !hasMin || h >= minParts.hour);
  const allowedMinutes = Array.from({ length: 60 }, (_, idx) => idx).filter((m) => {
    if (!hasMin) return true;
    if (hour > minParts.hour) return true;
    if (hour < minParts.hour) return false;
    return m >= minParts.minute;
  });

  const safeHour = allowedHours.includes(hour) ? hour : allowedHours[0] ?? 0;
  const safeMinute = allowedMinutes.includes(minute) ? minute : allowedMinutes[0] ?? 0;

  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select
        disabled={disabled}
          value={String(safeHour).padStart(2, '0')}
          onChange={(e) => {
            const nextHour = Number(e.target.value);
            const nextMinute = hasMin && nextHour === minParts.hour
              ? Math.max(safeMinute, minParts.minute)
              : safeMinute;
            onChange(formatTimeParts(nextHour, nextMinute));
          }}
          style={styles.select}
        >
          {allowedHours.map((h) => (
            <option key={h} value={String(h).padStart(2, '0')}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select
          value={String(safeMinute).padStart(2, '0')}
          onChange={(e) => onChange(formatTimeParts(safeHour, Number(e.target.value)))}
          style={styles.select}
        >
          {allowedMinutes.map((m) => (
            <option key={m} value={String(m).padStart(2, '0')}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
      {helperText && (
        <div style={{ fontSize: '11px', color: '#64748b' }}>{helperText}</div>
      )}
    </div>
  );
};

const ActionAddDelete = () => {
  const [activeTab, setActiveTab] = useState('routes');
  const [loading, setLoading] = useState(false);

  const [districtAreas, setDistrictAreas] = useState([]);
  const [villageAreas, setVillageAreas] = useState([]);

  const [routesList, setRoutesList] = useState([]);
  const [routeCity, setRouteCity] = useState('');
  const [routeDistrict, setRouteDistrict] = useState('');

  const [searchCity, setSearchCity] = useState('全部');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchVillage, setSearchVillage] = useState('');
  const [searchRouteName, setSearchRouteName] = useState('');
  const [routeSearchReady, setRouteSearchReady] = useState(false);

  const [routeForm, setRouteForm] = useState({
    areas_id: '',
    route_code: '',
    route_name: '',
    car_number: '',
    team: '',
    trip_number: ''
  });

  const [stationsList, setStationsList] = useState([]);
  const [stationSelectedCity, setStationSelectedCity] = useState('');
  const [stationSelectedDistrict, setStationSelectedDistrict] = useState('');
  const [stationSelectedVillage, setStationSelectedVillage] = useState('');
  const [stationSearchCity, setStationSearchCity] = useState('全部');
  const [stationSearchDistrict, setStationSearchDistrict] = useState('');
  const [stationSearchRouteName, setStationSearchRouteName] = useState('');
  const [stationSearchName, setStationSearchName] = useState('');
  const [stationRouteQuery, setStationRouteQuery] = useState('');
  const [stationRouteSuggestions, setStationRouteSuggestions] = useState([]);
  const [stationTimeBounds, setStationTimeBounds] = useState({
    minArriveTime: '',
    minLeaveTime: '',
  });
  const [selectedRouteObj, setSelectedRouteObj] = useState(null);
  const [editingStationId, setEditingStationId] = useState(null);
  const [editingForm, setEditingForm] = useState({
    station_name: '',
    arrive_time: '',
    leave_time: ''
  });
  const [editingSchedules, setEditingSchedules] = useState([]);

  const [stationForm, setStationForm] = useState({
    route_id: '',
    areas_id: '',
    station_name: '',
    sequence_order: '1',
    longitude: '121.0000000',
    latitude: '25.0000000',
    arrive_time: '17:00',
    leave_time: '17:05',
    stay_type: '',
    memo: ''
  });

  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapStatusText, setMapStatusText] = useState('尚未定位，請先選擇地點或開啟地圖選點');
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const mapClickHandlerRef = useRef(null);
  const mapMoveHandlerRef = useRef(null);
  const mapInitializingRef = useRef(false);
  const geocodeTimerRef = useRef(null);
  const geocodeFailureUntilRef = useRef(0);
  const pendingMapLocateModeRef = useRef(null);

  const [scheduleForm, setScheduleForm] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      collects_garbage: i !== 0 ? 1 : 0,
      collects_recycling: [2, 4, 6].includes(i) ? 1 : 0,
      collects_foodscraps: i !== 0 ? 1 : 0,
    }))
  );

  const routesLatestLoadedRef = useRef(false);
  const stationsLatestLoadedRef = useRef(false);

  const loadDistrictAreas = async () => {
    const baseUrl = await getBackendUrl();
    const res = await authedFetch(`${baseUrl}/api/admin/routes/areas/village-null`);
    if (!res.ok) throw new Error('行政區載入失敗');
    const data = await res.json();
    setDistrictAreas(data.areas || []);
  };

  const loadVillageAreas = async () => {
    const baseUrl = await getBackendUrl();
    const res = await authedFetch(`${baseUrl}/api/admin/routes/areas/all`);
    if (!res.ok) throw new Error('村里載入失敗');
    const data = await res.json();
    setVillageAreas(data.areas || []);
  };

  const loadStationsListBySearch = async () => {
    if (!hasStationSearch()) {
      throw new Error('站點查詢條件不足');
    }

    const baseUrl = await getBackendUrl();
    const params = new URLSearchParams();
    if (stationSearchCity && stationSearchCity !== '全部') params.append('city', stationSearchCity);
    if (stationSearchDistrict) params.append('district', stationSearchDistrict);
    if (stationSearchRouteName.trim()) params.append('route_name', stationSearchRouteName.trim());
    if (stationSearchName.trim()) params.append('station_name', stationSearchName.trim());

    const res = await authedFetch(`${baseUrl}/api/admin/stations/list?${params.toString()}`);
    if (!res.ok) throw new Error('站點搜尋失敗');
    const data = await res.json();
    setStationsList(data.stations || []);
  };

  const loadLatestStations = async () => {
    const baseUrl = await getBackendUrl();
    const res = await authedFetch(`${baseUrl}/api/admin/stations/list?latest=1&limit=50`);
    if (!res.ok) throw new Error('最新站點載入失敗');
    const data = await res.json();
    setStationsList(data.stations || []);
  };

  const loadLatestRoutes = async () => {
    const baseUrl = await getBackendUrl();
    const res = await authedFetch(`${baseUrl}/api/admin/routes/list?latest=1&limit=50`);
    if (!res.ok) throw new Error('最新路線載入失敗');
    const data = await res.json();
    setRoutesList(data.routes || []);
  };

  const updateStationCoordinates = (lat, lng) => {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (Number.isNaN(nextLat) || Number.isNaN(nextLng)) return;

    setStationForm(prev => ({
      ...prev,
      latitude: nextLat.toFixed(7),
      longitude: nextLng.toFixed(7)
    }));
  };

  const destroyStationMap = () => {
    if (mapRef.current && mapClickHandlerRef.current) {
      mapRef.current.off('click', mapClickHandlerRef.current);
    }

    if (mapMarkerRef.current) {
      mapMarkerRef.current.off();
      mapMarkerRef.current = null;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    mapClickHandlerRef.current = null;
    mapMoveHandlerRef.current = null;
  };

  const syncMapMarker = (lat, lng, label = '已選定位置') => {
    if (!window.L || !mapRef.current) return;
    const pos = [lat, lng];

    if (!mapMarkerRef.current) {
      mapMarkerRef.current = window.L.marker(pos, { draggable: true }).addTo(mapRef.current);
      mapMarkerRef.current.on('dragend', (event) => {
        const nextLatLng = event.target.getLatLng();
        updateStationCoordinates(nextLatLng.lat, nextLatLng.lng);
        setMapStatusText(`已拖曳到 ${nextLatLng.lat.toFixed(6)}, ${nextLatLng.lng.toFixed(6)}`);
      });
    } else {
      mapMarkerRef.current.setLatLng(pos);
    }

    mapRef.current.setView(pos, Math.max(mapRef.current.getZoom(), 17), { animate: true });
    mapMarkerRef.current.bindPopup(label).openPopup();
    updateStationCoordinates(lat, lng);
    setMapStatusText(`已定位到 ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`);
  };

  const initStationMap = async () => {
    if (mapInitializingRef.current || !mapContainerRef.current) return;
    if (mapRef.current) {
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 50);
      return;
    }
    mapInitializingRef.current = true;

    try {
      await ensureLeafletAssets();
      if (!mapContainerRef.current || mapRef.current || !window.L) return;

      mapRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 13);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      mapClickHandlerRef.current = (event) => {
        const { lat, lng } = event.latlng;
        syncMapMarker(lat, lng, '點選位置');
      };

      mapRef.current.on('click', mapClickHandlerRef.current);
      setMapStatusText('已載入地圖，點一下地圖即可回填座標');
    } catch (err) {
      console.warn(err);
      setMapStatusText('地圖載入失敗，請稍後再試');
    } finally {
      mapInitializingRef.current = false;
    }
  };

  const centerMapByLocation = async ({ includeDetail = true } = {}) => {
    const hasAreaSelection = stationSelectedCity && stationSelectedDistrict && stationSelectedVillage;
    if (!hasAreaSelection) {
      setMapStatusText('請先選擇完整的縣市、行政區與村里');
      return;
    }

    const detailText = includeDetail ? (stationForm.memo || '').trim() : '';
    const candidates = buildAddressSearchCandidates({
      city: stationSelectedCity,
      district: stationSelectedDistrict,
      village: stationSelectedVillage,
      detail: detailText,
      includeDetail
    });

    if (candidates.length === 0) {
      setMapStatusText('找不到可用的定位條件，請直接在地圖上點選');
      return;
    }

    if (Date.now() < geocodeFailureUntilRef.current) {
      setMapStatusText('地圖定位服務暫時無法使用，請直接在地圖上點選');
      return;
    }

    setMapStatusText(includeDetail && detailText ? '正在依詳細位置定位...' : '正在依行政區域定位...');

    try {
      for (const candidate of candidates) {
        try {
          const hit = await geocodeOpenStreetMap(candidate);
          if (hit) {
            if (!mapRef.current) return;
            geocodeFailureUntilRef.current = 0;
            syncMapMarker(hit.lat, hit.lng, hit.displayName || candidate);
            setMapStatusText(`已依 ${detailText ? '詳細位置' : '行政區域'} 定位到 ${candidate}`);
            return;
          }
        } catch (innerErr) {
          if (innerErr?.code === 'GEOCODE_SERVICE_UNAVAILABLE') {
            geocodeFailureUntilRef.current = Date.now() + 30 * 1000;
            setMapStatusText(innerErr.message || '地圖定位服務暫時無法使用，請直接在地圖上點選');
            return;
          }
          console.warn('geocode candidate failed', candidate, innerErr);
        }
      }
      setMapStatusText(
        includeDetail && detailText
          ? '找不到對應詳細位置，請直接在地圖上點選'
          : '已開啟地圖，請輸入更詳細位置或直接點地圖選點'
      );
    } catch (err) {
      console.warn(err);
      setMapStatusText('地點定位失敗，請直接在地圖上點選');
    }
  };

  const handleLocateByDetail = async () => {
    if (!stationSelectedCity || !stationSelectedDistrict || !stationSelectedVillage) {
      setMapStatusText('請先選擇完整的縣市、行政區與村里');
      return;
    }

    if (!mapPickerOpen) {
      pendingMapLocateModeRef.current = 'detail';
      setMapPickerOpen(true);
      setMapStatusText('正在開啟地圖並依詳細位置定位...');
      return;
    }

    pendingMapLocateModeRef.current = 'detail';
    await centerMapByLocation({ includeDetail: true });
  };

  const hasStationSearch = () => (
    (stationSearchCity && stationSearchCity !== '全部') ||
    stationSearchDistrict ||
    stationSearchRouteName.trim() ||
    stationSearchName.trim()
  );

  useEffect(() => {
    if (activeTab === 'stations' && stationsList.length === 0) {
      loadLatestStations().catch((err) => console.warn('最新站點載入失敗', err));
    }
  }, [activeTab, stationsList.length]);

  const fetchStationsByRouteId = async (routeId) => {
    const baseUrl = await getBackendUrl();
    const res = await authedFetch(`${baseUrl}/api/admin/stations/list?route_id=${routeId}`);
    if (!res.ok) throw new Error('路線站點載入失敗');
    const data = await res.json();
    return data.stations || [];
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const baseUrl = await getBackendUrl();
      const routeHasFilter = (searchCity && searchCity !== '全部') || searchDistrict || searchRouteName;
      const stationHasFilter = hasStationSearch();

      const routeUrl = routeHasFilter
        ? `${baseUrl}/api/admin/routes/list?${new URLSearchParams({
            ...(searchCity && searchCity !== '全部' ? { city: searchCity } : {}),
            ...(searchDistrict ? { district: searchDistrict } : {}),
            ...(searchRouteName ? { route_name: searchRouteName } : {})
          }).toString()}`
        : `${baseUrl}/api/admin/routes/list?latest=1&limit=50`;

      const stationUrl = stationHasFilter
        ? `${baseUrl}/api/admin/stations/list?${new URLSearchParams({
            ...(stationSearchCity && stationSearchCity !== '全部' ? { city: stationSearchCity } : {}),
            ...(stationSearchDistrict ? { district: stationSearchDistrict } : {}),
            ...(stationSearchRouteName ? { route_name: stationSearchRouteName } : {}),
            ...(stationSearchName ? { station_name: stationSearchName } : {})
          }).toString()}`
        : `${baseUrl}/api/admin/stations/list?latest=1&limit=50`;

      const [resRoutes, resStations] = await Promise.all([
        authedFetch(routeUrl, {
          headers: {
            Accept: 'application/json'
          }
        }),
        authedFetch(stationUrl, {
          headers: {
            Accept: 'application/json'
          }
        })
      ]);

      if (!resRoutes.ok || !resStations.ok) throw new Error('地基載入失敗');

      const dataRoutes = await resRoutes.json();
      const dataStations = await resStations.json();

      setRoutesList(dataRoutes.routes || []);
      setStationsList(dataStations.stations || []);
    } catch (err) {
      console.warn('⚠️ 轉入離線模擬模式:', err.message);
      setDistrictAreas([]);
      setVillageAreas([]);
      setRoutesList([]);
      setStationsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeCity && routeDistrict) {
      const target = districtAreas.find(a => a.city === routeCity && a.district === routeDistrict);
      if (target) setRouteForm(prev => ({ ...prev, areas_id: target.areas_id }));
    } else {
      setRouteForm(prev => ({ ...prev, areas_id: '' }));
    }
  }, [routeCity, routeDistrict, districtAreas]);

  useEffect(() => {
    if (stationSelectedCity && stationSelectedDistrict && stationSelectedVillage) {
      const target = villageAreas.find(a =>
        a.city === stationSelectedCity &&
        a.district === stationSelectedDistrict &&
        a.village === stationSelectedVillage
      );
      if (target) setStationForm(prev => ({ ...prev, areas_id: target.areas_id }));
    } else {
      setStationForm(prev => ({ ...prev, areas_id: '' }));
    }
  }, [stationSelectedCity, stationSelectedDistrict, stationSelectedVillage, villageAreas]);

  useEffect(() => {
    if (selectedRouteObj) {
      setStationForm(prev => ({
        ...prev,
        route_id: selectedRouteObj.route_id,
        sequence_order: selectedRouteObj.city === '台北市' ? '' : '1'
      }));
      setStationSelectedCity(selectedRouteObj.city || '');
      setStationSelectedDistrict(selectedRouteObj.district || '');
      setStationSelectedVillage('');
      if (villageAreas.length === 0) {
        loadVillageAreas().catch((err) => console.warn('村里載入失敗', err));
      }
    } else {
      setStationForm(prev => ({ ...prev, route_id: '' }));
      setStationSelectedCity('');
      setStationSelectedDistrict('');
      setStationSelectedVillage('');
    }
  }, [selectedRouteObj, villageAreas.length]);

  useEffect(() => {
    if (!mapPickerOpen) {
      pendingMapLocateModeRef.current = null;
      destroyStationMap();
      return undefined;
    }

    return () => {
      pendingMapLocateModeRef.current = null;
      destroyStationMap();
    };
  }, [mapPickerOpen]);

  useEffect(() => {
    if (!mapPickerOpen) return;

    let cancelled = false;
    const nextMode = pendingMapLocateModeRef.current;
    clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      if (cancelled) return;
      await initStationMap();
      if (cancelled || !mapRef.current) return;

      if (nextMode) {
        pendingMapLocateModeRef.current = null;
        await centerMapByLocation({ includeDetail: nextMode === 'detail' });
        return;
      }

      const currentLat = Number(stationForm.latitude);
      const currentLng = Number(stationForm.longitude);
      const isPlaceholderCoords =
        Math.abs(currentLat - DEFAULT_STATION_COORDS.lat) < 0.0000001 &&
        Math.abs(currentLng - DEFAULT_STATION_COORDS.lng) < 0.0000001;
      const hasSavedCoords = !Number.isNaN(currentLat) && !Number.isNaN(currentLng) && !isPlaceholderCoords;

      if (hasSavedCoords) {
        syncMapMarker(currentLat, currentLng, '目前座標');
        setMapStatusText('地圖已開啟，可直接拖曳標記或點地圖調整位置');
      } else {
        mapRef.current.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 13, { animate: false });
        setMapStatusText('地圖已開啟，請按「依詳細位置定位」或直接點地圖選點');
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(geocodeTimerRef.current);
    };
  }, [mapPickerOpen, stationSelectedCity, stationSelectedDistrict, stationSelectedVillage]);

  useEffect(() => {
    if (!selectedRouteObj) {
      setStationTimeBounds({
        minArriveTime: '',
        minLeaveTime: '',
      });
      return;
    }

    const currentArriveTime = stationForm.arrive_time || '';

    if (selectedRouteObj.city === '台北市') {
      setStationTimeBounds({
        minArriveTime: '',
        minLeaveTime: currentArriveTime ? addMinutesToTime(currentArriveTime, 1) : '',
      });
      return;
    }

    const inputSeq = parseInt(stationForm.sequence_order, 10);
    if (Number.isNaN(inputSeq) || inputSeq < 1) {
      setStationTimeBounds({
        minArriveTime: '',
        minLeaveTime: currentArriveTime ? addMinutesToTime(currentArriveTime, 1) : '',
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const siblings = await fetchStationsByRouteId(selectedRouteObj.route_id);
        const prevStation = siblings.find(s => Number(s.sequence_order) === inputSeq - 1);

        if (cancelled) return;

        setStationTimeBounds({
          minArriveTime: prevStation?.leave_time ? addMinutesToTime(prevStation.leave_time, 1) : '',
          minLeaveTime: currentArriveTime ? addMinutesToTime(currentArriveTime, 1) : '',
        });
      } catch {
        if (!cancelled) {
          setStationTimeBounds({
            minArriveTime: '',
            minLeaveTime: currentArriveTime ? addMinutesToTime(currentArriveTime, 1) : '',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRouteObj, stationForm.sequence_order, stationForm.arrive_time]);

  useEffect(() => {
    if (selectedRouteObj) {
      setStationRouteSuggestions([]);
      return;
    }

    const q = stationRouteQuery.trim();
    if (!q) {
      setStationRouteSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const baseUrl = await getBackendUrl();
        const params = new URLSearchParams();
        params.append('route_name', q);

        const res = await authedFetch(`${baseUrl}/api/admin/routes/list?${params.toString()}`);
        if (!res.ok) throw new Error('路線搜尋失敗');

        const data = await res.json();
        if (!cancelled) {
          setStationRouteSuggestions(data.routes || []);
        }
      } catch (err) {
        if (!cancelled) setStationRouteSuggestions([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stationRouteQuery, selectedRouteObj]);

  useEffect(() => {
    if (activeTab === 'stations' && districtAreas.length === 0) {
      loadDistrictAreas().catch((err) => console.warn('行政區載入失敗', err));
    }
  }, [activeTab, districtAreas.length]);

  useEffect(() => {
    if (activeTab === 'routes' && !routesLatestLoadedRef.current) {
      routesLatestLoadedRef.current = true;
      loadLatestRoutes().catch((err) => console.warn('最新路線載入失敗', err));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'stations' && !stationsLatestLoadedRef.current) {
      stationsLatestLoadedRef.current = true;
      loadLatestStations().catch((err) => console.warn('最新站點載入失敗', err));
    }
  }, [activeTab]);

  const handleCityChange = (city) => {
    setRouteCity(city);
    setRouteDistrict('');
    setRouteForm(prev => ({
      ...prev,
      car_number: city === '台北市' ? prev.car_number : '',
      team: city === '台北市' ? prev.team : '',
      trip_number: (city === '台北市' || city === '基隆市') ? prev.trip_number : ''
    }));
    if (city) {
      loadDistrictAreas().catch((err) => console.warn('行政區載入失敗', err));
    }
  };

const handleCreateRoute = async (e) => {
    e.preventDefault();
    const payload = {
      ...routeForm,
      areas_id: Number(routeForm.areas_id),
      route_code: (routeForm.route_code || '').trim(),
      route_name: (routeForm.route_name || '').trim(),
      car_number: (routeForm.car_number || '').trim(),
      team: (routeForm.team || '').trim(),
      trip_number: (routeForm.trip_number || '').trim(),
    };

    if (!payload.areas_id || !payload.route_name || !payload.route_code) {
      return alert('請完整選擇區域並填寫必填欄位！');
    }

    try {
      const baseUrl = await getBackendUrl();
      const response = await authedFetch(`${baseUrl}/api/admin/routes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 || result.error_type === 'duplicate') {
          alert(result.message || '這筆路線已存在，不能重複新增！');
          return;
        }
        throw new Error(result.message || '路線新增失敗');
      }

      alert('全新收運路線發布並儲存成功！💾');
      await fetchAllData();
    } catch (error) {
      alert(error?.message || '路線新增失敗，請稍後再試。');
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm('☠️ 警告：刪除路線將會連帶「連鎖刪除」該路線下的所有清運站點與班次！確定執行？')) return;
    try {
      const baseUrl = await getBackendUrl();
      await authedFetch(`${baseUrl}/api/admin/routes/delete/${routeId}`, { method: 'POST' });
      fetchAllData();
    } catch {
      setRoutesList(prev => prev.filter(r => r.route_id !== routeId));
    }
  };

  const handleStationScheduleChange = (dayIndex, field) => {
    setScheduleForm(prev => prev.map((item, idx) =>
      idx === dayIndex ? { ...item, [field]: item[field] === 1 ? 0 : 1 } : item
    ));
  };

  const handleCreateStationWithSchedule = async (e) => {
    e.preventDefault();
    const stationPayload = {
      ...stationForm,
      route_id: Number(stationForm.route_id),
      areas_id: Number(stationForm.areas_id),
      station_name: (stationForm.station_name || '').trim(),
      sequence_order: stationForm.sequence_order === '' || stationForm.sequence_order == null
        ? ''
        : Number(stationForm.sequence_order),
      longitude: stationForm.longitude === '' || stationForm.longitude == null
        ? ''
        : Number(stationForm.longitude),
      latitude: stationForm.latitude === '' || stationForm.latitude == null
        ? ''
        : Number(stationForm.latitude),
      arrive_time: (stationForm.arrive_time || '').trim(),
      leave_time: (stationForm.leave_time || '').trim(),
      stay_type: (stationForm.stay_type || '').trim(),
      memo: (stationForm.memo || '').trim(),
    };
    const stationCity = selectedRouteObj?.city || stationSelectedCity;
    const stationDistrict = selectedRouteObj?.district || stationSelectedDistrict;

    if (!stationPayload.arrive_time || !stationPayload.leave_time) {
      return alert('請填寫抵達時間與駛離時間！');
    }

    if (stationPayload.leave_time <= stationPayload.arrive_time) {
      return alert('駛離時間必須晚於抵達時間！');
    }

    if (
      !stationCity ||
      !stationDistrict ||
      !stationSelectedVillage ||
      !stationPayload.route_id ||
      !stationPayload.areas_id ||
      !stationPayload.station_name
    ) {
      return alert('請填寫完整縣市、行政區、村里、路線與站點名稱！');
    }

    if (selectedRouteObj) {
      setStationSelectedCity(selectedRouteObj.city || '');
      setStationSelectedDistrict(selectedRouteObj.district || '');
      stationPayload.city = selectedRouteObj.city || '';
      stationPayload.district = selectedRouteObj.district || '';
    }

    if (selectedRouteObj && selectedRouteObj.city !== '台北市') {
      const inputSeq = parseInt(stationPayload.sequence_order, 10);
      if (isNaN(inputSeq) || inputSeq < 1) return alert('新北與基隆之路線順序必須自 1 開始填入！');

      const siblingStations = (await fetchStationsByRouteId(selectedRouteObj.route_id))
        .sort((a, b) => a.sequence_order - b.sequence_order);

      if (inputSeq === 1) {
        if (siblingStations.some(s => s.sequence_order === 1)) {
          return alert('該路線已存在序位 1 的站點！');
        }
      } else {
        const hasPrevious = siblingStations.some(s => s.sequence_order === inputSeq - 1);
        if (!hasPrevious) return alert(`排序不連續！請先填寫序位較前的站點（目前缺少序位: ${inputSeq - 1}）`);
      }

      const prevStation = siblingStations.find(s => s.sequence_order === inputSeq - 1);
      if (prevStation && stationPayload.arrive_time <= prevStation.leave_time) {
        return alert(`時間衝突！當前站點抵達時間 (${stationPayload.arrive_time}) 必須晚於前一站的駛離時間 (${prevStation.leave_time})`);
      }
    }

    if (stationPayload.arrive_time && stationPayload.leave_time && stationPayload.leave_time <= stationPayload.arrive_time) {
      return alert('駛離時間必須晚於抵達時間！');
    }

    try {
      const baseUrl = await getBackendUrl();
      const response = await authedFetch(`${baseUrl}/api/admin/stations/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_data: stationPayload,
          schedules_data: scheduleForm
        })
      });

      const errData = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 || errData.error_type === 'duplicate' || `${errData.message || ''}`.includes('重複')) {
          alert(errData.message || '這筆站點資料已存在，不能重複新增！');
          return;
        }
        throw new Error(errData.message || '後端儲存失敗');
      }

      alert('全新清運點與一鍵每週班次日程已安全寫入 MySQL 資料庫！💾');
      setStationForm({
        route_id: '',
        areas_id: '',
        station_name: '',
        sequence_order: '1',
        longitude: '121.0000000',
        latitude: '25.0000000',
        arrive_time: '17:00',
        leave_time: '17:05',
        stay_type: '',
        memo: ''
      });
      setSelectedRouteObj(null);
      setStationSelectedCity('');
      setStationSelectedDistrict('');
      setStationRouteQuery('');
      setStationSelectedVillage('');
      setMapPickerOpen(false);
      setMapStatusText('尚未定位，請先選擇地點或開啟地圖選點');
      destroyStationMap();
      if (hasStationSearch()) {
        await loadStationsListBySearch();
      } else {
        await fetchAllData();
      }
    } catch (err) {
      alert(`[新增失敗]：${err.message}`);
    }
  };

  const startEditStation = (station) => {
    setEditingStationId(station.station_id);
    setEditingForm({
      station_name: station.station_name,
      arrive_time: station.arrive_time,
      leave_time: station.leave_time
    });
    setEditingSchedules(station.schedules?.length ? station.schedules : Array.from({ length: 7 }, (_, i) => ({ day_of_week: i, collects_garbage: 1, collects_recycling: 0, collects_foodscraps: 1 })));
  };

  const handleSaveEdit = async (stationId) => {
    const original = stationsList.find(s => s.station_id === stationId);
    if (!original) return;

    if (!editingForm.arrive_time || !editingForm.leave_time) {
      return alert('請填寫抵達時間與駛離時間！');
    }

    if (editingForm.leave_time <= editingForm.arrive_time) {
      return alert('駛離時間必須晚於抵達時間！');
    }

    if (original.city !== '台北市' && original.sequence_order) {
      const currentSeq = original.sequence_order;
      const siblingStations = (await fetchStationsByRouteId(original.route_id))
        .filter(s => s.station_id !== stationId)
        .sort((a, b) => a.sequence_order - b.sequence_order);

      const prevStation = siblingStations.find(s => s.sequence_order === currentSeq - 1);
      if (prevStation && editingForm.arrive_time <= prevStation.leave_time) {
        return alert(`時間衝突！抵達時間必須在上一站駛離時間 (${prevStation.leave_time}) 之後`);
      }

      const nextStation = siblingStations.find(s => s.sequence_order === currentSeq + 1);
      if (nextStation && editingForm.leave_time >= nextStation.arrive_time) {
        return alert(`時間衝突！駛離時間必須在下一站抵達時間 (${nextStation.arrive_time}) 之前`);
      }
    }

    try {
      const baseUrl = await getBackendUrl();
      const response = await authedFetch(`${baseUrl}/api/admin/stations/update/${stationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingForm,
          schedules_data: editingSchedules
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '行內更新失敗');
      }

      alert('💾 站點特定限制欄位已成功同步至 MySQL 資料庫！');
      setEditingStationId(null);
      if (hasStationSearch()) {
        await loadStationsListBySearch();
      } else {
        await fetchAllData();
      }
    } catch (err) {
      alert(`[更新失敗]：${err.message}`);
    }
  };

  const handleDeleteStation = async (stationId) => {
    if (!window.confirm('確定要永久移除此清運站點，並清除其每週清運班次表嗎？')) return;
    try {
      const baseUrl = await getBackendUrl();
      const response = await authedFetch(`${baseUrl}/api/admin/stations/delete/${stationId}`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('後端級聯刪除失敗');
      alert('🗑️ 該清運站點與關聯每週日程紀錄，已成功自 MySQL 物理清除！');
      if (hasStationSearch()) {
        await loadStationsListBySearch();
      } else {
        await fetchAllData();
      }
    } catch {
      alert('❌ 刪除失敗');
    }
  };

  const filteredDistricts = React.useMemo(() => {
    return Array.from(new Set(districtAreas.filter(a => a.city === routeCity).map(a => a.district)));
  }, [routeCity, districtAreas]);

  const stationDistricts = React.useMemo(() => {
    return Array.from(new Set(districtAreas.filter(a => a.city === stationSelectedCity).map(a => a.district)));
  }, [stationSelectedCity, districtAreas]);

  const stationVillages = React.useMemo(() => {
    return villageAreas
      .filter(a => a.city === stationSelectedCity && a.district === stationSelectedDistrict)
      .map(a => a.village)
      .filter(Boolean);
  }, [stationSelectedCity, stationSelectedDistrict, villageAreas]);

  const searchDistricts = React.useMemo(() => {
    return Array.from(new Set(districtAreas.filter(a => a.city === searchCity).map(a => a.district)));
  }, [searchCity, districtAreas]);

  const matchedRoutes = stationRouteSuggestions;

  const hasRouteSearch = () => (
    (searchCity && searchCity !== '全部') ||
    searchDistrict ||
    searchRouteName.trim()
  );

  return (
    <div style={styles.card}>
      <div style={styles.tabContainer}>
        <button onClick={() => setActiveTab('routes')} style={activeTab === 'routes' ? styles.tabActive : styles.tabButton}>
          🗺️ 垃圾車路線維護面板 (Routes)
        </button>
        <button onClick={() => setActiveTab('stations')} style={activeTab === 'stations' ? styles.tabActive : styles.tabButton}>
          📍 清運站點與每週班次 (Stations & Schedules)
        </button>
        <button onClick={() => setActiveTab('history')} style={activeTab === 'history' ? styles.tabActive : styles.tabButton}>
          🧾 操作歷史紀錄 (History)
        </button>
      </div>

      {loading && <div style={styles.loadingText}>⏳ 正在安全調度垃圾清運核心資料結構...</div>}


      {!loading && activeTab === 'routes' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <h3 style={styles.panelTitle}>➕ 新增清運收運路線</h3>
            <form onSubmit={handleCreateRoute} style={styles.form}>
              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>1. 選擇受眾縣市</label>
                  <select value={routeCity} onChange={(e) => handleCityChange(e.target.value)} style={styles.select} required>
                    <option value="">-- 請選擇 --</option>
                    <option value="台北市">🔵 台北市</option>
                    <option value="新北市">🟢 新北市</option>
                    <option value="基隆市">🟡 基隆市</option>
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>2. 選擇行政區</label>
                  <select value={routeDistrict} onChange={(e) => setRouteDistrict(e.target.value)} style={{ ...styles.select, backgroundColor: !routeCity ? '#e2e8f0' : '#fff' }} disabled={!routeCity} required>
                    <option value="">-- 請選擇 --</option>
                    {filteredDistricts.map(dist => <option key={dist} value={dist}>{dist}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-5px', fontStyle: 'italic' }}>
                💡 系統自動配對 MySQL 欄位 `areas_id`：{routeForm.areas_id ? <strong>{routeForm.areas_id}</strong> : '尚未配對'}
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>路線代碼 (route_code) *必填</label>
                <input type="text" placeholder="例如: BR-01" maxLength={30} value={routeForm.route_code} onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })} style={styles.input} required />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>收運路線完整名稱 (route_name) *必填</label>
                <input type="text" placeholder="例如: 板橋文化線A" maxLength={30} value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} style={styles.input} required />
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={{ ...styles.label, color: routeCity !== '台北市' ? '#94a3b8' : '#475569' }}>車牌號碼</label>
                  <input type="text" placeholder="KE-1234" maxLength={30} value={routeForm.car_number} onChange={(e) => setRouteForm({ ...routeForm, car_number: e.target.value })} style={{ ...styles.input, backgroundColor: routeCity !== '台北市' ? '#e2e8f0' : '#fff' }} disabled={routeCity !== '台北市'} required={routeCity === '台北市'} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={{ ...styles.label, color: routeCity !== '台北市' ? '#94a3b8' : '#475569' }}>所屬車隊</label>
                  <input type="text" placeholder="大安清潔隊" maxLength={30} value={routeForm.team} onChange={(e) => setRouteForm({ ...routeForm, team: e.target.value })} style={{ ...styles.input, backgroundColor: routeCity !== '台北市' ? '#e2e8f0' : '#fff' }} disabled={routeCity !== '台北市'} required={routeCity === '台北市'} />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={{ ...styles.label, color: (routeCity !== '台北市' && routeCity !== '基隆市') ? '#94a3b8' : '#475569' }}>車次/班次描述</label>
                <input type="text" placeholder="第1班次" maxLength={30} value={routeForm.trip_number} onChange={(e) => setRouteForm({ ...routeForm, trip_number: e.target.value })} style={{ ...styles.input, backgroundColor: (routeCity !== '台北市' && routeCity !== '基隆市') ? '#e2e8f0' : '#fff' }} disabled={routeCity !== '台北市' && routeCity !== '基隆市'} required={routeCity === '台北市' || routeCity === '基隆市'} />
              </div>

              <button type="submit" style={styles.submitBtn}>💾 確定新增收運路線</button>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📋 目前系統中現存路線一覽</h3>
            <div style={styles.searchBarContainer}>
              <div style={{ ...styles.searchFieldsRow, gap: '6px' }}>
                <select
                  value={searchCity}
                  onChange={(e) => {
                    const nextCity = e.target.value;
                    setSearchCity(nextCity);
                    setSearchDistrict('');
                    setSearchVillage('');
                    if (nextCity) {
                      loadDistrictAreas().catch((err) => console.warn('行政區載入失敗', err));
                    }
                  }}
                  style={styles.filterSelect}
                >
                  <option value="全部">🌍 所有縣市</option>
                  <option value="台北市">🔵 台北市</option>
                  <option value="新北市">🟢 新北市</option>
                  <option value="基隆市">🟡 基隆市</option>
                </select>

                <select value={searchDistrict} onChange={(e) => { setSearchDistrict(e.target.value); setSearchVillage(''); }} style={{ ...styles.filterSelect, backgroundColor: searchCity === '全部' ? '#e2e8f0' : '#fff' }} disabled={searchCity === '全部'}>
                  <option value="">🔍 所有行政區</option>
                  {searchDistricts.map(dist => <option key={dist} value={dist}>{dist}</option>)}
                </select>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="輸入關鍵字模糊搜尋路線名稱..." value={searchRouteName} onChange={(e) => setSearchRouteName(e.target.value)} style={styles.filterInput} />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      if (searchCity && searchCity !== '全部' && districtAreas.length === 0) {
                        await loadDistrictAreas();
                      }
                      const baseUrl = await getBackendUrl();
                      const params = new URLSearchParams();
                      if (searchCity && searchCity !== '全部') params.append('city', searchCity);
                      if (searchDistrict.trim()) params.append('district', searchDistrict.trim());
                      if (searchRouteName.trim()) params.append('route_name', searchRouteName.trim());

                      const res = await authedFetch(`${baseUrl}/api/admin/routes/list?${params.toString()}`);
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      setRoutesList(data.routes || []);
                    } catch (err) {
                      alert('❌ 搜尋篩選失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={styles.searchBtn}
                >
                  🔍 執行查詢
                </button>
              </div>
            </div>

            <div style={styles.listWrapper}>
              {routesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                  💡 請在上方的篩選器選擇條件，並點擊「執行查詢」載入路線資料。
                </div>
              ) : (
                routesList.map(r => (
                  <div key={r.route_id} style={styles.dataItemCard}>
                    <div>
                      <span style={styles.routeBadge}>{r.route_code || '無'}</span>
                      <strong style={styles.itemMainTitle}>{r.route_name}</strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>({r.city}{r.district})</span>
                      <div style={styles.itemSubText}>🚙 車牌: {r.car_number || '無'} | ⏱️ 班次: {r.trip_number || '無'}</div>
                    </div>
                    <button onClick={() => handleDeleteRoute(r.route_id)} style={styles.deleteBtn}>🗑️ 刪除</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'stations' && (
        <div style={styles.gridContainer}>
          <div style={styles.formPanel}>
            <h3 style={styles.panelTitle}>➕ 新增收運點 ＆ 配置一鍵週清運日程</h3>
            <form onSubmit={handleCreateStationWithSchedule} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>🔍 輸入現存路線名稱</label>
                <input
                  type="text"
                  placeholder="輸入範例:天母-1"
                  value={stationRouteQuery}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setStationRouteQuery(nextValue);

                    if (selectedRouteObj) {
                      setSelectedRouteObj(null);
                      setStationForm(prev => ({ ...prev, route_id: '', areas_id: '' }));
                      setStationSelectedCity('');
                      setStationSelectedDistrict('');
                      setStationSelectedVillage('');
                    }
                  }}
                  style={styles.input}
                />
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                  請先填寫路線名稱，縣市與行政區會自動帶入。
                </div>
                {stationRouteQuery && !selectedRouteObj && (
                  <div style={styles.dropdownSuggestion}>
                    {matchedRoutes.length === 0 ? <div style={{ padding: '8px', color: '#94a3b8' }}>找不到符合的收運路線</div> :
                      matchedRoutes.map(r => (
                        <div key={r.route_id} onClick={() => { setSelectedRouteObj(r); setStationRouteQuery(`${r.route_name} (${r.city}-${r.trip_number || '無班次別'})`); }} style={styles.suggestionItem}>
                          🚌 <strong>{r.route_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Code: {r.route_code} | {r.city} | {r.trip_number || '無班次別'}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
                {selectedRouteObj && (
                  <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold', marginTop: '4px' }}>
                    ✅ 已鎖定：{selectedRouteObj.route_name} ({selectedRouteObj.city} - {selectedRouteObj.trip_number || '無班次別'}) / Route ID: {selectedRouteObj.route_id}
                  </div>
                )}
                {selectedRouteObj && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRouteObj(null);
                      setStationRouteQuery('');
                      setStationForm(prev => ({ ...prev, route_id: '' }));
                    }}
                    style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer', fontSize: '12px', color: '#334155' }}
                  >
                    重新選擇路線
                  </button>
                )}
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>縣市 *</label>
                  <select
                    value={stationSelectedCity}
                    onChange={() => {}}
                    style={{ ...styles.select, backgroundColor: '#e2e8f0', color: '#64748b' }}
                    disabled
                    required
                  >
                    <option value="">-- 由路線帶入 --</option>
                    <option value="台北市">台北市</option>
                    <option value="新北市">新北市</option>
                    <option value="基隆市">基隆市</option>
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>行政區 *</label>
                  <select
                    value={stationSelectedDistrict}
                    onChange={() => {}}
                    style={{ ...styles.select, backgroundColor: '#e2e8f0', color: '#64748b' }}
                    disabled
                    required
                  >
                    <option value="">-- 由路線帶入 --</option>
                    {stationDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>村里 *</label>
                  <select
                    value={stationSelectedVillage}
                    disabled={!stationSelectedDistrict}
                    onChange={(e) => setStationSelectedVillage(e.target.value)}
                    style={styles.select}
                    required
                  >
                    <option value="">-- 選村里 --</option>
                    {stationVillages.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '-5px', fontStyle: 'italic' }}>
                💡 系統自動配對 MySQL 欄位 `areas_id`：{stationForm.areas_id ? <strong>{stationForm.areas_id}</strong> : '尚未配對'}
              </div>

              <div style={styles.rowFields}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>清運點地標名稱 (station_name)</label>
                  <input type="text" placeholder="例如: 捷運站出口、超商前" maxLength={30} value={stationForm.station_name} onChange={(e) => setStationForm({ ...stationForm, station_name: e.target.value })} style={styles.input} required />
                </div>
                <div style={styles.inputGroup}>
                  <label style={{ ...styles.label, color: selectedRouteObj?.city === '台北市' ? '#94a3b8' : '#475569' }}>
                    順序順位 {selectedRouteObj?.city === '台北市' ? '🔒 台北免填' : '*必填'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={stationForm.sequence_order}
                    onChange={(e) => setStationForm({ ...stationForm, sequence_order: e.target.value })}
                    style={{ ...styles.input, backgroundColor: selectedRouteObj?.city === '台北市' ? '#e2e8f0' : '#fff' }}
                    disabled={selectedRouteObj?.city === '台北市'}
                    required={selectedRouteObj?.city !== '台北市'}
                  />
                </div>
              </div>

              <div style={styles.rowFields}>
                <TimePickerField
                  label="抵達時間 (24H)"
                  value={stationForm.arrive_time}
                  minTime={stationTimeBounds.minArriveTime}
                  onChange={(nextTime) => setStationForm({ ...stationForm, arrive_time: nextTime })}
                  helperText={stationTimeBounds.minArriveTime ? `可選時間需晚於 ${stationTimeBounds.minArriveTime}` : ''}
                  disabled={loading}
                />
                <TimePickerField
                  label="駛離時間 (24H)"
                  value={stationForm.leave_time}
                  minTime={stationTimeBounds.minLeaveTime}
                  onChange={(nextTime) => setStationForm({ ...stationForm, leave_time: nextTime })}
                  helperText={stationTimeBounds.minLeaveTime ? `駛離時間需晚於 ${stationTimeBounds.minLeaveTime}` : ''}
                  disabled={loading}
                />
                <div style={styles.inputGroup}>
                  <label style={styles.label}>停靠類別</label>
                  <select value={stationForm.stay_type} onChange={(e) => setStationForm({ ...stationForm, stay_type: e.target.value })} style={styles.select}>
                    <option value="">預設 (NULL)</option>
                    <option value="沿線">沿線</option>
                  </select>
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>詳細位置（選填）</label>
                <input
                  type="text"
                  placeholder="例如：XX便利商店前、XX路 123 號、社區大門右側"
                  maxLength={120}
                  value={stationForm.memo}
                  onChange={(e) => setStationForm({ ...stationForm, memo: e.target.value })}
                  style={styles.input}
                />
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  這裡會一起用來找地圖定位，也會存入 MySQL 的 memo 欄位。
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={!stationSelectedCity || !stationSelectedDistrict || !stationSelectedVillage}
                  onClick={() => setMapPickerOpen(prev => !prev)}
                  style={{
                    ...styles.searchBtn,
                    backgroundColor: mapPickerOpen ? '#0f172a' : '#0284c7',
                    opacity: (!stationSelectedCity || !stationSelectedDistrict || !stationSelectedVillage) ? 0.55 : 1,
                    cursor: (!stationSelectedCity || !stationSelectedDistrict || !stationSelectedVillage) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {mapPickerOpen ? '收起地圖選點' : '開啟地圖選點'}
                </button>
                <button
                  type="button"
                  onClick={handleLocateByDetail}
                  style={{ ...styles.deleteBtn, padding: '8px 16px', backgroundColor: '#ecfeff', color: '#0f766e', borderColor: '#67e8f9' }}
                >
                  依詳細位置定位
                </button>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {mapStatusText}
                </span>
              </div>

              {mapPickerOpen && (
                <div style={styles.mapPanel}>
                  <div ref={mapContainerRef} style={styles.mapCanvas} />
                  <div style={styles.coordSummary}>
                    <div>經度：<strong>{stationForm.longitude}</strong></div>
                    <div>緯度：<strong>{stationForm.latitude}</strong></div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                    提示：你可以先輸入詳細位置再按定位，也可以直接點地圖，點下去的位置會自動回填座標。
                  </div>
                </div>
              )}

              <div style={styles.scheduleBox}>
                <label style={{ ...styles.label, color: '#1a237e' }}>📅 配置此站點每週收運日程 (station_schedules)</label>
                <table style={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>星期</th>
                      <th style={styles.th}>🗑️ 垃圾</th>
                      <th style={styles.th}>♻️ 資收</th>
                      <th style={styles.th}>🐷 廚餘</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleForm.map((day, idx) => (
                      <tr key={day.day_of_week} style={{ backgroundColor: idx === 0 ? '#fff1f2' : '#ffffff' }}>
                        <td style={{ ...styles.td, fontWeight: 'bold' }}>{weekDays[idx]}</td>
                        <td style={styles.td}><input type="checkbox" checked={day.collects_garbage === 1} onChange={() => handleStationScheduleChange(idx, 'collects_garbage')} /></td>
                        <td style={styles.td}><input type="checkbox" checked={day.collects_recycling === 1} onChange={() => handleStationScheduleChange(idx, 'collects_recycling')} /></td>
                        <td style={styles.td}><input type="checkbox" checked={day.collects_foodscraps === 1} onChange={() => handleStationScheduleChange(idx, 'collects_foodscraps')} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="submit" style={{ ...styles.submitBtn, backgroundColor: '#0284c7' }}>🚀 確定新增清運點（同步配置清運日程）</button>
            </form>
          </div>

          <div style={styles.listPanel}>
            <h3 style={styles.panelTitle}>📂 目前系統中現存清運點一覽</h3>
            <div style={styles.searchBarContainer}>
              <div style={{ ...styles.searchFieldsRow, gap: '6px', flexWrap: 'wrap' }}>
                <select
                  value={stationSearchCity}
                  onChange={(e) => {
                    const nextCity = e.target.value;
                    setStationSearchCity(nextCity);
                    setStationSearchDistrict('');
                    if (nextCity && districtAreas.length === 0) {
                      loadDistrictAreas().catch((err) => console.warn('行政區載入失敗', err));
                    }
                  }}
                  style={styles.filterSelect}
                >
                  <option value="全部">🌍 所有縣市</option>
                  <option value="台北市">🔵 台北市</option>
                  <option value="新北市">🟢 新北市</option>
                  <option value="基隆市">🟡 基隆市</option>
                </select>

                <select
                  value={stationSearchDistrict}
                  onChange={(e) => setStationSearchDistrict(e.target.value)}
                  style={{ ...styles.filterSelect, backgroundColor: stationSearchCity === '全部' ? '#e2e8f0' : '#fff' }}
                  disabled={stationSearchCity === '全部'}
                >
                  <option value="">🔍 所有行政區</option>
                  {districtAreas
                    .filter(a => stationSearchCity === '全部' || a.city === stationSearchCity)
                    .map(a => a.district)
                    .filter((d, idx, arr) => arr.indexOf(d) === idx)
                    .map(dist => <option key={dist} value={dist}>{dist}</option>)}
                </select>

                <input
                  type="text"
                  placeholder="輸入站點名稱查站點..."
                  value={stationSearchName}
                  onChange={(e) => setStationSearchName(e.target.value)}
                  style={styles.filterInput}
                />

                <input
                  type="text"
                  placeholder="輸入路線名稱查站點..."
                  value={stationSearchRouteName}
                  onChange={(e) => setStationSearchRouteName(e.target.value)}
                  style={styles.filterInput}
                />
              </div>

              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!hasStationSearch()) {
                      alert('請至少填一個條件：縣市、行政區、站點名稱、路線名稱。');
                      return;
                    }
                    try {
                      setLoading(true);
                      if (stationSearchCity && stationSearchCity !== '全部' && districtAreas.length === 0) {
                        await loadDistrictAreas();
                      }
                      if (stationSearchRouteName.trim()) {
                        setStationSearchRouteName((prev) => prev.trim());
                      }
                      if (stationSearchName.trim()) {
                        setStationSearchName((prev) => prev.trim());
                      }
                      await loadStationsListBySearch();
                    } catch (err) {
                      alert('❌ 站點查詢失敗');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={styles.searchBtn}
                >
                  🔍 查詢站點
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStationSearchCity('全部');
                    setStationSearchDistrict('');
                    setStationSearchRouteName('');
                    setStationSearchName('');
                    setStationsList([]);
                  }}
                  style={{ ...styles.deleteBtn, padding: '8px 16px' }}
                >
                  清空條件
                </button>
              </div>
            </div>
            <div style={styles.listWrapper}>
              {stationsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  請至少填一個條件：縣市、行政區、站點名稱或路線名稱，再按「查詢站點」。
                </div>
              ) : stationsList.map(s => {
                const isEditing = editingStationId === s.station_id;

                if (!isEditing) {
                  return (
                    <div key={s.station_id} style={styles.dataItemCard}>
                      <div>
                        {s.sequence_order && <span style={{ ...styles.routeBadge, backgroundColor: '#f0fdf4', color: '#16a34a' }}>序位 {s.sequence_order}</span>}
                        {s.stay_type && <span style={{ ...styles.routeBadge, backgroundColor: '#fff7ed', color: '#ea580c' }}>{s.stay_type}</span>}
                        <strong style={styles.itemMainTitle}>{s.station_name}</strong>
                        <div style={styles.itemSubText}>
                          🚌 路線: {s.route_name} | ⏱️ 時間: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.arrive_time} ~ {s.leave_time}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>📍 區域: {s.city}{s.district}{s.village}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => startEditStation(s)} style={{ ...styles.deleteBtn, backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}>✏️ 編輯</button>
                        <button type="button" onClick={() => handleDeleteStation(s.station_id)} style={styles.deleteBtn}>🗑️ 刪除</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={s.station_id} style={styles.editItemCard}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1a237e' }}>🛠️ 正在行內修改站點資料</h4>
                    <div style={styles.form}>
                      <div style={styles.inputGroup}>
                        <label style={styles.label}>站點名稱調整</label>
                        <input type="text" maxLength={30} value={editingForm.station_name} onChange={(e) => setEditingForm({ ...editingForm, station_name: e.target.value })} style={styles.input} />
                      </div>
                      <div style={styles.rowFields}>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>抵達時間</label>
                          <input type="time" value={editingForm.arrive_time} onChange={(e) => setEditingForm({ ...editingForm, arrive_time: e.target.value })} style={styles.input} />
                        </div>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>駛離時間</label>
                          <input type="time" value={editingForm.leave_time} onChange={(e) => setEditingForm({ ...editingForm, leave_time: e.target.value })} style={styles.input} />
                        </div>
                      </div>

                      <div style={{ marginTop: '5px', fontSize: '12px' }}>
                        <strong>📅 調整每週排班日程：</strong>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {weekDays.map((day, dayIdx) => (
                            <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#334155', textAlign: 'center' }}>{day}</div>
                              <button
                                type="button"
                                onClick={() => setEditingSchedules(prev => prev.map((sch, sIdx) => sIdx === dayIdx ? { ...sch, collects_garbage: sch.collects_garbage === 1 ? 0 : 1 } : sch))}
                                style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: editingSchedules[dayIdx]?.collects_garbage === 1 ? '#e0e7ff' : '#ffffff', color: editingSchedules[dayIdx]?.collects_garbage === 1 ? '#4338ca' : '#64748b' }}
                              >
                                垃圾 {editingSchedules[dayIdx]?.collects_garbage === 1 ? '收' : '停'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSchedules(prev => prev.map((sch, sIdx) => sIdx === dayIdx ? { ...sch, collects_recycling: sch.collects_recycling === 1 ? 0 : 1 } : sch))}
                                style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: editingSchedules[dayIdx]?.collects_recycling === 1 ? '#dbeafe' : '#ffffff', color: editingSchedules[dayIdx]?.collects_recycling === 1 ? '#2563eb' : '#64748b' }}
                              >
                                資收 {editingSchedules[dayIdx]?.collects_recycling === 1 ? '收' : '停'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSchedules(prev => prev.map((sch, sIdx) => sIdx === dayIdx ? { ...sch, collects_foodscraps: sch.collects_foodscraps === 1 ? 0 : 1 } : sch))}
                                style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: editingSchedules[dayIdx]?.collects_foodscraps === 1 ? '#dcfce7' : '#ffffff', color: editingSchedules[dayIdx]?.collects_foodscraps === 1 ? '#16a34a' : '#64748b' }}
                              >
                                廚餘 {editingSchedules[dayIdx]?.collects_foodscraps === 1 ? '收' : '停'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => handleSaveEdit(s.station_id)} style={{ ...styles.searchBtn, padding: '6px 12px', fontSize: '12px' }}>💾 儲存修改</button>
                        <button type="button" onClick={() => setEditingStationId(null)} style={{ ...styles.deleteBtn, padding: '6px 12px' }}>❌ 取消</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'history' && (
        <ActionHistoryLog />
      )}
    </div>
  );
};

const styles = {
  card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' },
  tabContainer: { display: 'flex', gap: '5px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', flexWrap: 'wrap' },
  historyTabShim: { display: 'flex', gap: '5px', marginTop: '-24px', marginBottom: '24px', flexWrap: 'wrap' },
  tabButton: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#64748b',
    cursor: 'pointer',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    transition: 'all 0.2s',
    borderTop: '3px solid transparent',
    borderBottom: '3px solid transparent',
    borderLeft: '3px solid transparent',
    borderRight: '3px solid transparent'
  },
  tabActive: {
    padding: '12px 20px',
    backgroundColor: '#e8eaf6',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#1a237e',
    cursor: 'pointer',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    transition: 'all 0.2s',
    borderTop: '3px solid transparent',
    borderBottom: '3px solid #1a237e',
    borderLeft: '3px solid transparent',
    borderRight: '3px solid transparent'
  },
  loadingText: { textAlign: 'center', padding: '15px', color: '#64748b' },
  gridContainer: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  formPanel: { flex: '1.2', minWidth: '320px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', position: 'relative' },
  listPanel: { flex: '1', minWidth: '320px' },
  panelTitle: { margin: '0 0 15px 0', color: '#334155', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  rowFields: { display: 'flex', gap: '12px', width: '100%' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', position: 'relative' },
  label: { fontSize: '14px', color: '#475569', fontWeight: 'bold' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#fff', width: '100%', boxSizing: 'border-box' },
  submitBtn: { padding: '12px', backgroundColor: '#1a237e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '14px', marginTop: '10px' },
  listWrapper: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '650px', overflowY: 'auto' },
  dataItemCard: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.01)' },
  routeBadge: { backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginRight: '8px', display: 'inline-block' },
  itemMainTitle: { fontSize: '15px', color: '#1e293b' },
  itemSubText: { fontSize: '12px', color: '#64748b', marginTop: '#4px' },
  deleteBtn: { padding: '6px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' },
  scheduleBox: { border: '1px solid #e2e8f0', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginTop: '5px' },
  scheduleTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', textAlign: 'center', fontSize: '13px' },
  th: { backgroundColor: '#f1f5f9', padding: '8px', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold' },
  td: { padding: '8px', borderBottom: '1px solid #f1f5f9' },
  searchBarContainer: { backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0' },
  searchFieldsRow: { display: 'flex', gap: '8px', width: '100%' },
  filterSelect: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', outline: 'none' },
  filterInput: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' },
  searchBtn: { padding: '8px 16px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' },
  editItemCard: {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
  },
  dropdownSuggestion: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 999, maxHeight: '200px', overflowY: 'auto', marginTop: '2px' },
  suggestionItem: { padding: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }
};

styles.mapPanel = {
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '12px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
};
styles.mapCanvas = {
  width: '100%',
  height: '320px',
  borderRadius: '8px',
  overflow: 'hidden'
};
styles.coordSummary = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '10px',
  padding: '10px 12px',
  borderRadius: '8px',
  backgroundColor: '#f8fafc',
  color: '#334155',
  fontSize: '13px',
  flexWrap: 'wrap'
};

export default ActionAddDelete;
