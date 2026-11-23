'use client'

// Vortex Watermark - Aplica marca de agua (texto o logo) a lotes de imágenes y PDFs.
// Todo se procesa en el navegador: nada se sube a ningún servidor.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Droplets,
  Upload,
  Type,
  Image as ImageIcon,
  Play,
  Download,
  FileArchive,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  RotateCw,
} from 'lucide-react'
import {
  DEFAULT_OPTIONS,
  WmFile,
  WmOptions,
  WmPosition,
  downloadBlob,
  downloadZip,
  fmtBytes,
  isImage,
  isPdf,
  loadImageEl,
  outFileName,
  watermarkImage,
  watermarkPdf,
} from '@/lib/watermark'

const SUPPORT_EMAIL = 'vortexmusic.soporte.app@gmail.com'
const ACCENT = '#e879f9'
const ACCENT2 = '#f0abfc'

function VortexLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="10" fill="#161616" />
      <circle cx="24" cy="24" r="17" fill="none" stroke={ACCENT} strokeWidth="3.5" />
      <path d="M24 10a14 14 0 1 1-9.9 4.1" fill="none" stroke={ACCENT2} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 17a7 7 0 1 0 7 7" fill="none" stroke={ACCENT2} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill={ACCENT2} />
    </svg>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-[#2b2b31] bg-[#141416] px-6 py-4">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 text-center">
        <p className="text-[11px] text-[#9b9ba4]">
          Vórtex Watermark · Derechos Reservados © 2026 Vortex Company ·{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#f0abfc] hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-[11px] text-[#9b9ba4]">Gratis · Sin anuncios · 100% local en tu navegador</p>
      </div>
    </footer>
  )
}

const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2b2b31] bg-[#1e1e22] px-3 py-2 text-xs font-medium text-[#ececf1] hover:bg-[#26262b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

const btnAccent =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#0f0f10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#e879f9] hover:bg-[#f0abfc]'

const POSITIONS: { id: WmPosition; label: string }[] = [
  { id: 'tl', label: '↖' }, { id: 'tc', label: '↑' }, { id: 'tr', label: '↗' },
  { id: 'ml', label: '←' }, { id: 'mc', label: '·' }, { id: 'mr', label: '→' },
  { id: 'bl', label: '↙' }, { id: 'bc', label: '↓' }, { id: 'br', label: '↘' },
]

export default function WatermarkApp() {
  const [files, setFiles] = useState<WmFile[]>([])
  const [opts, setOpts] = useState<WmOptions>(DEFAULT_OPTIONS)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoReady, setLogoReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const logoPngRef = useRef<Uint8Array | null>(null)

  const setOpt = <K extends keyof WmOptions>(k: K, v: WmOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  const onLogo = useCallback(async (f: File | null) => {
    if (!f) return
    setLogoReady(false)
    setLogoFile(f)
    const img = await loadImageEl(f)
    logoImgRef.current = img
    // PNG con transparencia para pdf-lib
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
    const buf = new Uint8Array(await blob.arrayBuffer())
    logoPngRef.current = buf
    setLogoReady(true)
  }, [])

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return
      const accepted: WmFile[] = []
      const rejected: string[] = []
      for (const f of Array.from(list)) {
        if (isPdf(f)) accepted.push({ id: Math.random().toString(36).slice(2), file: f, kind: 'pdf', status: 'pending' })
        else if (isImage(f)) accepted.push({ id: Math.random().toString(36).slice(2), file: f, kind: 'image', status: 'pending' })
        else rejected.push(f.name)
      }
      setFiles((prev) => [...prev, ...accepted])
      if (rejected.length) console.warn('Archivos no soportados:', rejected)
    },
    []
  )

  const processAll = useCallback(async () => {
    if (!files.length || busy) return
    if (opts.mode === 'image' && !logoReady) return
    setBusy(true)
    try {
      for (const f of files.filter((x) => x.status === 'pending')) {
        try {
          let blob: Blob
          let ext: string
          if (f.kind === 'image') {
            blob = await watermarkImage(f.file, opts, logoImgRef.current)
            ext = opts.format === 'png' ? 'png' : 'jpg'
          } else {
            blob = await watermarkPdf(f.file, opts, logoPngRef.current)
            ext = 'pdf'
          }
          const name = outFileName(f.file.name, ext)
          setFiles((prev) =>
            prev.map((x) =>
              x.id === f.id
                ? { ...x, status: 'done', outBlob: blob, outUrl: URL.createObjectURL(blob), outName: name, outSize: blob.size, error: undefined }
                : x
            )
          )
        } catch (e) {
          setFiles((prev) =>
            prev.map((x) =>
              x.id === f.id ? { ...x, status: 'error', error: e instanceof Error ? e.message : 'Error' } : x
            )
          )
        }
      }
    } finally {
      setBusy(false)
    }
  }, [files, opts, busy, logoReady])

  const resetResults = () => {
    setFiles((prev) =>
      prev.map((x) => {
        if (x.outUrl) URL.revokeObjectURL(x.outUrl)
        return { ...x, status: 'pending' as const, outBlob: undefined, outUrl: undefined, outName: undefined, outSize: undefined }
      })
    )
  }

  const doneCount = files.filter((f) => f.status === 'done').length

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[#2b2b31] bg-[#141416] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <VortexLogo className="w-9 h-9" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">
              Vórtex Watermark <span className="font-normal text-[#9b9ba4]">· Marca de agua en lotes, sin límites</span>
            </h1>
            <p className="text-[11px] text-[#9b9ba4]">Tu logo o texto sobre imágenes y PDFs · todo se procesa en tu equipo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* Panel de opciones */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#2b2b31] bg-[#17171a] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9b9ba4]">Tipo de marca</p>
              <div className="mb-3 flex gap-2">
                <button
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    opts.mode === 'text' ? 'border-[#e879f9] bg-[#241a27] text-[#f0abfc]' : 'border-[#2b2b31] bg-[#1e1e22] text-[#9b9ba4]'
                  }`}
                  onClick={() => setOpt('mode', 'text')}
                >
                  <Type className="mr-1 inline h-3.5 w-3.5" /> Texto
                </button>
                <button
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    opts.mode === 'image' ? 'border-[#e879f9] bg-[#241a27] text-[#f0abfc]' : 'border-[#2b2b31] bg-[#1e1e22] text-[#9b9ba4]'
                  }`}
                  onClick={() => setOpt('mode', 'image')}
                >
                  <ImageIcon className="mr-1 inline h-3.5 w-3.5" /> Logo
                </button>
              </div>

              {opts.mode === 'text' ? (
                <>
                  <input
                    value={opts.text}
                    onChange={(e) => setOpt('text', e.target.value)}
                    placeholder="Texto de la marca…"
                    className="w-full rounded-xl border border-[#2b2b31] bg-[#0f0f10] px-3 py-2.5 text-sm outline-none focus:border-[#e879f9]"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <label className="flex flex-1 items-center gap-2 text-xs text-[#9b9ba4]">
                      Color <input type="color" value={opts.color} onChange={(e) => setOpt('color', e.target.value)} className="h-7 w-10 rounded" />
                    </label>
                    <label className="flex flex-1 items-center gap-2 text-xs text-[#9b9ba4]">
                      Tamaño
                      <input type="range" min={2} max={20} value={opts.fontScale} onChange={(e) => setOpt('fontScale', parseInt(e.target.value, 10))} className="flex-1" />
                      <span className="w-8 text-right font-mono text-[#ececf1]">{opts.fontScale}%</span>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <input ref={logoRef} type="file" accept="image/png,image/*" hidden onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
                  <button className={`${btn} w-full`} onClick={() => logoRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> {logoFile ? logoFile.name : 'Elegir logo (PNG con transparencia)'}
                  </button>
                  {logoFile && !logoReady && <p className="mt-2 text-xs text-[#9b9ba4]">Cargando logo…</p>}
                  <label className="mt-3 flex items-center gap-2 text-xs text-[#9b9ba4]">
                    Escala del logo
                    <input type="range" min={5} max={60} value={opts.logoScale} onChange={(e) => setOpt('logoScale', parseInt(e.target.value, 10))} className="flex-1" />
                    <span className="w-8 text-right font-mono text-[#ececf1]">{opts.logoScale}%</span>
                  </label>
                </>
              )}

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[#9b9ba4]">Posición</p>
              <div className="flex items-start gap-3">
                <div className="grid w-28 shrink-0 grid-cols-3 gap-1">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setOpt('position', p.id)}
                      className={`h-8 rounded-md text-sm transition-colors ${
                        opts.position === p.id ? 'bg-[#e879f9] text-[#0f0f10]' : 'bg-[#1e1e22] text-[#9b9ba4] hover:bg-[#26262b]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-[#ececf1]">
                  <input
                    type="checkbox"
                    checked={opts.position === 'tile'}
                    onChange={(e) => setOpt('position', e.target.checked ? 'tile' : 'br')}
                    className="accent-[#e879f9]"
                  />
                  Mosaico (repetido en toda la página)
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-xs text-[#9b9ba4]">
                  Opacidad
                  <input type="range" min={5} max={100} value={Math.round(opts.opacity * 100)} onChange={(e) => setOpt('opacity', parseInt(e.target.value, 10) / 100)} className="flex-1" />
                  <span className="w-8 text-right font-mono text-[#ececf1]">{Math.round(opts.opacity * 100)}%</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#9b9ba4]">
                  <RotateCw className="h-3.5 w-3.5" /> Rotación
                  <input type="range" min={-90} max={90} value={opts.rotation} onChange={(e) => setOpt('rotation', parseInt(e.target.value, 10))} className="flex-1" />
                  <span className="w-10 text-right font-mono text-[#ececf1]">{opts.rotation}°</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#9b9ba4]">
                  Margen
                  <input type="range" min={0} max={15} value={opts.margin} onChange={(e) => setOpt('margin', parseInt(e.target.value, 10))} className="flex-1" />
                  <span className="w-8 text-right font-mono text-[#ececf1]">{opts.margin}%</span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2b2b31] bg-[#17171a] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9b9ba4]">Salida de imágenes</p>
              <div className="flex gap-2">
                {(['jpeg', 'png'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setOpt('format', f)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold uppercase transition-colors ${
                      opts.format === f ? 'border-[#e879f9] bg-[#241a27] text-[#f0abfc]' : 'border-[#2b2b31] bg-[#1e1e22] text-[#9b9ba4]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {opts.format === 'jpeg' && (
                <label className="mt-3 flex items-center gap-2 text-xs text-[#9b9ba4]">
                  Calidad
                  <input type="range" min={40} max={100} value={Math.round(opts.quality * 100)} onChange={(e) => setOpt('quality', parseInt(e.target.value, 10) / 100)} className="flex-1" />
                  <span className="w-8 text-right font-mono text-[#ececf1]">{Math.round(opts.quality * 100)}</span>
                </label>
              )}
            </div>
          </section>

          {/* Panel de archivos */}
          <section className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
              onClick={() => filesRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver ? 'border-[#e879f9] bg-[#221527]' : 'border-[#2b2b31] bg-[#17171a]'
              }`}
            >
              <Droplets className="mx-auto mb-3 h-10 w-10 text-[#e879f9]" />
              <p className="text-sm font-semibold">Arrastra imágenes (JPG, PNG, WebP) y PDFs</p>
              <p className="mt-1 text-xs text-[#9b9ba4]">La marca se aplicará a todos los archivos a la vez</p>
            </div>
            <input ref={filesRef} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => addFiles(e.target.files)} />

            <div className="flex flex-wrap items-center gap-2">
              <button className={btnAccent} onClick={() => void processAll()} disabled={!files.length || busy || (opts.mode === 'image' && !logoReady)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {busy ? 'Procesando…' : 'Aplicar marca de agua'}
              </button>
              <button
                className={btn}
                disabled={doneCount === 0}
                onClick={() =>
                  void downloadZip(
                    files.filter((f) => f.status === 'done' && f.outBlob && f.outName).map((f) => ({ name: f.outName!, blob: f.outBlob! })),
                    'vortex-watermark.zip'
                  )
                }
              >
                <FileArchive className="h-3.5 w-3.5" /> Descargar ZIP ({doneCount})
              </button>
              {files.some((f) => f.status !== 'pending') && (
                <button className={btn} onClick={resetResults}>
                  <RotateCw className="h-3.5 w-3.5" /> Reprocesar todo
                </button>
              )}
              {files.length > 0 && (
                <span className="ml-auto text-xs text-[#9b9ba4]">{files.length} archivo(s)</span>
              )}
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[#2b2b31] bg-[#17171a] px-4 py-3">
                    {f.kind === 'pdf' ? <FileArchive className="h-4 w-4 shrink-0 text-[#f0abfc]" /> : <ImageIcon className="h-4 w-4 shrink-0 text-[#e879f9]" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{f.file.name}</p>
                      <p className="text-[11px] text-[#9b9ba4]">
                        {fmtBytes(f.file.size)}
                        {f.status === 'done' && ` → ${f.outName} (${fmtBytes(f.outSize ?? 0)})`}
                        {f.status === 'error' && <span className="text-[#f87171]"> · {f.error}</span>}
                      </p>
                    </div>
                    {f.status === 'done' && (
                      <>
                        <button className={btn} onClick={() => downloadBlob(f.outBlob!, f.outName!)}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                      </>
                    )}
                    {f.status === 'error' && <XCircle className="h-4 w-4 text-[#f87171]" />}
                    {f.status === 'pending' && busy && <Loader2 className="h-4 w-4 animate-spin text-[#9b9ba4]" />}
                    <button
                      className="text-[#9b9ba4] hover:text-[#f87171]"
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
