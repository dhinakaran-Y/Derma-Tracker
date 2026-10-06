/**
 * Client-Side Device Model Detector
 * Uses User-Agent Client Hints (UA-CH) and navigator.userAgent to detect real hardware names
 * such as Realme 7, Oppo A23, Samsung Galaxy S23, etc.
 */

// Popular model identifier mapping
export const KNOWN_DEVICE_MODELS: Record<string, string> = {
  // Realme 7 & Realme Series
  'RMX2151': 'Realme 7',
  'RMX2155': 'Realme 7',
  'RMX2156': 'Realme 7',
  'RMX2157': 'Realme 7',
  'RMX2161': 'Realme 7 5G',
  'RMX2163': 'Realme 7 5G',
  'RMX2170': 'Realme 7 Pro',
  'RMX2001': 'Realme 6',
  'RMX2002': 'Realme 6',
  'RMX2061': 'Realme 6 Pro',
  'RMX3085': 'Realme 8',
  'RMX3081': 'Realme 8 Pro',
  'RMX3241': 'Realme 8 5G',
  'RMX3392': 'Realme 9 Pro+',
  'RMX3393': 'Realme 9 Pro+',
  'RMX3471': 'Realme 9 Pro 5G',
  'RMX3472': 'Realme 9 Pro 5G',
  'RMX3630': 'Realme 10',
  'RMX3686': 'Realme 10 Pro 5G',
  'RMX3741': 'Realme 11 Pro 5G',
  'RMX3740': 'Realme 11 Pro 5G',
  'RMX3771': 'Realme 11 Pro+ 5G',
  'RMX3840': 'Realme 12 Pro+ 5G',
  'RMX3842': 'Realme 12 Pro 5G',
  'RMX3999': 'Realme 12x 5G',

  // Oppo A23 & Oppo Series
  'CPH2579': 'Oppo A23',
  'CPH2577': 'Oppo A23 5G',
  'CPH2527': 'Oppo Reno10 5G',
  'CPH2525': 'Oppo Reno10 Pro 5G',
  'CPH2437': 'Oppo Find N2 Flip',
  'CPH2343': 'Oppo A96',
  'CPH2385': 'Oppo A77s',
  'CPH2387': 'Oppo A77 5G',
  'CPH2269': 'Oppo A16',
  'CPH2185': 'Oppo A15',
  'CPH2219': 'Oppo A54',
  'CPH2239': 'Oppo A54',
  'CPH2357': 'Oppo A57',
  'CPH2477': 'Oppo A78 5G',
  'CPH2565': 'Oppo A79 5G',
  'CPH2573': 'Oppo A59 5G',
  'CPH2607': 'Oppo Reno11 5G',

  // OnePlus
  'IN2011': 'OnePlus 8',
  'IN2015': 'OnePlus 8',
  'IN2021': 'OnePlus 8 Pro',
  'KB2001': 'OnePlus 8T',
  'LE2101': 'OnePlus 9R',
  'LE2111': 'OnePlus 9',
  'LE2121': 'OnePlus 9 Pro',
  'NE2211': 'OnePlus 10 Pro',
  'CPH2413': 'OnePlus 11R',
  'CPH2449': 'OnePlus 11',
  'CPH2585': 'OnePlus 12R',
  'CPH2581': 'OnePlus 12',
  'DN2101': 'OnePlus Nord 2',
  'CPH2399': 'OnePlus Nord CE 2',
  'CPH2467': 'OnePlus Nord CE 3 Lite',
  'CPH2513': 'OnePlus Nord CE 3',

  // Vivo / iQOO
  'V2027': 'Vivo Y20',
  'V2029': 'Vivo Y20i',
  'V2032': 'Vivo Y20G',
  'V2037': 'Vivo Y12s',
  'V2043': 'Vivo V20 Pro',
  'V2066': 'Vivo Y31',
  'V2109': 'Vivo Y73',
  'V2145': 'Vivo T1 5G',
  'V2238': 'Vivo V27 5G',
  'V2240': 'Vivo V27 Pro',
  'V2318': 'Vivo V29 5G',
  'V2324': 'Vivo X100',
  'V2303': 'Vivo V30 5G',
  'I2011': 'iQOO 7',
  'I2012': 'iQOO 7 Legend',
  'I2126': 'iQOO Neo 6',
  'I2207': 'iQOO Neo 7',

  // Samsung Galaxy
  'SM-S928B': 'Samsung Galaxy S24 Ultra',
  'SM-S921B': 'Samsung Galaxy S24',
  'SM-S918B': 'Samsung Galaxy S23 Ultra',
  'SM-S911B': 'Samsung Galaxy S23',
  'SM-S908B': 'Samsung Galaxy S22 Ultra',
  'SM-S901B': 'Samsung Galaxy S22',
  'SM-G998B': 'Samsung Galaxy S21 Ultra',
  'SM-G991B': 'Samsung Galaxy S21',
  'SM-A546E': 'Samsung Galaxy A54 5G',
  'SM-A536E': 'Samsung Galaxy A53 5G',
  'SM-A525F': 'Samsung Galaxy A52',
  'SM-A346E': 'Samsung Galaxy A34 5G',
  'SM-A145F': 'Samsung Galaxy A14',
  'SM-M346B': 'Samsung Galaxy M34 5G',
  'SM-M336B': 'Samsung Galaxy M33 5G',
  'SM-F946B': 'Samsung Galaxy Z Fold 5',
  'SM-F731B': 'Samsung Galaxy Z Flip 5',
};

export function formatModelToFriendlyName(rawModel?: string): string | null {
  if (!rawModel || typeof rawModel !== 'string') return null;
  const clean = rawModel.trim().replace(/^["']|["']$/g, '');
  if (!clean || clean.length < 2) return null;

  const upper = clean.toUpperCase();
  if (KNOWN_DEVICE_MODELS[upper]) {
    return KNOWN_DEVICE_MODELS[upper];
  }

  // Model prefix pattern matching
  if (/^RMX\d+/i.test(clean)) {
    return `Realme ${clean.toUpperCase()}`;
  }
  if (/^CPH\d+/i.test(clean) || /^PCH\d+/i.test(clean) || /^PD\d+/i.test(clean)) {
    return `Oppo ${clean.toUpperCase()}`;
  }
  if (/^SM-S\d+/i.test(clean) || /^SM-G\d+/i.test(clean) || /^SM-N\d+/i.test(clean)) {
    return `Samsung Galaxy ${clean.toUpperCase()}`;
  }
  if (/^SM-A\d+/i.test(clean) || /^SM-M\d+/i.test(clean) || /^SM-F\d+/i.test(clean)) {
    return `Samsung Galaxy ${clean.toUpperCase()}`;
  }
  if (/^SM-/i.test(clean)) {
    return `Samsung ${clean.toUpperCase()}`;
  }
  if (/^V\d{4}/i.test(clean)) {
    return `Vivo ${clean.toUpperCase()}`;
  }
  if (/^I\d{4}/i.test(clean)) {
    return `iQOO ${clean.toUpperCase()}`;
  }
  if (/^Pixel/i.test(clean)) {
    return `Google ${clean}`;
  }
  if (/^iPhone/i.test(clean)) {
    return 'Apple iPhone';
  }
  if (/^iPad/i.test(clean)) {
    return 'Apple iPad';
  }

  if (/^(realme|oppo|vivo|oneplus|samsung|redmi|poco|xiaomi|google|motorola|apple)\b/i.test(clean)) {
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return clean;
}

/**
 * Asynchronously detects the client device name.
 * Inspects navigator.userAgentData for high-entropy model info first,
 * then falls back to userAgent pattern matching.
 */
export async function detectClientDeviceName(): Promise<string> {
  if (typeof window === 'undefined') return 'Mobile Device';

  // Priority 1: User-Agent Client Hints (Chromium / Chrome on Android)
  try {
    const nav = navigator as any;
    if (nav?.userAgentData?.getHighEntropyValues) {
      const data = await nav.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      if (data?.model && data.model !== 'K' && data.model !== 'Android') {
        const friendly = formatModelToFriendlyName(data.model);
        if (friendly) return friendly;
      }
    }
  } catch {}

  // Priority 2: Parse from navigator.userAgent
  try {
    const ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';

    const buildMatch = ua.match(/;\s*([^;)]+?)\s*Build\//i);
    if (buildMatch && buildMatch[1]) {
      const rawModel = buildMatch[1].trim();
      if (rawModel && rawModel !== 'K' && !/^Android/i.test(rawModel)) {
        const friendly = formatModelToFriendlyName(rawModel);
        if (friendly) return friendly;
      }
    }

    const brandMatch = ua.match(/\b(Realme\s*[A-Za-z0-9\s+]+|Oppo\s*[A-Za-z0-9\s+]+|OnePlus\s*[A-Za-z0-9\s+]+|Redmi\s*[A-Za-z0-9\s+]+|POCO\s*[A-Za-z0-9\s+]+|Vivo\s*[A-Za-z0-9\s+]+|Pixel\s*[A-Za-z0-9\s+]+)\b/i);
    if (brandMatch && brandMatch[1]) {
      return brandMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (/Android/i.test(ua)) return 'Android Phone';
  } catch {}

  return 'Mobile Device';
}
