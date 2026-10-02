import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bike,
  Navigation,
  Phone,
  MessageSquare,
  ShieldCheck,
  Clock,
  Compass,
  Zap,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  Volume2,
  Mic,
  Maximize2,
  RefreshCw,
  Info
} from 'lucide-react';
import { inr } from '../utils/format.js';
import { api } from '../services/api.js';

// Predefined route waypoints for each store to the customer destination (470, 370)
const STORE_ROUTES = {
  s1: [
    { x: 180, y: 140, street: '12th Main Road' },
    { x: 180, y: 240, street: '12th Main Road' },
    { x: 320, y: 240, street: 'CMH Link Road' },
    { x: 320, y: 310, street: 'Indiranagar Club Rd' },
    { x: 470, y: 310, street: '100 Feet Road' },
    { x: 470, y: 370, street: 'Pine Grove Residency' }
  ],
  s2: [
    { x: 620, y: 130, street: '80 Feet Road' },
    { x: 620, y: 220, street: '80 Feet Road' },
    { x: 540, y: 220, street: 'HAL 2nd Stage' },
    { x: 540, y: 310, street: 'Defence Link Rd' },
    { x: 470, y: 310, street: '100 Feet Road' },
    { x: 470, y: 370, street: 'Pine Grove Residency' }
  ],
  s3: [
    { x: 170, y: 80, street: 'CMH Metro Road' },
    { x: 260, y: 80, street: 'CMH Road' },
    { x: 260, y: 240, street: '100 Ft Northern Ext' },
    { x: 470, y: 240, street: '100 Feet Road' },
    { x: 470, y: 370, street: 'Pine Grove Residency' }
  ],
  s4: [
    { x: 680, y: 310, street: 'Old Airport Road' },
    { x: 590, y: 310, street: 'Old Airport Road' },
    { x: 590, y: 370, street: 'Kodihalli Cross' },
    { x: 470, y: 370, street: 'Pine Grove Residency' }
  ],
  s5: [
    { x: 150, y: 390, street: 'Domlur Ring Road' },
    { x: 280, y: 390, street: 'Domlur Flyover Cross' },
    { x: 280, y: 370, street: '100 Ft South Ave' },
    { x: 470, y: 370, street: 'Pine Grove Residency' }
  ],
  s6: [
    { x: 420, y: 190, street: 'Defence Colony' },
    { x: 470, y: 190, street: 'Defence Colony Ave' },
    { x: 470, y: 370, street: '100 Feet Road' }
  ]
};

// Calculate total length and segment breakdown
function buildRouteData(points) {
  let totalLength = 0;
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push({
      p1,
      p2,
      len,
      angle,
      cumStart: totalLength,
      cumEnd: totalLength + len,
      street: p2.street
    });
    totalLength += len;
  }
  return { points, segments, totalLength };
}

// Get interpolated position and heading angle at progress t in [0, 1]
function getInterpolatedPosition(routeData, t) {
  const { segments, totalLength } = routeData;
  if (!segments.length) return { x: 470, y: 370, angle: 0, street: 'Arrived' };
  const targetDist = Math.max(0, Math.min(1, t)) * totalLength;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (targetDist <= s.cumEnd || i === segments.length - 1) {
      const segT = s.len > 0 ? (targetDist - s.cumStart) / s.len : 1;
      const x = s.p1.x + (s.p2.x - s.p1.x) * segT;
      const y = s.p1.y + (s.p2.y - s.p1.y) * segT;
      return { x, y, angle: s.angle, street: s.street };
    }
  }
  const last = segments[segments.length - 1];
  return { x: last.p2.x, y: last.p2.y, angle: last.angle, street: last.street };
}

export default function LiveRiderMap({ order, onRefresh, onOrderAction }) {
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState(order?.chat || []);
  const [instructionType, setInstructionType] = useState(order?.deliveryInstructions?.type || 'doorstep');
  const [instructionNote, setInstructionNote] = useState(order?.deliveryInstructions?.note || '');
  const [savingNote, setSavingNote] = useState(false);
  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Status mapping
  const status = order?.status || 'placed';
  const rider = order?.rider || {
    name: 'Suresh Kumar',
    vehicle: 'Honda Activa 6G',
    color: 'Matte Black',
    plate: 'KA 01 EK 8421',
    rating: 4.92,
    deliveries: 1840,
    phone: '+91 98201 84920',
    avatar: '🛵'
  };

  const store = order?.storeLocation || {
    name: order?.storeName || 'Partner Store',
    address: 'Indiranagar 12th Main',
    x: 180,
    y: 140
  };

  const customer = order?.customerLocation || {
    address: 'Flat 402, Pine Grove Residency, 100ft Road',
    landmark: 'Opposite Starbucks, near Sony Center',
    x: 470,
    y: 370
  };

  // Route definition
  const rawWaypoints = STORE_ROUTES[order?.storeId] || STORE_ROUTES.s1;
  const routeData = useMemo(() => buildRouteData(rawWaypoints), [order?.storeId]);

  // Dynamic progress state for the live rider
  // In 'out_for_delivery', rider moves continuously between 0.15 and 0.95
  const [progress, setProgress] = useState(() => {
    if (status === 'delivered') return 1;
    if (status === 'out_for_delivery') return 0.45;
    if (status === 'rider_assigned') return 0.12;
    if (status === 'accepted') return 0.05;
    return 0;
  });

  // Keep progress in sync when order status changes
  useEffect(() => {
    if (status === 'delivered') setProgress(1);
    else if (status === 'out_for_delivery') setProgress((prev) => (prev < 0.2 ? 0.35 : prev));
    else if (status === 'rider_assigned') setProgress(0.12);
    else if (status === 'accepted') setProgress(0.04);
    else if (status === 'placed') setProgress(0);
  }, [status]);

  // Animate rider along route during 'out_for_delivery'
  useEffect(() => {
    if (status !== 'out_for_delivery') return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const step = 0.0035 * speedMultiplier;
        const next = prev + step;
        return next >= 0.98 ? 0.98 : next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [status, speedMultiplier]);

  // Current interpolated rider position
  const currentPos = useMemo(() => {
    if (status === 'delivered') {
      return { x: customer.x, y: customer.y, angle: 90, street: 'At Destination' };
    }
    if (status === 'placed' || status === 'accepted') {
      return { x: store.x, y: store.y, angle: 0, street: 'At Store' };
    }
    return getInterpolatedPosition(routeData, progress);
  }, [routeData, progress, status, customer.x, customer.y, store.x, store.y]);

  // Simulated speed calculation
  const liveSpeed = useMemo(() => {
    if (status === 'delivered' || status === 'placed' || status === 'accepted') return 0;
    if (status === 'rider_assigned') return 18;
    const base = 28;
    const jitter = Math.sin(progress * 20) * 6;
    return Math.max(15, Math.round(base + jitter));
  }, [status, progress]);

  // Distance remaining
  const distanceRemainingKm = useMemo(() => {
    if (status === 'delivered') return 0;
    const totalDist = 2.4;
    return Math.max(0.1, Number((totalDist * (1 - progress)).toFixed(1)));
  }, [status, progress]);

  // ETA minutes remaining
  const etaMinutes = useMemo(() => {
    if (status === 'delivered') return 0;
    if (status === 'out_for_delivery') {
      return Math.max(2, Math.round(14 * (1 - progress)));
    }
    return order?.actualOrProjected || 18;
  }, [status, progress, order?.actualOrProjected]);

  // Call timer simulation
  useEffect(() => {
    let t;
    if (callActive) {
      t = setInterval(() => setCallTimer((c) => c + 1), 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(t);
  }, [callActive]);

  const handleStartCall = () => {
    setShowCallModal(true);
    setCallActive(true);
  };

  const handleEndCall = () => {
    setCallActive(false);
    setShowCallModal(false);
  };

  // Sync chat messages with order
  useEffect(() => {
    if (order?.chat) {
      setChatMessages(order.chat);
    }
  }, [order?.chat]);

  const handleSendMessage = async (textToSend) => {
    const msg = (textToSend || chatInput).trim();
    if (!msg || !order?.id) return;
    setChatInput('');

    // Optimistic local add
    const tempCustomerMsg = {
      id: 'local-' + Date.now(),
      sender: 'customer',
      text: msg,
      at: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, tempCustomerMsg]);

    try {
      const res = await api.sendMessage(order.id, msg);
      if (res?.order?.chat) {
        setChatMessages(res.order.chat);
      }
    } catch {
      // Local fallback reply if offline
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'rider-' + Date.now(),
            sender: 'rider',
            name: rider.name,
            text: "Got it! Thanks for letting me know. I'm on the way!",
            at: new Date().toISOString()
          }
        ]);
      }, 700);
    }
  };

  const handleSaveInstructions = async () => {
    if (!order?.id) return;
    setSavingNote(true);
    try {
      await api.updateInstructions(order.id, {
        type: instructionType,
        note: instructionNote
      });
      setSavedNoteSuccess(true);
      setTimeout(() => setSavedNoteSuccess(false), 2500);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  // SVG route path string
  const svgPathD = useMemo(() => {
    const pts = routeData.points;
    if (!pts.length) return '';
    return pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  }, [routeData]);

  // Turn-by-turn guidance description
  const turnGuidance = useMemo(() => {
    if (status === 'delivered') return { icon: CheckCircle2, text: 'Order delivered safely to your address!', sub: 'Thank you for ordering with Nova Cart.' };
    if (status === 'placed') return { icon: Clock, text: 'Order sent to store', sub: 'Store acceptance in progress...' };
    if (status === 'accepted') return { icon: RefreshCw, text: 'Store is packing your items', sub: `${store.name} · Est. 4 mins` };
    if (status === 'rider_assigned') return { icon: Bike, text: `${rider.name} heading to store`, sub: 'Arrival at store in ~2 mins' };
    if (progress > 0.85) return { icon: Navigation, text: 'Arriving at Pine Grove Residency', sub: 'Preparing to pull up at the gate' };
    if (progress > 0.5) return { icon: Navigation, text: 'Continue on 100 Feet Road', sub: 'Stay straight past Sony Center junction' };
    return { icon: Navigation, text: `Cruising along ${currentPos.street}`, sub: `Next turn in 240m onto 100 Feet Road` };
  }, [status, progress, rider.name, store.name, currentPos.street]);

  const GuidanceIcon = turnGuidance.icon;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Top Uber-Style HUD Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #093430 0%, #0d1b2a 100%)',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: 14,
          boxShadow: '0 8px 30px rgba(15,23,42,0.2)'
        }}
      >
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span
                className="badge"
                style={{
                  background: status === 'delivered' ? '#166534' : '#0f766e',
                  color: '#fff',
                  fontSize: '0.8rem',
                  padding: '3px 10px'
                }}
              >
                ● LIVE TRACKING
              </span>
              <span className="small" style={{ color: '#94a3b8' }}>
                Order #{order?.id}
              </span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 750, color: '#fff', letterSpacing: '-0.02em' }}>
              {status === 'delivered' ? (
                'Order Delivered'
              ) : (
                <>
                  Arriving in <span style={{ color: '#5eead4' }}>{etaMinutes} mins</span>
                </>
              )}
            </h2>
            <p className="small" style={{ color: '#cbd5e1', marginTop: 2 }}>
              Promised window: <b>{order?.promised || '15–25 min'}</b> &middot; {order?.tracking?.sub}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className="small" style={{ color: '#94a3b8' }}>Fulfillment Confidence</div>
            <div className="row" style={{ gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: (order?.confidenceAtOrder || 85) >= 75 ? '#4ade80' : '#facc15'
                }}
              >
                {order?.confidenceAtOrder || 85}%
              </span>
              <ShieldCheck size={18} color="#5eead4" aria-hidden />
            </div>
            <div className="tiny" style={{ color: '#cbd5e1' }}>SLA On-Time Protected</div>
          </div>
        </div>

        {/* Live Turn-by-Turn Instruction Strip */}
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(6px)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div className="row" style={{ gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#0f766e',
                display: 'grid',
                placeItems: 'center',
                color: '#fff'
              }}
            >
              <GuidanceIcon size={20} />
            </div>
            <div>
              <div className="strong small" style={{ color: '#fff' }}>
                {turnGuidance.text}
              </div>
              <div className="tiny" style={{ color: '#94a3b8' }}>
                {turnGuidance.sub}
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 14 }}>
            <div className="small mono">
              <span style={{ color: '#94a3b8' }}>Speed:</span>{' '}
              <b style={{ color: '#5eead4' }}>{liveSpeed} km/h</b>
            </div>
            <div className="small mono">
              <span style={{ color: '#94a3b8' }}>Distance:</span>{' '}
              <b style={{ color: '#fff' }}>{distanceRemainingKm} km</b>
            </div>
            <span
              className="badge"
              style={{
                background: 'rgba(20, 184, 166, 0.2)',
                color: '#5eead4',
                border: '1px solid rgba(94, 234, 212, 0.3)'
              }}
            >
              GPS Lock Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Driver & Delivery Detail Card */}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 16 }}>
        {/* Interactive Vector Street Map Canvas */}
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: '#eef2f6'
          }}
        >
          {/* Map Top Control Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Compass size={14} color="#5eead4" />
              <span>Indiranagar Corridor &middot; Bengaluru</span>
            </div>

            <div className="row" style={{ gap: 6, pointerEvents: 'auto' }}>
              <button
                className="btn sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  fontSize: '0.78rem'
                }}
                onClick={() => setTrafficEnabled(!trafficEnabled)}
                title="Toggle live traffic layers"
              >
                Traffic: <b style={{ color: trafficEnabled ? '#15803d' : '#64748b' }}>{trafficEnabled ? 'ON' : 'OFF'}</b>
              </button>
              <button
                className="btn sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  fontSize: '0.78rem'
                }}
                onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : s === 2 ? 5 : 1))}
                title="Simulation speed multiplier"
              >
                Sim: <b>{speedMultiplier}x</b>
              </button>
            </div>
          </div>

          {/* SVG Map Container */}
          <div
            style={{
              width: '100%',
              height: 480,
              position: 'relative',
              background: '#e4ecf3',
              overflow: 'hidden'
            }}
          >
            <svg
              viewBox="0 0 800 500"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease'
              }}
            >
              <defs>
                {/* Subtle city grid patterns */}
                <pattern id="cityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d5e1ec" strokeWidth="0.8" />
                </pattern>

                {/* Route gradient glow */}
                <linearGradient id="routeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="50%" stopColor="#0d9488" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>

                {/* Animated dash pattern for ongoing route */}
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* Background grid */}
              <rect width="800" height="500" fill="#e8edf2" />
              <rect width="800" height="500" fill="url(#cityGrid)" />

              {/* City Parks / Green zones */}
              <rect x="50" y="40" width="80" height="110" rx="8" fill="#d4ebd8" opacity="0.8" />
              <text x="60" y="65" fill="#2d6a4f" fontSize="10" fontWeight="600">
                Defence Park
              </text>

              <rect x="330" y="50" width="120" height="90" rx="10" fill="#d4ebd8" opacity="0.8" />
              <text x="345" y="75" fill="#2d6a4f" fontSize="10" fontWeight="600">
                Indiranagar Club
              </text>

              <rect x="570" y="380" width="180" height="80" rx="12" fill="#d4ebd8" opacity="0.8" />
              <text x="590" y="405" fill="#2d6a4f" fontSize="10" fontWeight="600">
                Kodialbail Gardens
              </text>

              {/* Water Canal / Lake element */}
              <path
                d="M 0 480 Q 200 460 400 475 T 800 465 L 800 500 L 0 500 Z"
                fill="#c6e2f7"
                opacity="0.75"
              />

              {/* Block & Building Outlines for realism */}
              <rect x="195" y="155" width="80" height="65" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="340" y="160" width="100" height="60" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="560" y="150" width="90" height="50" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="200" y="260" width="100" height="90" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="340" y="260" width="110" height="90" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="500" y="240" width="70" height="110" rx="4" fill="#d9e2ec" stroke="#cbd5e1" strokeWidth="1" />

              {/* Major City Arterial Roads */}
              {/* 100 Feet Road (Vertical North-South) */}
              <line x1="470" y1="0" x2="470" y2="500" stroke="#ffffff" strokeWidth="18" />
              <line x1="470" y1="0" x2="470" y2="500" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="6,6" />
              <text x="478" y="30" fill="#64748b" fontSize="10" fontWeight="700" letterSpacing="0.5">
                100 FEET ROAD
              </text>

              {/* 12th Main Road */}
              <line x1="180" y1="0" x2="180" y2="500" stroke="#ffffff" strokeWidth="14" />
              <text x="186" y="480" fill="#64748b" fontSize="9" fontWeight="600">
                12th Main Road
              </text>

              {/* CMH Road (Horizontal East-West) */}
              <line x1="0" y1="80" x2="800" y2="80" stroke="#ffffff" strokeWidth="16" />
              <text x="30" y="74" fill="#64748b" fontSize="10" fontWeight="700">
                CMH ROAD (METRO LINE)
              </text>

              {/* Cross connection streets */}
              <line x1="0" y1="240" x2="800" y2="240" stroke="#ffffff" strokeWidth="12" />
              <text x="30" y="234" fill="#64748b" fontSize="9" fontWeight="600">
                12th Cross / Club Link
              </text>

              <line x1="0" y1="310" x2="800" y2="310" stroke="#ffffff" strokeWidth="12" />
              <text x="30" y="304" fill="#64748b" fontSize="9" fontWeight="600">
                Defence Link Ave
              </text>

              <line x1="0" y1="370" x2="800" y2="370" stroke="#ffffff" strokeWidth="14" />
              <text x="30" y="364" fill="#64748b" fontSize="9" fontWeight="600">
                South Ring Link
              </text>

              {/* 80 Feet Road (East vertical) */}
              <line x1="620" y1="0" x2="620" y2="500" stroke="#ffffff" strokeWidth="14" />
              <text x="626" y="470" fill="#64748b" fontSize="9" fontWeight="600">
                80 FEET ROAD (HAL)
              </text>

              {/* Simulated Live Traffic overlay bands */}
              {trafficEnabled && (
                <g opacity="0.6">
                  {/* Moderate traffic on 100ft road */}
                  <line x1="470" y1="120" x2="470" y2="240" stroke="#eab308" strokeWidth="5" strokeLinecap="round" />
                  {/* Heavy traffic near junction */}
                  <line x1="470" y1="240" x2="470" y2="270" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
                  {/* Clear flowing traffic towards destination */}
                  <line x1="470" y1="270" x2="470" y2="370" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
                  {/* Clear traffic along CMH road */}
                  <line x1="170" y1="80" x2="470" y2="80" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
                </g>
              )}

              {/* The Active Delivery Route Polyline */}
              {/* Outer soft shadow */}
              <path
                d={svgPathD}
                fill="none"
                stroke="rgba(15, 118, 110, 0.25)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main solid route path */}
              <path
                d={svgPathD}
                fill="none"
                stroke="url(#routeGlow)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated pulse dash overlay on the route */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#5eead4"
                strokeWidth="2.5"
                strokeDasharray="8,12"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: 'routeDash 1.2s linear infinite'
                }}
              />

              {/* STORE ORIGIN PIN */}
              <g transform={`translate(${store.x}, ${store.y})`} filter="url(#shadow)">
                {/* Store pulse ring */}
                <circle r="16" fill="none" stroke="#0f766e" strokeWidth="1.5" opacity="0.4">
                  <animate attributeName="r" values="10;22;10" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
                </circle>
                {/* Store pin circle */}
                <circle r="12" fill="#0f766e" stroke="#ffffff" strokeWidth="2.5" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                  🏪
                </text>
                {/* Store name badge */}
                <g transform="translate(0, -18)">
                  <rect x="-60" y="-14" width="120" height="18" rx="4" fill="#0f172a" opacity="0.9" />
                  <text x="0" y="-2" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="600">
                    {store.name}
                  </text>
                </g>
              </g>

              {/* CUSTOMER DESTINATION PIN */}
              <g transform={`translate(${customer.x}, ${customer.y})`} filter="url(#shadow)">
                {/* Pulse target ring */}
                <circle r="18" fill="none" stroke="#15803d" strokeWidth="2" opacity="0.3">
                  <animate attributeName="r" values="12;26;12" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Destination home pin */}
                <circle r="13" fill="#15803d" stroke="#ffffff" strokeWidth="2.5" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                  🏠
                </text>
                {/* Customer address label */}
                <g transform="translate(0, 24)">
                  <rect x="-70" y="-12" width="140" height="18" rx="4" fill="#0f172a" opacity="0.9" />
                  <text x="0" y="1" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="600">
                    Your Address &middot; Pine Grove
                  </text>
                </g>
              </g>

              {/* LIVE MOVING RIDER (MOTORCYCLE / VEHICLE PIN) */}
              <g
                transform={`translate(${currentPos.x}, ${currentPos.y})`}
                filter="url(#shadow)"
                style={{
                  transition: 'transform 0.15s ease-out'
                }}
              >
                {/* GPS Radar rings (radiating from rider like in Uber) */}
                <circle r="18" fill="none" stroke="#06b6d4" strokeWidth="2" opacity="0.4">
                  <animate attributeName="r" values="10;28;10" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle r="30" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.2">
                  <animate attributeName="r" values="16;38;16" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* Accuracy shadow zone */}
                <circle r="12" fill="rgba(6, 182, 212, 0.2)" />

                {/* Rotated vehicle icon based on movement direction */}
                <g transform={`rotate(${currentPos.angle})`}>
                  {/* Vehicle base body */}
                  <rect x="-14" y="-8" width="28" height="16" rx="8" fill="#0f172a" stroke="#5eead4" strokeWidth="2" />
                  {/* Front headlight beam */}
                  <polygon points="14,-6 32,-14 32,14 14,6" fill="rgba(94, 234, 212, 0.25)" />
                  {/* Vehicle icon inside */}
                  <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="10">
                    🛵
                  </text>
                </g>

                {/* Live Speed / Rider Callout Tag */}
                <g transform="translate(0, -22)">
                  <rect
                    x="-42"
                    y="-14"
                    width="84"
                    height="17"
                    rx="4"
                    fill="#0f172a"
                    stroke="#0f766e"
                    strokeWidth="1.2"
                  />
                  <text x="0" y="-2" textAnchor="middle" fill="#5eead4" fontSize="9" fontWeight="700">
                    {rider.name.split(' ')[0]} &middot; {liveSpeed} km/h
                  </text>
                </g>
              </g>
            </svg>

            {/* Bottom-right Zoom & Recenter Map Controls */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              <button
                className="btn sm"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
                onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.2))}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                className="btn sm"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
                onClick={() => setZoomLevel((z) => Math.max(0.9, z - 0.2))}
                aria-label="Zoom out"
              >
                &minus;
              </button>
              <button
                className="btn sm"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  background: '#0f766e',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                onClick={() => setZoomLevel(1)}
                title="Reset Map View"
                aria-label="Reset map"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Uber-Style Driver Card, Delivery Progress & Controls */}
        <div className="stack" style={{ gap: 14 }}>
          {/* Rider Profile Card (Uber-Style) */}
          <div className="card" style={{ padding: 18 }}>
            <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e6f4f2, #ccebe6)',
                    border: '2px solid #0f766e',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '1.7rem',
                    position: 'relative'
                  }}
                >
                  {rider.avatar || '🛵'}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      background: '#15803d',
                      color: '#fff',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '10px'
                    }}
                    title="Verified Delivery Partner"
                  >
                    ✓
                  </span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{rider.name}</h3>
                  <div className="row" style={{ gap: 6, marginTop: 2 }}>
                    <span className="badge good" style={{ padding: '1px 6px', fontSize: '0.75rem' }}>
                      ★ {rider.rating || 4.9}
                    </span>
                    <span className="tiny muted">{rider.deliveries || '1,800+'} trips</span>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>
                    {rider.vehicle} &middot; <b className="mono" style={{ color: 'var(--ink)' }}>{rider.plate}</b>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Contact Buttons (Call / Chat) */}
            <div className="grid g2" style={{ gap: 10, marginTop: 12 }}>
              <button
                className="btn primary"
                onClick={handleStartCall}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 12px'
                }}
              >
                <Phone size={16} /> Call Rider
              </button>
              <button
                className="btn"
                onClick={() => setShowChatModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 12px'
                }}
              >
                <MessageSquare size={16} /> Chat ({chatMessages.length})
              </button>
            </div>
          </div>

          {/* 5-Step Order Journey Stepper */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Delivery Progress</h3>
            <div className="timeline" style={{ gap: 0 }}>
              {[
                { key: 'placed', label: 'Order Confirmed', desc: 'Promised time locked' },
                { key: 'accepted', label: 'Store Packing', desc: `${store.name} prepping items` },
                { key: 'rider_assigned', label: 'Rider Assigned', desc: `${rider.name} en route to store` },
                { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Live GPS tracked on map' },
                { key: 'delivered', label: 'Delivered', desc: 'Delivered at doorstep' }
              ].map((step, idx) => {
                const currentStepNum = order?.tracking?.step || 1;
                const isDone = currentStepNum > idx + 1 || status === 'delivered';
                const isCurrent = currentStepNum === idx + 1 && status !== 'delivered';

                return (
                  <div
                    key={step.key}
                    className={`tl-step ${isDone ? 'done' : ''}`}
                    style={{ opacity: isDone || isCurrent ? 1 : 0.55 }}
                  >
                    <div
                      className="dot"
                      style={{
                        background: isDone ? '#0f766e' : isCurrent ? '#5eead4' : '#fff',
                        borderColor: isDone || isCurrent ? '#0f766e' : 'var(--line)',
                        color: isDone ? '#fff' : '#0f766e'
                      }}
                    >
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <div>
                      <div className="strong small" style={{ color: isCurrent ? 'var(--brand-ink)' : 'inherit' }}>
                        {step.label} {isCurrent && <span className="badge info" style={{ marginLeft: 6, fontSize: '0.7rem' }}>CURRENT</span>}
                      </div>
                      <div className="tiny muted">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Delivery Instructions Form */}
          <div className="card" style={{ padding: 18 }}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Delivery Instructions</h3>
                <p className="tiny muted">Rider will see this note upon arrival</p>
              </div>
              {savedNoteSuccess && <span className="badge good tiny">Saved!</span>}
            </div>

            {/* Instruction Preference Chips */}
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {[
                { id: 'doorstep', label: 'Leave at doorstep' },
                { id: 'hand', label: 'Hand to me' },
                { id: 'guard', label: 'Leave with security guard' },
                { id: 'nobell', label: 'Do not ring bell' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  className={`btn sm ${instructionType === opt.id ? 'primary' : ''}`}
                  style={{ fontSize: '0.76rem', padding: '4px 9px' }}
                  onClick={() => setInstructionType(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom Notes input */}
            <div className="field">
              <input
                type="text"
                placeholder="e.g. Gate code #402, lift is on the left..."
                value={instructionNote}
                onChange={(e) => setInstructionNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <button
              className="btn sm"
              style={{ marginTop: 8, width: '100%' }}
              disabled={savingNote}
              onClick={handleSaveInstructions}
            >
              {savingNote ? 'Updating...' : 'Save Instructions'}
            </button>
          </div>

          {/* Interactive Simulation Panel for Demo */}
          <div
            className="card"
            style={{
              padding: 16,
              background: '#f8fafc',
              border: '1px dashed var(--line)'
            }}
          >
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="tiny strong muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Prototype Live Controls
              </span>
              <span className="tiny muted">Simulate order lifecycle</span>
            </div>

            <div className="row" style={{ gap: 6 }}>
              {order?.nextSteps?.map((st) => (
                <button
                  key={st}
                  className={`btn sm ${st === 'rejected' || st === 'cancelled' ? 'danger' : 'primary'}`}
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => onOrderAction && onOrderAction(() => api.setStatus(order.id, st), `Moved to ${st}`)}
                >
                  Advance &rarr; {st.replace('_', ' ')}
                </button>
              ))}

              <button
                className="btn sm"
                style={{ fontSize: '0.78rem' }}
                onClick={() =>
                  onOrderAction &&
                  onOrderAction(
                    () => api.simulate(order.id, 'simulate-delay', { minutes: 12 }),
                    'Traffic delay recorded'
                  )
                }
              >
                Simulate Traffic Jam (+12m)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Phone Call Modal */}
      {showCallModal && (
        <div className="modal-back" onClick={handleEndCall}>
          <div
            className="modal"
            style={{
              maxWidth: 360,
              textAlign: 'center',
              background: '#0f172a',
              color: '#fff',
              padding: '30px 20px',
              borderRadius: 20
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#0f766e',
                margin: '0 auto 16px',
                display: 'grid',
                placeItems: 'center',
                fontSize: '2.2rem'
              }}
            >
              {rider.avatar || '🛵'}
            </div>
            <h2 style={{ fontSize: '1.3rem', color: '#fff', margin: 0 }}>{rider.name}</h2>
            <p style={{ color: '#5eead4', fontSize: '0.9rem', marginTop: 4 }}>Nova Cart Delivery Partner</p>
            <p className="tiny mono" style={{ color: '#94a3b8', marginTop: 2 }}>{rider.phone}</p>

            <div
              className="mono"
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                margin: '20px 0',
                color: callActive ? '#4ade80' : '#94a3b8'
              }}
            >
              {String(Math.floor(callTimer / 60)).padStart(2, '0')}:
              {String(callTimer % 60).padStart(2, '0')}
            </div>

            <div className="row" style={{ justifyContent: 'center', gap: 16, margin: '20px 0' }}>
              <button
                className="btn"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: 0
                }}
                aria-label="Mute"
              >
                <Mic size={20} />
              </button>
              <button
                className="btn"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: 0
                }}
                aria-label="Speaker"
              >
                <Volume2 size={20} />
              </button>
            </div>

            <button
              className="btn danger"
              style={{
                background: '#ef4444',
                color: '#fff',
                borderColor: '#ef4444',
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                fontWeight: 700
              }}
              onClick={handleEndCall}
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* Simulated Live In-App Chat Modal */}
      {showChatModal && (
        <div className="modal-back" onClick={() => setShowChatModal(false)}>
          <div
            className="modal"
            style={{
              maxWidth: 440,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              height: 520,
              borderRadius: 16,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Chat Header */}
            <div
              style={{
                background: '#0f766e',
                color: '#fff',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{rider.avatar || '🛵'}</span>
                <div>
                  <b style={{ fontSize: '0.95rem' }}>{rider.name}</b>
                  <div className="tiny" style={{ opacity: 0.85 }}>
                    Nova Cart Rider &middot; On the move
                  </div>
                </div>
              </div>
              <button
                className="btn sm"
                style={{ background: 'transparent', border: 0, color: '#fff' }}
                onClick={() => setShowChatModal(false)}
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div
              style={{
                flex: 1,
                padding: 16,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: '#f8fafc'
              }}
            >
              <div
                style={{
                  alignSelf: 'center',
                  background: '#e2e8f0',
                  color: '#475569',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: '0.72rem'
                }}
              >
                Order #{order?.id} &middot; Live Chat
              </div>

              {chatMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto 0', fontSize: '0.85rem' }}>
                  Send a message to coordinate delivery with {rider.name}.
                </div>
              )}

              {chatMessages.map((m, i) => {
                const isMe = m.sender === 'customer';
                return (
                  <div
                    key={m.id || i}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: isMe ? '#0f766e' : '#ffffff',
                      color: isMe ? '#ffffff' : '#0f172a',
                      padding: '9px 13px',
                      borderRadius: 14,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      fontSize: '0.88rem',
                      lineHeight: 1.35
                    }}
                  >
                    {!isMe && (
                      <div className="tiny strong" style={{ color: '#0f766e', marginBottom: 2 }}>
                        {m.name || rider.name}
                      </div>
                    )}
                    <div>{m.text}</div>
                    <div
                      className="tiny"
                      style={{
                        textAlign: 'right',
                        opacity: 0.65,
                        marginTop: 3,
                        fontSize: '0.68rem'
                      }}
                    >
                      {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Reply Suggestions */}
            <div
              style={{
                padding: '6px 12px',
                background: '#f1f5f9',
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                borderTop: '1px solid var(--line)'
              }}
            >
              {[
                "I'm at the main gate",
                'Leave at doorstep, thanks!',
                'Please ring doorbell',
                'Take your time, ride safe!'
              ].map((chip) => (
                <button
                  key={chip}
                  className="btn sm"
                  style={{ fontSize: '0.74rem', padding: '3px 8px', borderRadius: 99 }}
                  onClick={() => handleSendMessage(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                padding: '10px 14px',
                background: '#fff',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                gap: 8
              }}
            >
              <input
                type="text"
                placeholder={`Message ${rider.name.split(' ')[0]}...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 20,
                  border: '1px solid var(--line)',
                  fontSize: '0.85rem'
                }}
              />
              <button
                type="submit"
                className="btn primary"
                disabled={!chatInput.trim()}
                style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
