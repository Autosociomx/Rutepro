/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Check, Loader2, RefreshCw, Palette, HelpCircle } from 'lucide-react';

interface LogoGeneratorProps {
  businessName: string;
  currentColor: string;
  businessDescription: string;
  onLogoSelected: (url: string) => void;
  triggerToast: (msg: string, type?: 'ok' | 'err') => void;
}

export function LogoGenerator({
  businessName,
  currentColor,
  businessDescription,
  onLogoSelected,
  triggerToast
}: LogoGeneratorProps) {
  const [promptIcon, setPromptIcon] = useState('🌮');
  const [styleOpt, setStyleOpt] = useState<'modern' | 'minimal' | 'vintage' | 'neon'>('modern');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const [optimizedPrompt, setOptimizedPrompt] = useState<string>('');
  const [isFallback, setIsFallback] = useState(false);

  // Suggested pre-generated assets for quick onboarding
  const premiumAssets = [
    {
      name: 'Tostadas Nallarita (Premium)',
      tag: 'tostadas',
      url: '/src/assets/images/tostadas_nallarita_logo_1780818296932.png',
      icon: '🌮',
      color: '#C9822C'
    }
  ];

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      triggerToast('Ingresa el nombre del negocio primero', 'err');
      return;
    }

    setIsGenerating(true);
    setGeneratedLogo(null);
    setOptimizedPrompt('');
    setIsFallback(false);

    try {
      const fullDesc = `${businessDescription || ''} ${customPrompt}`.trim();
      
      const response = await fetch('/api/generate-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          color: currentColor,
          description: fullDesc,
          style: styleOpt,
          icon: promptIcon
        })
      });

      if (!response.ok) {
        throw new Error('Error de red en el generador');
      }

      const data = await response.json();
      if (data.logo_url) {
        setGeneratedLogo(data.logo_url);
        setIsFallback(!!data.is_fallback);
        if (data.optimized_prompt) {
          setOptimizedPrompt(data.optimized_prompt);
        }
        if (data.is_fallback) {
          triggerToast('✓ Logotipo corporativo vectorizado generado en base a tus colores');
        } else {
          triggerToast('✓ ¡Éxito! Logotipo renderizado con IA (Gemini)');
        }
      } else {
        throw new Error('Formato de respuesta incorrecto');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error al conectar con la IA de Imagen 3. Usando generador vectorial local...', 'err');
      
      // Secondary client-side fallback SVG to avoid blocking the user
      try {
        const fallbackInitials = businessName.substring(0, 3).toUpperCase();
        const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
          <rect fill="#111520" width="400" height="400" rx="40" />
          <circle cx="200" cy="200" r="160" stroke="${currentColor}" stroke-width="4" stroke-dasharray="10 5" fill="none" opacity="0.3" />
          <circle cx="200" cy="200" r="140" fill="#151B2B" stroke="${currentColor}" stroke-width="6" />
          <text x="200" y="170" font-size="95" text-anchor="middle" dominant-baseline="middle">${promptIcon}</text>
          <text x="200" y="270" font-family="system-ui, sans-serif" font-weight="900" font-size="42" fill="#FFFFFF" text-anchor="middle">${fallbackInitials}</text>
          <text x="200" y="315" font-family="monospace" font-weight="bold" font-size="12" fill="${currentColor}" text-anchor="middle" letter-spacing="4">ROUTEPRO ELITE</text>
        </svg>`;
        const base64 = btoa(unescape(encodeURIComponent(svgFallback)));
        setGeneratedLogo(`data:image/svg+xml;base64,${base64}`);
        setIsFallback(true);
      } catch (e) {
        console.error('Client fallback failed too:', e);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const applyLogo = (url: string) => {
    onLogoSelected(url);
    triggerToast('✓ Logotipo corporativo instalado con éxito');
  };

  return (
    <div className="space-y-4 text-left">
      {/* Visual guidelines */}
      <div className="bg-purple-950/10 border border-purple-500/10 rounded-xl p-3 flex gap-2.5 items-start">
        <Sparkles className="text-purple-400 shrink-0 w-4 h-4 mt-0.5" />
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-purple-300">Generación Inteligente de Marca</div>
          <p className="text-[9px] text-purple-200/70 leading-relaxed">
            Nuestra IA analizará el nombre <strong className="text-white">"{businessName || 'de tu empresa'}"</strong> para crear un sello de marca. No necesitas diseñar nada.
          </p>
        </div>
      </div>

      {/* Preset Match Helper */}
      {businessName.toLowerCase().includes('nallarita') && (
        <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl space-y-2">
          <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
            ⭐️ Premium Asset Match
          </div>
          <p className="text-[9px] text-[#8A93A8]">
            Detectamos que el nombre coincide con <span className="font-semibold text-white">Tostadas Nallarita</span>. Tenemos un logotipo pre-diseñado ultra premium de alta fidelidad listo:
          </p>
          <div className="flex items-center justify-between gap-3 bg-[#06080C] p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
              <img 
                src="/src/assets/images/tostadas_nallarita_logo_1780818296932.png" 
                className="w-10 h-10 object-contain rounded bg-[#111520] p-1 border border-white/10" 
                alt="Tostadas Nallarita Logo Pre-generado"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <div className="text-[10px] font-bold text-white">Logo Oficial Nallarita</div>
                <div className="text-[8px] text-[#8A93A8]">Especialidad de maíz y botanas</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => applyLogo('/src/assets/images/tostadas_nallarita_logo_1780818296932.png')}
              className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-white font-extrabold rounded text-[9px] cursor-pointer transition-all active:scale-95"
            >
              Cargar Logo Oficial
            </button>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        {/* Aspect Choice */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Giro Comercial (Icono)</label>
            <div className="flex gap-1.5">
              <input 
                type="text" 
                value={promptIcon} 
                onChange={(e) => setPromptIcon(e.target.value)}
                className="w-10 bg-[#06080C] border border-white/5 rounded-lg text-center font-bold text-xs p-1 h-8 text-white focus:outline-none"
              />
              <div className="flex-1 overflow-x-auto no-scrollbar flex gap-1 items-center bg-[#06080C] px-1.5 py-0.5 rounded-lg border border-white/5 h-8">
                {['🌮', '🍞', '💧', '🏪', '🥐', '🥑', '🥩', '☕'].map((emo) => (
                  <button 
                    key={emo} 
                    type="button" 
                    onClick={() => setPromptIcon(emo)}
                    className="hover:scale-125 transition-all text-xs cursor-pointer shrink-0 p-0.5"
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Dirección Artística</label>
            <select
              value={styleOpt}
              onChange={(e: any) => setStyleOpt(e.target.value)}
              className="w-full h-8 bg-[#06080C] border border-white/5 rounded-lg text-[10px] text-white px-2 focus:outline-none focus:border-purple-500"
            >
              <option value="modern">Empresarial Moderno</option>
              <option value="minimal">Minimalista Vector</option>
              <option value="vintage">Sello Retro Vintage</option>
              <option value="neon">Brillo Neón Futurista</option>
            </select>
          </div>
        </div>

        {/* Custom Instructions prompt */}
        <div className="space-y-1">
          <label className="text-[9px] font-mono text-[#3E4A60] uppercase font-bold tracking-wider">Concepto clave (Opcional)</label>
          <input 
            type="text" 
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ej: Trigo orgánico dorado, flama rústica, etc."
            className="w-full bg-[#06080C] border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500 placeholder-white/20"
          />
        </div>

        {/* Action Trigger */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 active:scale-95 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Generando en la Nube...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Generar Logotipo Digital</span>
            </>
          )}
        </button>
      </div>

      {/* Render Box for Generated Result */}
      {isGenerating && (
        <div className="h-44 bg-[#06080C] border border-dashed border-purple-500/20 rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-2 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <div className="text-[10px] font-bold text-purple-300">Consultando a Gemini Imagen 3...</div>
          <p className="text-[8px] text-[#8A93A8] max-w-xs leading-normal">
            Estamos creando un logotipo exclusivo aplicando tu gama de colores y el nombre "{businessName}".
          </p>
        </div>
      )}

      {generatedLogo && (
        <div className="p-3.5 bg-[#06080C] border border-white/5 rounded-xl space-y-3">
          <div className="text-center">
            <span className="text-[8px] font-bold py-0.5 px-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full select-none">
              {isFallback ? 'LOGOTIPO VECTORIAL ADAPTADO' : 'LOGOTIPO EXCLUSIVO GENERADO POR IA'}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative group w-36 h-36 rounded-2xl bg-[#111520] border border-white/10 p-2 flex items-center justify-center overflow-hidden">
              <img 
                src={generatedLogo} 
                alt="Logo Generado Inteligente" 
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">1:1 Imagen PNG</span>
              </div>
            </div>
          </div>

          {optimizedPrompt && (
            <div className="bg-[#111520]/80 border border-purple-500/10 rounded-xl p-3 text-left space-y-1.5">
              <div className="text-[9px] font-mono font-extrabold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                Idea Creativa de Gemini:
              </div>
              <p className="text-[9px] text-[#8A93A8] italic leading-relaxed">
                "{optimizedPrompt}"
              </p>
            </div>
          )}

          {isFallback && (
            <p className="text-[8px] text-left text-[#8A93A8] leading-tight">
              * Nota: Se aplicó nuestro motor vectorial inteligente local porque tu clave API no soporta Imagen. El logo quedó perfectamente optimizado con tu color corporativo.
            </p>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              className="flex-1 py-1.5 bg-[#111520] border border-white/5 hover:bg-[#181D2B] text-[#EEF1F8] font-bold rounded-lg text-[9px] cursor-pointer flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Regenerar
            </button>
            <button
              type="button"
              onClick={() => applyLogo(generatedLogo)}
              className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold rounded-lg text-[9px] cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10"
            >
              <Check className="w-3 h-3" />
              Instalar Logo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
