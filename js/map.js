// 카카오맵에 1·2·3순위 위치를 핀으로 보여준다. 키가 없거나 실패하면 조용히 숨긴다.

/** @typedef {{ lat: number, lng: number }} Point */

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';
const SDK_TIMEOUT = 8000;

/**
 * 좌표가 있으면 그 위치를, 없으면 가게명 검색 결과를 카카오맵에서 연다.
 * @param {string} name
 * @param {Point | null} point
 * @returns {string}
 */
export function kakaoLink(name, point) {
  if (!point) return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
  const label = encodeURIComponent(name.replace(/,/g, ' '));
  return `https://map.kakao.com/link/map/${label},${point.lat},${point.lng}`;
}

/**
 * 주소 → 좌표 조회를 감싸 같은 주소는 다시 묻지 않는다. 실패는 null이고 캐시하지 않는다.
 * @param {(address: string) => Promise<Point | null>} lookup
 * @returns {(address: string) => Promise<Point | null>}
 */
export function cachedLookup(lookup) {
  const cache = new Map();
  return async (address) => {
    const key = (address ?? '').trim();
    if (!key) return null;
    if (!cache.has(key)) cache.set(key, lookup(key));
    try {
      return await cache.get(key);
    } catch (err) {
      console.warn(`주소를 찾지 못했어요: "${key}"`, err);
      cache.delete(key);
      return null;
    }
  };
}

let sdk = null;

/** @returns {Promise<any>} kakao 전역 객체 */
function loadSdk(key) {
  sdk ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    const timer = setTimeout(() => reject(new Error('카카오맵 SDK 응답 없음')), SDK_TIMEOUT);
    script.onload = () => window.kakao.maps.load(() => {
      clearTimeout(timer);
      resolve(window.kakao);
    });
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('카카오맵 SDK를 불러오지 못했어요'));
    };
    document.head.append(script);
  }).catch((err) => {
    sdk = null; // 다음에 다시 시도
    throw err;
  });
  return sdk;
}

/**
 * @param {string} key 카카오 JavaScript 키. 비어 있으면 지도 기능이 꺼진다.
 */
export function createMap(key) {
  let map = null;
  let overlays = [];

  const geocode = cachedLookup(async (address) => {
    const kakao = await loadSdk(key);
    return new Promise((resolve) => {
      new kakao.maps.services.Geocoder().addressSearch(address, (result, status) => {
        const ok = status === kakao.maps.services.Status.OK && result[0];
        if (!ok) console.warn(`주소를 찾지 못했어요: "${address}"`);
        resolve(ok ? { lat: Number(result[0].y), lng: Number(result[0].x) } : null);
      });
    });
  });

  return {
    enabled: Boolean(key),

    /**
     * @param {string} address
     * @returns {Promise<Point | null>}
     */
    locate(address) {
      return key ? geocode(address) : Promise.resolve(null);
    },

    /**
     * 컨테이너가 보이는 상태에서 호출한다.
     * @param {HTMLElement} el
     * @param {{ rank: number, name: string, point: Point }[]} pins
     */
    async show(el, pins) {
      const kakao = await loadSdk(key);
      const { maps } = kakao;
      const positions = pins.map((p) => new maps.LatLng(p.point.lat, p.point.lng));
      if (map) map.relayout();
      else map = new maps.Map(el, { center: positions[0], level: 3 });

      for (const overlay of overlays) overlay.setMap(null);
      overlays = pins.map((pin, i) => {
        const label = document.createElement('div');
        label.className = `pin pin-${pin.rank}`;
        label.append(Object.assign(document.createElement('b'), { textContent: pin.rank }), ` ${pin.name}`);
        return new maps.CustomOverlay({
          map,
          position: positions[i],
          content: label,
          yAnchor: 1,
          zIndex: 10 - pin.rank,
        });
      });

      if (positions.length === 1) {
        map.setLevel(3);
        map.setCenter(positions[0]);
      } else {
        const bounds = new maps.LatLngBounds();
        for (const pos of positions) bounds.extend(pos);
        // 핀 이름표가 좌표 위·좌우로 퍼지므로 그만큼 여백을 둔다.
        map.setBounds(bounds, 56, 80, 24, 80);
      }
    },
  };
}
