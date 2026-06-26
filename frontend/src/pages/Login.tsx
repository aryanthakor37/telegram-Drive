import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Phone, AlertCircle, ArrowRight, MessageSquareCode, Edit, Sun, Moon, Clock, ChevronDown, Search } from 'lucide-react';
import { Background3D } from '../components/Background3D';
import { StorageOrb3D } from '../components/StorageOrb3D';
import { motion, AnimatePresence } from 'framer-motion';

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Russia', code: '+7', flag: '🇷🇺' },
  { name: 'China', code: '+86', flag: '🇨🇳' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'New Zealand', code: '+64', flag: '🇳🇿' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
  { name: 'Sweden', code: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: '+45', flag: '🇩🇰' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { name: 'Thailand', code: '+66', flag: '🇹🇭' },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'Kenya', code: '+254', flag: '🇰🇪' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'Ukraine', code: '+380', flag: '🇺🇦' },
  { name: 'Poland', code: '+48', flag: '🇵🇱' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Oman', code: '+968', flag: '🇴🇲' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
];

const Login: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [step, setStep] = useState(1); // 1 = Phone Number, 2 = OTP Code
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [floodWait, setFloodWait] = useState<number>(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [selectedCountry, setSelectedCountry] = useState({ name: 'India', code: '+91', flag: '🇮🇳' });
  const [localNumber, setLocalNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  // Click outside to close country dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync full phone number whenever country code or local number changes
  useEffect(() => {
    const cleanLocal = localNumber.replace(/[^0-9]/g, '');
    setPhoneNumber(`${selectedCountry.code}${cleanLocal}`);
  }, [selectedCountry, localNumber]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // If user pasted/typed full number starting with +
    if (val.trim().startsWith('+')) {
      const cleanVal = val.trim();
      const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
      const matched = sortedCountries.find(c => cleanVal.startsWith(c.code));

      if (matched) {
        setSelectedCountry(matched);
        setLocalNumber(cleanVal.slice(matched.code.length).replace(/[^0-9]/g, ''));
        return;
      } else {
        const codeMatch = cleanVal.match(/^\+[0-9]{1,4}/);
        if (codeMatch) {
          const customCode = codeMatch[0];
          setSelectedCountry({ name: 'Custom Code', code: customCode, flag: '🌐' });
          setLocalNumber(cleanVal.slice(customCode.length).replace(/[^0-9]/g, ''));
          return;
        }
      }
    }

    setLocalNumber(val.replace(/[^0-9]/g, ''));
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.includes(searchQuery)
  );

  const showCustomOption = searchQuery.trim() !== '' &&
    (searchQuery.startsWith('+') || /^[0-9]+$/.test(searchQuery)) &&
    !COUNTRIES.some(c => c.code === (searchQuery.startsWith('+') ? searchQuery : `+${searchQuery}`));

  // Local theme state aligned with Dashboard
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Track window mouse movements for deep 3D background parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2),
        y: (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Countdown timer for Telegram rate limit (FloodWait)
  useEffect(() => {
    if (floodWait <= 0) return;
    const timer = setInterval(() => {
      setFloodWait(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [floodWait]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!localNumber) {
      setError('Please enter your phone number.');
      return;
    }

    if (!phoneNumber.startsWith('+')) {
      setError('Phone number must start with a valid country code (e.g. +91XXXXXXXXXX)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendOtp(phoneNumber);
      setPhoneCodeHash(res.phoneCodeHash);
      setStep(2);
    } catch (err: any) {
      if (err.floodWait) {
        setFloodWait(err.seconds);
        setError('');
      } else {
        setError(err.message || 'Failed to send OTP. Please check the number and ensure your VPN is turned on.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phoneCode) {
      setError('Please enter the OTP verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(phoneNumber, phoneCodeHash, phoneCode);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Framer motion variants for smooth load entry
  const containerVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        staggerChildren: 0.18,
        ease: [0.16, 1, 0.3, 1] // sleek custom cubic bezier
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="min-h-screen relative w-full flex items-center justify-center bg-slate-50 dark:bg-dark-950 transition-colors duration-300 p-4 overflow-hidden">
      {/* 3D Animated Synapse Constellation Background */}
      <Background3D />

      {/* Decorative 3D background glows with opposite mouse coordinates parallax */}
      <div
        style={{
          transform: `translate3d(${mousePos.x * -45}px, ${mousePos.y * -45}px, 0)`,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-[100px] pointer-events-none"
      ></div>
      <div
        style={{
          transform: `translate3d(${mousePos.x * 45}px, ${mousePos.y * 45}px, 0)`,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[100px] pointer-events-none"
      ></div>

      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-dark-850/60 text-slate-700 dark:text-slate-300 hover:text-brand-500 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 group/theme"
          title="Toggle Theme Mode"
        >
          {theme === 'dark' ? (
            <Sun className="w-4.5 h-4.5 transition-transform duration-500 ease-out group-hover/theme:rotate-180" />
          ) : (
            <Moon className="w-4.5 h-4.5 transition-transform duration-500 ease-out group-hover/theme:rotate-[-30deg] group-hover/theme:scale-110" />
          )}
        </button>
      </div>

      {/* Subtle Dynamic 3D Backlight Glow */}
      <div
        style={{
          transform: `translate3d(${mousePos.x * 15}px, ${mousePos.y * 15}px, 0)`,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="absolute w-115 h-130 bg-linear-to-r from-brand-500/10 via-sky-500/5 to-purple-500/10 rounded-[40px] blur-[90px] pointer-events-none z-0 opacity-80 dark:opacity-60"
      ></div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* Logo and Brand Title with 3D Storage Orb */}
        <motion.div variants={itemVariants} className="flex flex-col items-center mb-8">
          <div className="relative cursor-pointer select-none hover:scale-105 active:scale-[0.98] transition-transform duration-300 group">
            <div className="absolute inset-0 bg-brand-500/20 dark:bg-brand-500/10 rounded-full blur-xl animate-pulse"></div>
            <StorageOrb3D percentage={35} size={88} showPercentage={false} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-600 dark:text-transparent dark:bg-linear-to-r dark:from-white dark:via-brand-200 dark:to-brand-400 dark:bg-clip-text mt-3">
            Telegram Drive
          </h1>
          <p className="text-slate-500 dark:text-dark-400 text-sm mt-1 font-medium">Unlimited Cloud Storage powered by Telegram</p>
        </motion.div>

        {/* Auth Card with Interactive 3D mouse tilt and inner depth layers */}
        <motion.div
          variants={itemVariants}
          onMouseMove={(e) => {
            const card = e.currentTarget;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            const rotX = -(y / (rect.height / 2)) * 4; // Gentle 4 degrees pitch max
            const rotY = (x / (rect.width / 2)) * 4;  // Gentle 4 degrees yaw max
            card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.01)`; // Subtle 1% scale zoom

            // Interactive glowing spotlight (dual sapphire blue & purple glow)
            const spotlight = card.querySelector('.card-spotlight-3d') as HTMLDivElement;
            if (spotlight) {
              const spotX = e.clientX - rect.left;
              const spotY = e.clientY - rect.top;
              spotlight.style.background = `radial-gradient(350px circle at ${spotX}px ${spotY}px, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 60%, transparent 100%)`;
            }
          }}
          onMouseLeave={(e) => {
            const card = e.currentTarget;
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            const spotlight = card.querySelector('.card-spotlight-3d') as HTMLDivElement;
            if (spotlight) {
              spotlight.style.background = 'transparent';
            }
          }}
          style={{ transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)', transformStyle: 'preserve-3d' }}
          className="bg-white/80 dark:bg-dark-900/40 backdrop-blur-xl border border-slate-200/60 dark:border-white/5 rounded-3xl p-8 glow-brand shadow-2xl relative overflow-visible group"
        >
          {/* Card Border Line & Spotlight Overlay */}
          <div className="absolute top-0 left-0 w-full h-0.75 bg-linear-to-r from-brand-500 via-sky-400 to-purple-500"></div>
          <div className="absolute inset-0 card-spotlight-3d pointer-events-none transition-opacity duration-300"></div>

          {/* Glass Sheen sweep effect on hover */}
          <div className="absolute inset-y-0 -left-full w-[50%] h-full pointer-events-none bg-linear-to-r from-transparent via-white/15 dark:via-white/5 to-transparent skew-x-12 transition-all duration-[1200ms] ease-out group-hover:left-[150%]"></div>

          {/* AnimatePresence for smooth step sliding transitions */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="translate-z-10"
              >
                <h2
                  style={{ transform: 'translateZ(20px)' }}
                  className="text-xl font-bold text-slate-800 dark:text-white mb-2"
                >
                  Connect Telegram
                </h2>
                <p
                  style={{ transform: 'translateZ(15px)' }}
                  className="text-xs text-slate-500 dark:text-dark-400 mb-6"
                >
                  Enter your phone number to authorize our client using Telegram's MTProto API.
                </p>

                {floodWait > 0 && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-3 translate-z-10 animate-pulse">
                    <Clock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-700 dark:text-amber-300">Telegram Rate Limit Active</div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-dark-400 leading-normal">
                        Telegram requires a temporary wait before requesting another code.
                        <strong> Turn on a VPN</strong> if this keeps happening, as ISPs block raw MTProto connections.
                      </p>
                      <div className="mt-2 font-mono text-sm font-semibold tracking-wider text-amber-600 dark:text-amber-400">
                        Time remaining: {Math.floor(floodWait / 60)}m {floodWait % 60}s
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-center gap-3 translate-z-10">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSendCode} className="space-y-5 transform-style-3d">
                  <div
                    style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider block">Phone Number</label>
                    <div className="flex gap-2.5 relative" style={{ transformStyle: 'preserve-3d' }}>
                      {/* Country Code Dropdown Trigger */}
                      <div className="relative" ref={dropdownRef} style={{ transformStyle: 'preserve-3d' }}>
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          disabled={isSubmitting || floodWait > 0}
                          className="flex items-center justify-between gap-1 px-2.5 py-3 w-23.75 h-full bg-slate-100/50 dark:bg-dark-900/50 border border-slate-300 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white hover:border-brand-500 focus:border-brand-500 transition-all text-sm font-bold cursor-pointer select-none focus:outline-none"
                        >
                          <span className="text-base leading-none">{selectedCountry.flag}</span>
                          <span className="font-semibold text-xs tracking-tight">{selectedCountry.code}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-dark-400 transition-transform duration-300 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Country List Dropdown Panel */}
                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              style={{ z: 80 }}
                              className="absolute top-full left-0 mt-1.5 w-70 max-h-75 bg-white dark:bg-dark-850 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-[9999] overflow-hidden flex flex-col backdrop-blur-xl"
                            >
                              {/* Search Country Input */}
                              <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-dark-900/30">
                                <Search className="w-4 h-4 text-slate-400 dark:text-dark-400 shrink-0" />
                                <input
                                  type="text"
                                  placeholder="Search country name or code..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-none placeholder-slate-400 font-semibold"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>

                              {/* Scrollable Country List */}
                              <div className="overflow-y-auto flex-1 py-1 max-h-55">
                                {showCustomOption && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const formattedCode = searchQuery.startsWith('+') ? searchQuery : `+${searchQuery}`;
                                      setSelectedCountry({ name: 'Custom Code', code: formattedCode, flag: '🌐' });
                                      setIsDropdownOpen(false);
                                      setSearchQuery('');
                                    }}
                                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer bg-slate-50 dark:bg-dark-900/40 border-b border-slate-100 dark:border-slate-800"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg leading-none">🌐</span>
                                      <span className="text-xs font-semibold text-slate-700 dark:text-dark-200">
                                        Use custom code
                                      </span>
                                    </div>
                                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                                      {searchQuery.startsWith('+') ? searchQuery : `+${searchQuery}`}
                                    </span>
                                  </button>
                                )}

                                {filteredCountries.length > 0 ? (
                                  filteredCountries.map((c) => (
                                    <button
                                      key={`${c.code}-${c.name}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCountry(c);
                                        setIsDropdownOpen(false);
                                        setSearchQuery('');
                                      }}
                                      className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer ${selectedCountry.code === c.code && selectedCountry.name === c.name
                                        ? 'bg-brand-50/50 dark:bg-brand-500/10'
                                        : ''
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg leading-none">{c.flag}</span>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-dark-200 truncate">
                                          {c.name}
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold text-slate-500 dark:text-dark-400 ml-2">
                                        {c.code}
                                      </span>
                                    </button>
                                  ))
                                ) : !showCustomOption ? (
                                  <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-dark-400 font-medium">
                                    No countries found
                                  </div>
                                ) : null}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Phone Number Input */}
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-dark-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          placeholder="98765 43210"
                          value={localNumber}
                          onChange={handlePhoneChange}
                          className="w-full pl-10 pr-4 py-3 bg-slate-100/50 dark:bg-dark-900/50 border border-slate-300 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm font-semibold"
                          disabled={isSubmitting || floodWait > 0}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || floodWait > 0}
                    style={{ transform: 'translateZ(40px)' }}
                    className="w-full mt-2 py-3 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 border border-brand-400/20 active:scale-[0.98] transition-all shadow-lg shadow-brand-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : floodWait > 0 ? (
                      <span>Rate Limited ({Math.floor(floodWait / 60)}m {floodWait % 60}s)</span>
                    ) : (
                      <>
                        <span>Send OTP Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="translate-z-10"
              >
                <h2
                  style={{ transform: 'translateZ(20px)' }}
                  className="text-xl font-bold text-slate-800 dark:text-white mb-1"
                >
                  Enter Verification Code
                </h2>
                <div
                  style={{ transform: 'translateZ(15px)' }}
                  className="flex items-center justify-between mb-6"
                >
                  <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{phoneNumber}</span>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors underline"
                    disabled={isSubmitting}
                  >
                    <Edit className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                </div>

                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-center gap-3 translate-z-10">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyCode} className="space-y-5 transform-style-3d">
                  <div
                    style={{ transform: 'translateZ(30px)' }}
                    className="space-y-1.5"
                  >
                    <label className="text-xs font-semibold text-slate-600 dark:text-dark-300 uppercase tracking-wider block">Telegram OTP Code</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-dark-400">
                        <MessageSquareCode className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Enter 5-digit code"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100/50 dark:bg-dark-900/50 border border-slate-300 dark:border-slate-700/60 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm tracking-widest font-semibold"
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-dark-400 mt-1">Open the Telegram app on your phone to get the code.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ transform: 'translateZ(40px)' }}
                    className="w-full mt-2 py-3 bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 border border-emerald-400/20 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Verify & Connect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
