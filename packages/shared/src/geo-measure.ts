/* Medidas geográficas puras (sem dependências de navegador).
   - Distância geodésica no elipsoide WGS-84 (Vincenty, problema inverso), com fallback esférico (haversine)
     quando Vincenty não converge (pontos quase antípodas).
   - Azimute inicial (a partir do norte, sentido horário, 0–360°).
   - Área de polígono sobre a esfera (fórmula de Chamberlain–Duquette): aproximação para medições táticas;
     não usa o elipsoide. */

export interface LatLon {
  lat: number;
  lon: number;
}

/* raio médio da Terra (IUGG): fallback esférico e área */
export const EARTH_RADIUS_KM = 6371.0088;

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = (1 - WGS84_F) * WGS84_A;

export const KM_PER_MILE = 1.609344;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/* normaliza um ângulo para [0, 360) */
export function normalizeBearing(d: number): number {
  const x = d % 360;
  return x < 0 ? x + 360 : x;
}

/* Distância de grande círculo (esférica), em km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const dφ = φ2 - φ1;
  const dλ = rad(b.lon - a.lon);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeodesicInverse {
  distanceKm: number;
  /* azimute de saída em a (a -> b) */
  azimuthDeg: number;
  /* azimute de saída em b, apontando de volta para a (b -> a) */
  backAzimuthDeg: number;
  /* true quando veio do fallback esférico */
  approximate: boolean;
}

const ZERO: GeodesicInverse = { distanceKm: 0, azimuthDeg: 0, backAzimuthDeg: 0, approximate: false };

/* Problema inverso de Vincenty (WGS-84). Devolve null se não convergir. */
export function vincentyInverse(a: LatLon, b: LatLon): GeodesicInverse | null {
  if (a.lat === b.lat && a.lon === b.lon) return ZERO;
  const L = rad(b.lon - a.lon);
  const U1 = Math.atan((1 - WGS84_F) * Math.tan(rad(a.lat)));
  const U2 = Math.atan((1 - WGS84_F) * Math.tan(rad(b.lat)));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP: number;
  let iter = 200;
  let sinSigma = 0;
  let cosSigma = 0;
  let sigma = 0;
  let sinAlpha = 0;
  let cosSqAlpha = 0;
  let cos2SigmaM = 0;
  let sinLambda = 0;
  let cosLambda = 0;
  do {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    const t1 = cosU2 * sinLambda;
    const t2 = cosU1 * sinU2 - sinU1 * cosU2 * cosLambda;
    sinSigma = Math.sqrt(t1 * t1 + t2 * t2);
    if (sinSigma === 0) return ZERO;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;
    const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) * WGS84_F * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iter > 0);

  if (iter === 0 || !Number.isFinite(lambda)) return null;

  const uSq = (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  const s = WGS84_B * A * (sigma - deltaSigma);

  const alpha1 = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
  const alpha2 = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);
  return {
    distanceKm: s / 1000,
    azimuthDeg: normalizeBearing(deg(alpha1)),
    backAzimuthDeg: normalizeBearing(deg(alpha2) + 180),
    approximate: false,
  };
}

/* Fallback esférico, usado só se Vincenty não convergir. */
function sphericalInverse(a: LatLon, b: LatLon): GeodesicInverse {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const dλ = rad(b.lon - a.lon);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const yb = -Math.sin(dλ) * Math.cos(φ1);
  const xb = Math.cos(φ2) * Math.sin(φ1) - Math.sin(φ2) * Math.cos(φ1) * Math.cos(dλ);
  return {
    distanceKm: haversineKm(a, b),
    azimuthDeg: normalizeBearing(deg(Math.atan2(y, x))),
    backAzimuthDeg: normalizeBearing(deg(Math.atan2(yb, xb))),
    approximate: true,
  };
}

/* Problema inverso completo: Vincenty, ou esférico se Vincenty falhar. */
export function geodesicInverse(a: LatLon, b: LatLon): GeodesicInverse {
  return vincentyInverse(a, b) ?? sphericalInverse(a, b);
}

/* Distância geodésica em km (WGS-84, com fallback esférico). */
export function geodesicDistanceKm(a: LatLon, b: LatLon): number {
  return geodesicInverse(a, b).distanceKm;
}

/* Azimute inicial de a para b, em graus a partir do norte (0–360). */
export function azimuthDeg(a: LatLon, b: LatLon): number {
  return geodesicInverse(a, b).azimuthDeg;
}

/* Rosa dos ventos de 16 direções para um azimute. */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function compassPoint(az: number): string {
  return COMPASS[Math.round(normalizeBearing(az) / 22.5) % 16] ?? 'N';
}

/* Área (km²) de um polígono geográfico, sobre a esfera. O anel fecha sozinho (último -> primeiro). */
export function polygonAreaKm2(points: readonly LatLon[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    let dλ = rad(p3.lon - p1.lon);
    if (dλ > Math.PI) dλ -= 2 * Math.PI;
    if (dλ < -Math.PI) dλ += 2 * Math.PI;
    total += dλ * Math.sin(rad(p2.lat));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

/* Perímetro (km) de um anel fechado. */
export function ringPerimeterKm(points: readonly LatLon[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += geodesicDistanceKm(a, b);
  }
  return sum;
}

export const kmToMiles = (km: number): number => km / KM_PER_MILE;
