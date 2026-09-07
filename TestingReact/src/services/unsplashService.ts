/**
 * @file services/unsplashService.ts
 * @description High-performance Unsplash Live Search & Wallpapers Engine for Next.js Web App.
 */

export interface UnsplashWebPhoto {
  id: string;
  name: string;
  category: string;
  tag: string;
  url: string;
  thumbUrl: string;
  authorName?: string;
  authorUrl?: string;
  likes?: number;
}

export const ACTIVE_UNSPLASH_ACCESS_KEY = "i2KeAy3asEUM1b9-ptMwaSB2ouBROOvS6MMvgV62BCQ";

export const CURATED_WEB_WALLPAPERS: UnsplashWebPhoto[] = [
  // ── 🤖 Robots & AI ──
  {
    id: "robot-1",
    name: "Pepper White AI Robot Companion",
    category: "cyber",
    tag: "ROBOT",
    url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=600&auto=format&fit=crop",
    authorName: "Alex Knight",
  },
  {
    id: "robot-2",
    name: "Futuristic White Cyber Android Cyborg",
    category: "cyber",
    tag: "CYBORG",
    url: "https://plus.unsplash.com/premium_photo-1680402879257-48ffbbc6db1d?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://plus.unsplash.com/premium_photo-1680402879257-48ffbbc6db1d?q=80&w=600&auto=format&fit=crop",
    authorName: "Unsplash Studio",
  },
  {
    id: "robot-3",
    name: "Humanoid Robot Lotus Meditation",
    category: "cyber",
    tag: "AI ZEN",
    url: "https://images.unsplash.com/photo-1601132359864-c974e79890ac?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1601132359864-c974e79890ac?q=80&w=600&auto=format&fit=crop",
    authorName: "Aideal Hwa",
  },

  // ── 🏔️ Mountains & Alpine Lakes ──
  {
    id: "mountain-1",
    name: "Rocky Mountain Peaks & Blue Sky",
    category: "mountain",
    tag: "ALPINE",
    url: "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?q=80&w=600&auto=format&fit=crop",
    authorName: "Guillaume Briard",
  },
  {
    id: "mountain-2",
    name: "Snow-Capped Mountains & Valley",
    category: "mountain",
    tag: "SNOW",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop",
    authorName: "Kalen Emsley",
  },
  {
    id: "mountain-3",
    name: "Dolomites Lake Reflection",
    category: "mountain",
    tag: "DOLOMITES",
    url: "https://images.unsplash.com/photo-1480497490787-505ec076689f?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1480497490787-505ec076689f?q=80&w=600&auto=format&fit=crop",
    authorName: "Luca Bravo",
  },

  // ── 🌐 Cyberpunk & Neon Future ──
  {
    id: "cyber-1",
    name: "Cyber Neon Grid",
    category: "cyber",
    tag: "CYBER",
    url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
    authorName: "Lorenzo Herrera",
  },
  {
    id: "cyber-2",
    name: "Matrix Core Code Rain",
    category: "cyber",
    tag: "MATRIX",
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop",
    authorName: "Markus Spiske",
  },
  {
    id: "cyber-3",
    name: "Tokyo Cyber Alley Neon",
    category: "cyber",
    tag: "TOKYO",
    url: "https://images.unsplash.com/photo-1515260268569-9271009adfdb?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1515260268569-9271009adfdb?q=80&w=600&auto=format&fit=crop",
    authorName: "Aleksandar Pasaric",
  },

  // ── 🎨 Pastel & Liquid Waves ──
  {
    id: "pastel-1",
    name: "Cyan Gradient Fluid Wave",
    category: "pastel",
    tag: "CYAN",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=600&auto=format&fit=crop",
    authorName: "Lucas Benjamin",
  },
  {
    id: "pastel-2",
    name: "Electric Violet Pastel Aura",
    category: "pastel",
    tag: "VIOLET",
    url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop",
    authorName: "David Pisnoy",
  },

  // ── 🪐 Space & Cosmos ──
  {
    id: "space-1",
    name: "Deep Space Andromeda Nebula",
    category: "space",
    tag: "NEBULA",
    url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop",
    authorName: "NASA",
  },
  {
    id: "space-2",
    name: "Earth Night Lights Orbit",
    category: "space",
    tag: "EARTH",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop",
    authorName: "NASA",
  },

  // ── 🌿 Nature & Forests ──
  {
    id: "nature-1",
    name: "Emerald Aurora Borealis",
    category: "nature",
    tag: "AURORA",
    url: "https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?q=80&w=600&auto=format&fit=crop",
    authorName: "Jonatan Pie",
  },
  {
    id: "nature-2",
    name: "Foggy Pine Forest Sunrise",
    category: "nature",
    tag: "FOREST",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1920&auto=format&fit=crop",
    thumbUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=600&auto=format&fit=crop",
    authorName: "Dan Otis",
  },
];

/**
 * Searches Unsplash Live API with caching and fallback
 */
export async function searchUnsplash(
  query: string,
  category: string = "all",
  signal?: AbortSignal
): Promise<UnsplashWebPhoto[]> {
  const cleanQ = (query || "").trim();
  const effectiveQuery =
    cleanQ.length > 0
      ? cleanQ
      : category !== "all"
      ? category === "mountain"
        ? "mountains landscape wallpaper"
        : category === "nature"
        ? "nature aurora forest"
        : category === "cyber"
        ? "cyberpunk neon future robot"
        : category === "space"
        ? "deep space nebula stars"
        : category === "dark"
        ? "dark amoled black minimal"
        : category === "urban"
        ? "supercar city architecture"
        : category === "pastel"
        ? "pastel gradient fluid wave"
        : "wallpaper 4k aesthetic"
      : "wallpaper 4k aesthetic landscape";

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      effectiveQuery
    )}&per_page=24&orientation=landscape`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${ACTIVE_UNSPLASH_ACCESS_KEY}`,
        Accept: "application/json",
      },
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((item: any, idx: number) => ({
          id: item.id || `live-${idx}`,
          name:
            item.description ||
            item.alt_description ||
            `${cleanQ || category} wallpaper ${idx + 1}`,
          category: category,
          tag: (cleanQ || category).toUpperCase().slice(0, 10),
          url: item.urls?.regular || item.urls?.full || item.urls?.small,
          thumbUrl: item.urls?.small || item.urls?.thumb,
          authorName: item.user?.name || "Unsplash Creator",
          authorUrl: item.user?.links?.html,
          likes: item.likes,
        }));
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    // Fallback below
  }

  // Local fallback
  if (cleanQ.length > 0) {
    const matched = CURATED_WEB_WALLPAPERS.filter((w) =>
      w.name.toLowerCase().includes(cleanQ.toLowerCase())
    );
    if (matched.length > 0) return matched;
  }

  return CURATED_WEB_WALLPAPERS;
}
