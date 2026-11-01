"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export const GLOBAL_CINEMA_HUBS = [
  {
    id: "india",
    country: "India",
    flag: "🇮🇳",
    lat: 21,
    lon: 78,
    movie: "RRR",
    year: "2022",
    genre: "Action · Epic",
    director: "S.S. Rajamouli",
    quote: "A ferocious tale of fire and water.",
    searchQuery: "RRR",
    posterUrl: "https://image.tmdb.org/t/p/w200/wE0I6efAW4cDDmZQWtwZMOW44EJ.jpg",
  },
  {
    id: "usa",
    country: "United States",
    flag: "🇺🇸",
    lat: 38,
    lon: -97,
    movie: "Inception",
    year: "2010",
    genre: "Sci-Fi · Thriller",
    director: "Christopher Nolan",
    quote: "Your mind is the scene of the crime.",
    searchQuery: "Inception",
    posterUrl: "https://image.tmdb.org/t/p/w200/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg",
  },
  {
    id: "japan",
    country: "Japan",
    flag: "🇯🇵",
    lat: 36,
    lon: 138,
    movie: "Spirited Away",
    year: "2001",
    genre: "Animation · Fantasy",
    director: "Hayao Miyazaki",
    quote: "A magical journey into the spirit world.",
    searchQuery: "Spirited Away",
    posterUrl: "https://image.tmdb.org/t/p/w200/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
  },
  {
    id: "south-korea",
    country: "South Korea",
    flag: "🇰🇷",
    lat: 36,
    lon: 128,
    movie: "Parasite",
    year: "2019",
    genre: "Thriller · Drama",
    director: "Bong Joon-ho",
    quote: "Act like you own the place.",
    searchQuery: "Parasite",
    posterUrl: "https://image.tmdb.org/t/p/w200/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  },
  {
    id: "uk",
    country: "United Kingdom",
    flag: "🇬🇧",
    lat: 54,
    lon: -2,
    movie: "The Dark Knight",
    year: "2008",
    genre: "Action · Crime",
    director: "Christopher Nolan",
    quote: "Why so serious?",
    searchQuery: "The Dark Knight",
    posterUrl: "https://image.tmdb.org/t/p/w200/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
  },
  {
    id: "france",
    country: "France",
    flag: "🇫🇷",
    lat: 46,
    lon: 2,
    movie: "Amélie",
    year: "2001",
    genre: "Romance · Whimsical",
    director: "Jean-Pierre Jeunet",
    quote: "She will change your life.",
    searchQuery: "Amelie",
    posterUrl: "https://image.tmdb.org/t/p/w200/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg",
  },
  {
    id: "italy",
    country: "Italy",
    flag: "🇮🇹",
    lat: 42,
    lon: 12,
    movie: "Cinema Paradiso",
    year: "1988",
    genre: "Drama · Nostalgia",
    director: "Giuseppe Tornatore",
    quote: "The enchanting magic of the silver screen.",
    searchQuery: "Cinema Paradiso",
    posterUrl: "https://image.tmdb.org/t/p/w200/aRgPnx4aPS96f7CnhJH7IG5dN1A.jpg",
  },
  {
    id: "mexico",
    country: "Mexico",
    flag: "🇲🇽",
    lat: 23,
    lon: -102,
    movie: "Pan's Labyrinth",
    year: "2006",
    genre: "Dark Fantasy · Drama",
    director: "Guillermo del Toro",
    quote: "Innocence has a power evil cannot imagine.",
    searchQuery: "Pan's Labyrinth",
    posterUrl: "https://image.tmdb.org/t/p/w200/khBQ6nN5FLfg9XgPXIZDkABJjqo.jpg",
  },
  {
    id: "brazil",
    country: "Brazil",
    flag: "🇧🇷",
    lat: -14,
    lon: -51,
    movie: "City of God",
    year: "2002",
    genre: "Crime · Drama",
    director: "Fernando Meirelles",
    quote: "Fight and you will never survive. Run and you will never escape.",
    searchQuery: "City of God",
    posterUrl: "https://image.tmdb.org/t/p/w200/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg",
  },
  {
    id: "australia",
    country: "Australia",
    flag: "🇦🇺",
    lat: -25,
    lon: 134,
    movie: "Mad Max: Fury Road",
    year: "2015",
    genre: "Action · Sci-Fi",
    director: "George Miller",
    quote: "What a lovely day.",
    searchQuery: "Mad Max Fury Road",
    posterUrl: "https://image.tmdb.org/t/p/w200/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg",
  },
  {
    id: "germany",
    country: "Germany",
    flag: "🇩🇪",
    lat: 51,
    lon: 10,
    movie: "The Lives of Others",
    year: "2006",
    genre: "Drama · Thriller",
    director: "Florian Henckel von Donnersmarck",
    quote: "In the quiet of surveillance, truth unfolds.",
    searchQuery: "The Lives of Others",
    posterUrl: "https://image.tmdb.org/t/p/w200/cVUDMnskSc01rdbyH0tLATTJUdP.jpg",
  },
  {
    id: "nigeria",
    country: "Nigeria",
    flag: "🇳🇬",
    lat: 9,
    lon: 8,
    movie: "Lionheart",
    year: "2018",
    genre: "Drama · Comedy",
    director: "Genevieve Nnaji",
    quote: "Stepping up to protect the family legacy.",
    searchQuery: "Lionheart",
    posterUrl: "https://image.tmdb.org/t/p/w200/u68AjlvlutfEIcpmbYpKcdi09ut.jpg",
  },
];

// Simplified continent landmass points (lat, lon) for recognizable 3D globe outline
const CONTINENT_POINTS = [
  // North America
  [65, -150], [68, -135], [60, -120], [55, -110], [52, -90], [55, -75], [60, -65],
  [48, -124], [45, -100], [42, -85], [44, -70], [38, -122], [35, -105], [36, -88],
  [34, -78], [30, -115], [30, -95], [28, -82], [24, -102], [20, -100], [18, -95],
  [15, -90], [10, -84], [64, -50], [70, -40], [75, -35],
  // South America
  [8, -75], [5, -60], [2, -78], [-2, -60], [-5, -75], [-5, -45], [-10, -55],
  [-12, -76], [-15, -45], [-20, -65], [-22, -44], [-25, -55], [-30, -68], [-32, -52],
  [-38, -62], [-45, -68], [-52, -70], [-54, -66],
  // Europe
  [60, 5], [64, 15], [60, 25], [55, 35], [58, -4], [52, 0], [50, 10], [52, 20],
  [48, 30], [46, -1], [45, 10], [44, 25], [40, -4], [38, 15], [38, 23], [36, -5],
  // Africa
  [34, -5], [35, 10], [32, 25], [30, 32], [25, 0], [24, 20], [22, 35], [15, -15],
  [14, 0], [12, 18], [10, 38], [10, 48], [5, -5], [4, 10], [2, 25], [0, 40],
  [-5, 15], [-5, 30], [-10, 20], [-10, 38], [-18, 15], [-20, 28], [-20, 34],
  [-28, 18], [-30, 26], [-33, 20], [-34, 26], [-18, 47],
  // Asia
  [70, 75], [68, 100], [65, 130], [62, 160], [58, 60], [55, 85], [54, 110], [52, 135],
  [46, 50], [45, 75], [44, 105], [42, 125], [40, 140], [38, 60], [36, 85], [34, 110],
  [35, 130], [35, 138], [32, 53], [28, 70], [28, 85], [26, 105], [24, 120], [22, 80],
  [20, 95], [18, 108], [15, 76], [12, 105], [10, 78], [1, 104], [-2, 115], [-5, 106],
  [8, 122], [14, 121], [24, 45], [16, 48],
  // Australia & New Zealand
  [-15, 130], [-18, 140], [-20, 120], [-24, 135], [-25, 150], [-30, 118], [-32, 135],
  [-34, 150], [-36, 145], [-42, 146], [-38, 175], [-44, 170],
];

function project3D(lat, lon, R, rotX, rotY, cx, cy) {
  const phi = (lat * Math.PI) / 180;
  const theta = ((lon + rotY) * Math.PI) / 180;

  const x0 = Math.cos(phi) * Math.sin(theta);
  const y0 = Math.sin(phi);
  const z0 = Math.cos(phi) * Math.cos(theta);

  const radX = (rotX * Math.PI) / 180;
  const y1 = y0 * Math.cos(radX) - z0 * Math.sin(radX);
  const z1 = y0 * Math.sin(radX) + z0 * Math.cos(radX);
  const x1 = x0;

  return {
    x: cx + x1 * R,
    y: cy - y1 * R,
    z: z1,
    visible: z1 > 0,
  };
}

export default function CinemaGlobe() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const hubElementsRef = useRef({});

  const [activeHub, setActiveHub] = useState(GLOBAL_CINEMA_HUBS[0]);
  const [popupPos, setPopupPos] = useState({ x: 260, y: 140 });
  const [isHovered, setIsHovered] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // Rotation physics & tracking state (starts centered on India, lon 78)
  const rotYRef = useRef(-78);
  const rotXRef = useRef(12);
  const targetRotYRef = useRef(-78);
  const targetRotXRef = useRef(12);
  const isPointerDownRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const projectedHubsRef = useRef([]);

  // Auto-align when user clicks a specific hub pill or mini poster
  function focusHub(hub) {
    setActiveHub(hub);
    targetRotYRef.current = -hub.lon;
    targetRotXRef.current = Math.max(-25, Math.min(25, hub.lat * 0.4));
  }

  // Pointer event handlers for intuitive 3D mouse/touch interaction
  function handlePointerDown(e) {
    isPointerDownRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setIsInteracting(true);
  }

  function handlePointerMove(e) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPointerDownRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      targetRotYRef.current += dx * 0.45;
      targetRotXRef.current = Math.max(-38, Math.min(38, targetRotXRef.current - dy * 0.35));
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // When moving cursor freely over the globe, tilt subtly towards the cursor
    const normX = (mouseX / rect.width) * 2 - 1;
    const normY = (mouseY / rect.height) * 2 - 1;
    targetRotXRef.current = Math.max(-30, Math.min(30, -normY * 20));

    // Check if mouse is hovering over or very close to any projected country pin
    let closestHub = null;
    let minDistance = 38;

    for (const item of projectedHubsRef.current) {
      if (item.visible && item.z > 0.15) {
        const dist = Math.hypot(mouseX - item.x, mouseY - item.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestHub = item.hub;
        }
      }
    }

    if (closestHub && closestHub.id !== activeHub?.id) {
      setActiveHub(closestHub);
    }
  }

  function handlePointerUp() {
    isPointerDownRef.current = false;
    setIsInteracting(false);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let pulsePhase = 0;

    function render() {
      // Smooth interpolation (lerp) toward target rotations
      rotYRef.current += (targetRotYRef.current - rotYRef.current) * 0.08;
      rotXRef.current += (targetRotXRef.current - rotXRef.current) * 0.08;

      // When the user is not actively dragging or hovering near a pin, maintain a gentle ambient rotation
      if (!isPointerDownRef.current && !isHovered) {
        targetRotYRef.current += 0.20;
      }

      pulsePhase = (pulsePhase + 0.04) % (Math.PI * 2);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * 0.40;

      const rotY = rotYRef.current;
      const rotX = rotXRef.current;

      // 1. Atmospheric Back Glow
      const atmosGrad = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.25);
      atmosGrad.addColorStop(0, "rgba(56, 189, 248, 0.08)");
      atmosGrad.addColorStop(0.65, "rgba(56, 189, 248, 0.02)");
      atmosGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = atmosGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base Sphere & Shading
      const sphereGrad = ctx.createRadialGradient(
        cx - R * 0.35,
        cy - R * 0.35,
        R * 0.1,
        cx,
        cy,
        R
      );
      sphereGrad.addColorStop(0, "#191d1e");
      sphereGrad.addColorStop(0.7, "#0f1214");
      sphereGrad.addColorStop(1, "#080a0c");

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Outer rim edge
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 3. Coordinate Graticule (Parallels & Meridians)
      ctx.lineWidth = 1;
      const latitudes = [-50, -25, 0, 25, 50];
      for (const lat of latitudes) {
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 8) {
          const p = project3D(lat, lon, R, rotX, rotY, cx, cy);
          if (p.visible) {
            if (first) {
              ctx.moveTo(p.x, p.y);
              first = false;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = lat === 0 ? "rgba(56, 189, 248, 0.22)" : "rgba(255, 255, 255, 0.04)";
        ctx.stroke();
      }

      // Meridians
      for (let lon = -180; lon < 180; lon += 45) {
        ctx.beginPath();
        let first = true;
        for (let lat = -80; lat <= 80; lat += 6) {
          const p = project3D(lat, lon, R, rotX, rotY, cx, cy);
          if (p.visible) {
            if (first) {
              ctx.moveTo(p.x, p.y);
              first = false;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.stroke();
      }

      // 4. Continent Points (World Landmass Dot Grid)
      for (const [lat, lon] of CONTINENT_POINTS) {
        const p = project3D(lat, lon, R, rotX, rotY, cx, cy);
        if (p.visible) {
          const alpha = Math.max(0.08, p.z);
          ctx.fillStyle = `rgba(243, 241, 233, ${alpha * 0.42})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Global Cinema Hubs & Interactive Pins
      const projectedHubs = [];

      for (const hub of GLOBAL_CINEMA_HUBS) {
        const p = project3D(hub.lat, hub.lon, R, rotX, rotY, cx, cy);
        projectedHubs.push({ hub, ...p });
      }

      projectedHubsRef.current = projectedHubs;

      // Draw active connecting arcs
      const activeProj = projectedHubs.find((item) => item.hub.id === activeHub?.id);

      if (activeProj && activeProj.visible) {
        setPopupPos({ x: activeProj.x, y: activeProj.y });

        for (const item of projectedHubs) {
          if (item.hub.id !== activeHub.id && item.visible && item.z > 0.2) {
            const midLat = (activeHub.lat + item.hub.lat) / 2;
            const midLon = (activeHub.lon + item.hub.lon) / 2;
            const midP = project3D(midLat, midLon, R * 1.14, rotX, rotY, cx, cy);

            ctx.beginPath();
            ctx.moveTo(activeProj.x, activeProj.y);
            ctx.quadraticCurveTo(midP.x, midP.y, item.x, item.y);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Render each country hub pin and anchor tether line
      for (const item of projectedHubs) {
        if (!item.visible) continue;

        const isCurrent = item.hub.id === activeHub?.id;
        const baseAlpha = Math.max(0.3, item.z);

        // Glowing vertical tether pointing up to the floating poster
        if (item.z > 0.22) {
          const tetherAlpha = Math.min(1, Math.max(0, (item.z - 0.22) / 0.35));
          ctx.beginPath();
          ctx.moveTo(item.x, item.y - 2);
          ctx.lineTo(item.x, item.y - 12);
          ctx.strokeStyle = isCurrent
            ? `rgba(56, 189, 248, ${0.85 * tetherAlpha})`
            : `rgba(56, 189, 248, ${0.4 * tetherAlpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        if (isCurrent) {
          // Pulsing focus rings
          const pulseR = 5 + Math.sin(pulsePhase) * 2.5;
          ctx.beginPath();
          ctx.arc(item.x, item.y, pulseR + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(item.x, item.y, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();

          // Country flag tag
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(item.hub.flag, item.x, item.y - 14);
        } else {
          // Subtle country pin
          ctx.beginPath();
          ctx.arc(item.x, item.y, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${baseAlpha * 0.85})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(item.x, item.y, 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * 0.28})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Update 3D popping mini movie posters overlay in sync with sphere rotation
      for (const item of projectedHubs) {
        const el = hubElementsRef.current[item.hub.id];
        if (!el) continue;

        if (item.visible && item.z > 0.22) {
          const popProgress = Math.min(1, Math.max(0, (item.z - 0.22) / 0.32));
          const bob = Math.sin(pulsePhase * 2 + item.hub.lat * 0.1) * 3.5;
          const scale = 0.72 + popProgress * 0.36;
          const posX = item.x - 22; // Center 44px card horizontally
          const posY = item.y - 74 + bob; // Float above country dot

          el.style.transform = `translate3d(${posX.toFixed(1)}px, ${posY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.opacity = popProgress.toFixed(3);
          el.style.pointerEvents = popProgress > 0.5 ? "auto" : "none";
          el.style.zIndex = String(Math.round(item.z * 100));
        } else {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          el.style.transform = `translate3d(${(item.x - 22).toFixed(1)}px, ${(item.y - 50).toFixed(1)}px, 0) scale(0.5)`;
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeHub, isHovered]);

  // Determine smart card alignment so it stays well within bounds
  const isRightSide = popupPos.x > 240;
  const isBottomSide = popupPos.y > 250;

  return (
    <div className="relative mx-auto flex w-full max-w-[500px] flex-col items-center">
      {/* Outer Glow Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-accent/5 blur-3xl"
      />

      {/* Interactive 3D Canvas Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => {
          setIsHovered(false);
          isPointerDownRef.current = false;
        }}
        className="group relative aspect-square w-full cursor-grab active:cursor-grabbing select-none overflow-hidden rounded-2xl border border-line bg-surface/40 backdrop-blur-sm"
        aria-label="Interactive 3D Earth cinema globe. Move cursor to rotate and explore movies by country."
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
        />

        {/* 3D Dynamic Popping Mini Movie Posters Layer */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {GLOBAL_CINEMA_HUBS.map((hub) => {
            const isCurrent = hub.id === activeHub?.id;
            return (
              <div
                key={hub.id}
                ref={(el) => {
                  if (el) hubElementsRef.current[hub.id] = el;
                }}
                onClick={() => focusHub(hub)}
                style={{
                  transform: "translate3d(-100px, -100px, 0) scale(0.5)",
                  opacity: 0,
                  transition: "opacity 0.25s ease-out, box-shadow 0.2s ease-out",
                }}
                className={`group/poster absolute left-0 top-0 h-[64px] w-[44px] cursor-pointer will-change-transform rounded-md border p-0.5 shadow-lg backdrop-blur-xs ${
                  isCurrent
                    ? "border-accent bg-accent/20 ring-2 ring-accent/60 shadow-[0_0_16px_rgba(56,189,248,0.45)]"
                    : "border-sky-400/40 bg-surface/90 hover:border-accent hover:scale-110 shadow-[0_4px_14px_rgba(0,0,0,0.8)]"
                }`}
                title={`${hub.movie} (${hub.country})`}
              >
                {/* Poster Artwork with fallback container */}
                <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-gradient-to-br from-slate-800 via-slate-900 to-black p-1 flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] leading-none">{hub.flag}</span>
                  <p className="line-clamp-2 text-[7px] font-bold text-accent leading-tight">
                    {hub.movie}
                  </p>

                  {/* Real TMDB poster with auto-hide fallback on error */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hub.posterUrl}
                    alt={hub.movie}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/poster:scale-110"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  {/* Country Flag Badge */}
                  <span className="absolute right-0.5 top-0.5 rounded bg-black/75 px-1 py-0.5 text-[9px] leading-none shadow z-10">
                    {hub.flag}
                  </span>

                  {/* Tiny Title Gradient Ribbon */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-1 text-center z-10">
                    <p className="line-clamp-1 text-[8px] font-bold text-white">
                      {hub.movie}
                    </p>
                  </div>
                </div>

                {/* Downward Pointer Stem to Country Dot */}
                <div className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-accent/90" />
              </div>
            );
          })}
        </div>

        {/* Floating Country Movie Pop-Up Card */}
        {activeHub && (
          <div
            style={{
              position: "absolute",
              left: isRightSide ? "16px" : "auto",
              right: isRightSide ? "auto" : "16px",
              top: isBottomSide ? "16px" : "auto",
              bottom: isBottomSide ? "auto" : "16px",
            }}
            className="pointer-events-auto z-20 w-[240px] sm:w-[270px] animate-in fade-in zoom-in-95 rounded-xl border border-line bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200"
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-line pb-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className="text-base" role="img" aria-label={activeHub.country}>
                  {activeHub.flag}
                </span>
                {activeHub.country}
              </span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {activeHub.year}
              </span>
            </div>

            <div className="flex gap-3">
              {/* Thumbnail Poster */}
              <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md border border-line/60 bg-gradient-to-br from-slate-800 to-black shadow-md flex items-center justify-center p-1 text-center">
                <span className="text-xs text-accent font-semibold">{activeHub.flag}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeHub.posterUrl}
                  alt={activeHub.movie}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {activeHub.movie}
                </h4>
                <p className="mt-0.5 truncate text-[11px] text-muted">{activeHub.genre}</p>
                <p className="mt-1.5 line-clamp-2 text-[11px] italic leading-relaxed text-foreground/80">
                  “{activeHub.quote}”
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
              <Link
                href={`/search?q=${encodeURIComponent(activeHub.searchQuery)}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                Search on CineTrack →
              </Link>
            </div>
          </div>
        )}

        {/* Ambient Overlay Hint */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-muted/80">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {isInteracting ? "Rotating globe…" : "Hover or drag to explore"}
          </span>
          <span className="hidden sm:inline">3D Cinema World</span>
        </div>
      </div>

      {/* Country Quick Selector Pills */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-1.5 px-2">
        {GLOBAL_CINEMA_HUBS.map((hub) => {
          const isSelected = hub.id === activeHub?.id;
          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => focusHub(hub)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                isSelected
                  ? "border border-accent/60 bg-accent text-ink font-semibold shadow-sm"
                  : "border border-line bg-surface/80 text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <span>{hub.flag}</span>
              <span>{hub.country}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
