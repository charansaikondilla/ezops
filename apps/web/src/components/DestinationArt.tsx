import { type ReactNode } from "react";

/**
 * Built-in destination artwork for proposals ("images as per destination").
 * These are illustrated scenes bundled with the app so they always load, even offline and in print.
 * Real photos uploaded on a day of the itinerary are shown instead whenever they exist.
 */

type Scene = "temple" | "terraces" | "beach" | "skyline" | "mountains" | "karst" | "rock" | "villas" | "backwater" | "globe";

interface Palette { skyTop: string; skyBottom: string; sun: string; sea: string; land: string; accent: string }
interface Info { key: string; name: string; tagline: string; palette: Palette; scenes: { scene: Scene; caption: string }[] }

const DESTINATIONS: Info[] = [
  { key: "bali", name: "Bali", tagline: "Island of the Gods: temples, rice terraces and beach sunsets",
    palette: { skyTop: "#fbd38d", skyBottom: "#fef3c7", sun: "#f97316", sea: "#0ea5b7", land: "#15803d", accent: "#7c2d12" },
    scenes: [{ scene: "temple", caption: "Temples of Ubud" }, { scene: "terraces", caption: "Tegallalang rice terraces" }, { scene: "beach", caption: "Seminyak & Uluwatu sunsets" }] },
  { key: "dubai", name: "Dubai", tagline: "Futuristic skyline, desert dunes and golden souks",
    palette: { skyTop: "#7dd3fc", skyBottom: "#fde68a", sun: "#f59e0b", sea: "#0369a1", land: "#d97706", accent: "#1e3a8a" },
    scenes: [{ scene: "skyline", caption: "Burj Khalifa & Downtown" }, { scene: "beach", caption: "Palm Jumeirah & the Marina" }, { scene: "mountains", caption: "Red dunes desert safari" }] },
  { key: "goa", name: "Goa", tagline: "Sun, sand and Portuguese-era charm",
    palette: { skyTop: "#fdba74", skyBottom: "#fef9c3", sun: "#ef4444", sea: "#0891b2", land: "#16a34a", accent: "#9a3412" },
    scenes: [{ scene: "beach", caption: "Baga & Calangute beaches" }, { scene: "temple", caption: "Old Goa churches" }, { scene: "backwater", caption: "Mandovi river cruise" }] },
  { key: "kerala", name: "Kerala", tagline: "Backwaters, hill stations and spice gardens",
    palette: { skyTop: "#a7f3d0", skyBottom: "#ecfccb", sun: "#facc15", sea: "#0d9488", land: "#166534", accent: "#064e3b" },
    scenes: [{ scene: "backwater", caption: "Alleppey houseboat" }, { scene: "mountains", caption: "Munnar tea hills" }, { scene: "beach", caption: "Kovalam & Varkala" }] },
  { key: "manali", name: "Manali", tagline: "Snow peaks, pine valleys and mountain passes",
    palette: { skyTop: "#93c5fd", skyBottom: "#e0f2fe", sun: "#fde047", sea: "#38bdf8", land: "#166534", accent: "#1e3a8a" },
    scenes: [{ scene: "mountains", caption: "Rohtang & Solang snow" }, { scene: "temple", caption: "Hadimba temple" }, { scene: "backwater", caption: "Beas river valley" }] },
  { key: "phuket", name: "Phuket", tagline: "Limestone islands, turquoise bays and night markets",
    palette: { skyTop: "#fda4af", skyBottom: "#fef3c7", sun: "#fb923c", sea: "#06b6d4", land: "#15803d", accent: "#9f1239" },
    scenes: [{ scene: "karst", caption: "Phi Phi & James Bond island" }, { scene: "beach", caption: "Patong & Kata beaches" }, { scene: "temple", caption: "Big Buddha & Old Town" }] },
  { key: "srilanka", name: "Sri Lanka", tagline: "Ancient rock fortresses, tea country and golden coasts",
    palette: { skyTop: "#fcd34d", skyBottom: "#fef3c7", sun: "#ea580c", sea: "#0e7490", land: "#4d7c0f", accent: "#78350f" },
    scenes: [{ scene: "rock", caption: "Sigiriya rock fortress" }, { scene: "mountains", caption: "Nuwara Eliya tea country" }, { scene: "beach", caption: "Bentota & Mirissa coast" }] },
  { key: "maldives", name: "Maldives", tagline: "Overwater villas on crystal lagoons",
    palette: { skyTop: "#67e8f9", skyBottom: "#ecfeff", sun: "#fde047", sea: "#06b6d4", land: "#fcd34d", accent: "#155e75" },
    scenes: [{ scene: "villas", caption: "Overwater villas" }, { scene: "beach", caption: "White-sand atolls" }, { scene: "karst", caption: "Snorkelling & reefs" }] },
  { key: "singapore", name: "Singapore", tagline: "Garden city: skyline, Sentosa and street food",
    palette: { skyTop: "#a5b4fc", skyBottom: "#fce7f3", sun: "#f472b6", sea: "#0284c7", land: "#15803d", accent: "#312e81" },
    scenes: [{ scene: "skyline", caption: "Marina Bay skyline" }, { scene: "beach", caption: "Sentosa island" }, { scene: "terraces", caption: "Gardens by the Bay" }] },
];

const GENERIC: Info = {
  key: "generic", name: "Your holiday", tagline: "A journey planned around you",
  palette: { skyTop: "#bfdbfe", skyBottom: "#eff6ff", sun: "#fbbf24", sea: "#2563eb", land: "#15803d", accent: "#1e3a8a" },
  scenes: [{ scene: "globe", caption: "Discover" }, { scene: "beach", caption: "Relax" }, { scene: "mountains", caption: "Explore" }],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const ALIASES: Record<string, string> = { dxb: "dubai", uae: "dubai", abudhabi: "dubai", srilanka: "srilanka", colombo: "srilanka", thailand: "phuket", krabi: "phuket", pattaya: "phuket", bangkok: "phuket", ubud: "bali", indonesia: "bali", himachal: "manali", shimla: "manali", munnar: "kerala", cochin: "kerala", kochi: "kerala", alleppey: "kerala" };

export function destinationInfo(destination: string): Info {
  const n = norm(destination);
  const key = ALIASES[n] ?? n;
  return DESTINATIONS.find((d) => d.key === key || n.includes(d.key)) ?? { ...GENERIC, name: destination || GENERIC.name };
}

function Palm({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 Q4 -30 -2 -58" stroke="#78350f" strokeWidth="4" fill="none" strokeLinecap="round" />
      {[-70, -35, 0, 35, 70].map((a) => <path key={a} d="M-2 -58 Q16 -72 34 -58 Q16 -62 -2 -58Z" fill={color} transform={`rotate(${a} -2 -58)`} />)}
    </g>
  );
}

function drawScene(scene: Scene, p: Palette): ReactNode {
  switch (scene) {
    case "temple":
      return (<g>
        <rect x="0" y="150" width="400" height="50" fill={p.land} />
        <g fill={p.accent}><path d="M130 150V70l-12 0 12-14h18l12 14h-12v80z" /><path d="M250 150V70l-12 0 12-14h18l12 14h-12v80z" /></g>
        <g fill={p.accent} opacity="0.9"><rect x="100" y="145" width="60" height="10" /><rect x="220" y="145" width="60" height="10" /><rect x="170" y="130" width="60" height="25" opacity="0.4" /></g>
        <path d="M185 150v-40q15-22 30 0v40z" fill="#fde68a" opacity="0.85" />
        <Palm x={60} y={150} s={0.9} color={p.land} /><Palm x={345} y={150} s={1.1} color={p.land} />
      </g>);
    case "terraces":
      return (<g>
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${110 + i * 22} Q100 ${95 + i * 22} 200 ${108 + i * 22} T400 ${100 + i * 22} V200 H0Z`} fill={i % 2 ? "#16a34a" : "#4ade80"} opacity={0.95 - i * 0.05} />)}
        <Palm x={70} y={120} s={1} color={p.land} /><Palm x={310} y={112} s={0.9} color={p.land} /><Palm x={350} y={125} s={1.2} color={p.land} />
      </g>);
    case "beach":
      return (<g>
        <rect x="0" y="120" width="400" height="80" fill={p.sea} />
        <path d="M0 120h400" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${20 + i * 120} ${138 + i * 8}h60`} stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />)}
        <path d="M0 165 Q120 150 230 168 T400 160 V200 H0Z" fill="#fde68a" />
        <Palm x={310} y={175} s={1.25} color={p.land} /><Palm x={58} y={182} s={0.9} color={p.land} />
      </g>);
    case "skyline":
      return (<g>
        <rect x="0" y="160" width="400" height="40" fill={p.sea} />
        <g fill={p.accent}>
          <rect x="40" y="110" width="30" height="50" /><rect x="78" y="90" width="26" height="70" /><rect x="112" y="120" width="34" height="40" />
          <path d="M190 160 L198 40 L206 160Z" /><rect x="170" y="130" width="46" height="30" opacity="0.85" />
          <rect x="228" y="100" width="28" height="60" /><rect x="264" y="125" width="36" height="35" /><rect x="308" y="85" width="24" height="75" /><rect x="340" y="115" width="34" height="45" />
        </g>
        <g fill="#fef3c7" opacity="0.8">{[48, 56, 84, 92, 236, 314, 346].map((x) => <rect key={x} x={x} y={120} width="4" height="5" />)}</g>
      </g>);
    case "mountains":
      return (<g>
        <path d="M0 160 L90 70 L140 120 L200 50 L280 140 L330 95 L400 160 V200 H0Z" fill="#94a3b8" />
        <path d="M200 50 L180 80 L196 76 L204 88 L214 74 L228 82Z" fill="#fff" />
        <path d="M90 70 L76 90 L90 86 L98 96 L108 84Z" fill="#fff" />
        <path d="M0 175 Q100 150 200 170 T400 165 V200 H0Z" fill={p.land} />
        {[40, 70, 330, 365].map((x) => <path key={x} d={`M${x} 178 l10 -30 l10 30z`} fill="#14532d" />)}
      </g>);
    case "karst":
      return (<g>
        <rect x="0" y="130" width="400" height="70" fill={p.sea} />
        <path d="M60 135 Q62 70 84 60 Q104 72 108 135Z" fill="#78716c" /><path d="M60 135 Q62 100 70 92" stroke="#a8a29e" strokeWidth="3" fill="none" />
        <path d="M230 135 Q236 55 262 45 Q292 60 296 135Z" fill="#78716c" /><path d="M150 135 Q154 95 170 90 Q186 98 190 135Z" fill="#a8a29e" />
        {[60, 140, 230, 320].map((x) => <path key={x} d={`M${x} 170h50`} stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />)}
        <path d="M300 150 q20 12 52 0 l-6 -10 h-40z" fill={p.accent} />
      </g>);
    case "rock":
      return (<g>
        <rect x="0" y="165" width="400" height="35" fill={p.land} />
        <path d="M120 165 Q130 90 170 80 Q200 60 230 80 Q270 90 285 165Z" fill="#a16207" />
        <path d="M140 100 Q200 82 262 102 L270 112 Q200 98 135 114Z" fill="#92400e" opacity="0.7" />
        <path d="M150 85 Q200 40 255 85 Q200 70 150 85Z" fill={p.land} />
        <Palm x={60} y={170} s={1.1} color={p.land} /><Palm x={335} y={172} s={1} color={p.land} />
      </g>);
    case "villas":
      return (<g>
        <rect x="0" y="110" width="400" height="90" fill={p.sea} />
        <path d="M0 150 Q100 140 200 152 T400 148 V200 H0Z" fill="#22d3ee" opacity="0.6" />
        {[70, 160, 250, 330].map((x, i) => <g key={x}><path d={`M${x} ${112 + i * 6} l20 -18 l20 18z`} fill="#b45309" /><rect x={x + 2} y={112 + i * 6} width="36" height="10" fill="#fef3c7" /><rect x={x - 12} y={124 + i * 6} width="64" height="4" fill="#92400e" /></g>)}
        <path d="M70 134 H330" stroke="#92400e" strokeWidth="3" />
      </g>);
    case "backwater":
      return (<g>
        <rect x="0" y="125" width="400" height="75" fill={p.sea} />
        {[10, 60, 330, 370].map((x) => <Palm key={x} x={x} y={128} s={1.1} color={p.land} />)}
        <path d="M120 150 q40 24 150 0 l-14 -12 h-122z" fill={p.accent} /><path d="M140 138 q60 -26 112 0z" fill="#f59e0b" />
        <path d="M0 175h400" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" />
      </g>);
    default:
      return (<g>
        <circle cx="200" cy="105" r="62" fill={p.sea} /><path d="M160 90 q20 -24 44 -6 q10 14 -8 24 q-24 8 -36 -18Z M206 118 q22 -4 26 16 q-12 18 -28 6Z" fill={p.land} />
        <ellipse cx="200" cy="105" rx="92" ry="22" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="6 6" />
        <path d="M280 90 l22 -8 l-6 16 l-8 -4z" fill="#fff" />
      </g>);
  }
}

/** One scenic banner for the destination. `variant` 0–2 picks the scene; the SVG scales to its container. */
export function DestinationBanner({ destination, variant = 0, className, label }: { destination: string; variant?: number; className?: string; label?: string }) {
  const info = destinationInfo(destination);
  const sc = info.scenes[variant % info.scenes.length]!;
  const id = `g-${info.key}-${variant}`;
  return (
    <svg viewBox="0 0 400 200" role="img" aria-label={label ?? `${info.name}: ${sc.caption}`} className={className} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={info.palette.skyTop} /><stop offset="1" stopColor={info.palette.skyBottom} /></linearGradient></defs>
      <rect width="400" height="200" fill={`url(#${id})`} />
      <circle cx={variant % 2 ? 310 : 90} cy="52" r="26" fill={info.palette.sun} opacity="0.9" />
      {drawScene(sc.scene, info.palette)}
    </svg>
  );
}

/** Hero banner plus three captioned scenes, for the top of a proposal. */
export function DestinationGallery({ destination, tagline = true }: { destination: string; tagline?: boolean }) {
  const info = destinationInfo(destination);
  return (
    <div className="destination-gallery">
      <div className="relative overflow-hidden rounded-xl">
        <DestinationBanner destination={destination} variant={0} className="h-40 w-full sm:h-48" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10 text-white">
          <div className="text-xl font-semibold drop-shadow">{info.name}</div>
          {tagline && <div className="text-xs opacity-95">{info.tagline}</div>}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {info.scenes.map((s, i) => (
          <figure key={s.caption} className="overflow-hidden rounded-lg border border-line">
            <DestinationBanner destination={destination} variant={i} className="h-20 w-full" />
            <figcaption className="px-2 py-1 text-center text-[11px] text-ink-600">{s.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
