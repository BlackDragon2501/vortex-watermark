// Vortex Watermark - Marca de agua por lotes sobre imágenes y PDFs.
// Canvas para imágenes, pdf-lib para PDFs, fflate para ZIP.
// 100% local en el navegador, sin backend.

import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { zipSync } from 'fflate'

export type WmMode = 'text' | 'image'
export type WmPosition =
  | 'tl' | 'tc' | 'tr'
  | 'ml' | 'mc' | 'mr'
  | 'bl' | 'bc' | 'br'
  | 'tile'

export interface WmOptions {
  mode: WmMode
  text: string
  fontScale: number // % del lado menor de la página (p.ej. 6 = 6%)
  color: string // hex
  opacity: number // 0..1
  rotation: number // grados
  margin: number // % del lado menor
  position: WmPosition
  /** escala del logo respecto al ancho/alto del lienzo */
  logoScale: number
  format: 'png' | 'jpeg'
  quality: number // 0..1 para jpeg
}

export const DEFAULT_OPTIONS: WmOptions = {
  mode: 'text',
  text: '© Vortex Company',
  fontScale: 6,
  color: '#ffffff',
  opacity: 0.5,
  rotation: 0,
  margin: 4,
  position: 'br',
  logoScale: 25,
  format: 'jpeg',
  quality: 0.92,
}

export interface WmFile {
  id: string
  file: File
  kind: 'image' | 'pdf'
  status: 'pending' | 'done' | 'error'
  outBlob?: Blob
  outUrl?: string
  outName?: string
  outSize?: number
  error?: string
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export function isImage(file: File): boolean {
  return /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '')
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(v, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** calcula x,y del ancla según posición y tamaño del sello */
function anchorPos(
  position: WmPosition,
  W: number,
  H: number,
  w: number,
  h: number,
  marginPx: number
): { x: number; y: number } {
  // x,y = esquina superior-izquierda del sello (sistema canvas, y hacia abajo)
  let x = marginPx
  let y = marginPx
  if (position.includes('c')) x = (W - w) / 2
  if (position.includes('r')) x = W - w - marginPx
  if (position.includes('m')) y = (H - h) / 2
  if (position.includes('b')) y = H - h - marginPx
  return { x, y }
}

/** estampa la marca sobre un canvas ya dibujado con la imagen base */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  opts: WmOptions,
  logo: HTMLImageElement | null
) {
  const minSide = Math.min(W, H)
  const marginPx = (opts.margin / 100) * minSide
  ctx.save()
  ctx.globalAlpha = opts.opacity
  ctx.fillStyle = opts.color

  if (opts.mode === 'text') {
    const fontSize = Math.max(10, (opts.fontScale / 100) * minSide)
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`
    const metrics = ctx.measureText(opts.text)
    const tw = metrics.width
    const th = fontSize
    if (opts.position === 'tile') {
      const stepX = tw + marginPx * 4
      const stepY = th + marginPx * 4
      for (let y = -th; y < H + stepY; y += stepY) {
        for (let x = -tw; x < W + stepX; x += stepX) {
          ctx.save()
          ctx.translate(x + tw / 2, y + th / 2)
          ctx.rotate((opts.rotation * Math.PI) / 180)
          ctx.fillText(opts.text, -tw / 2, th / 2)
          ctx.restore()
        }
      }
    } else {
      const { x, y } = anchorPos(opts.position, W, H, tw, th, marginPx)
      ctx.save()
      ctx.translate(x + tw / 2, y + th / 2)
      ctx.rotate((opts.rotation * Math.PI) / 180)
      ctx.fillText(opts.text, -tw / 2, th / 2)
      ctx.restore()
    }
  } else if (logo) {
    const lw = (opts.logoScale / 100) * W
    const lh = (lw / logo.naturalWidth) * logo.naturalHeight
    if (opts.position === 'tile') {
      const stepX = lw + marginPx * 4
      const stepY = lh + marginPx * 4
      for (let y = -lh; y < H + stepY; y += stepY) {
        for (let x = -lw; x < W + stepX; x += stepX) {
          ctx.save()
          ctx.translate(x + lw / 2, y + lh / 2)
          ctx.rotate((opts.rotation * Math.PI) / 180)
          ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh)
          ctx.restore()
        }
      }
    } else {
      const { x, y } = anchorPos(opts.position, W, H, lw, lh, marginPx)
      ctx.save()
      ctx.translate(x + lw / 2, y + lh / 2)
      ctx.rotate((opts.rotation * Math.PI) / 180)
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh)
      ctx.restore()
    }
  }
  ctx.restore()
}

export async function loadImageEl(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No pude leer la imagen'))
      img.src = url
    })
    return img
  } finally {
    // dar tiempo al decodificador antes de liberar
    setTimeout(() => URL.revokeObjectURL(url), 15000)
  }
}

/** procesa una imagen y devuelve el blob con la marca aplicada */
export async function watermarkImage(
  file: File,
  opts: WmOptions,
  logo: HTMLImageElement | null
): Promise<Blob> {
  const img = await loadImageEl(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  drawWatermark(ctx, canvas.width, canvas.height, opts, logo)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No pude exportar la imagen'))),
      opts.format === 'png' ? 'image/png' : 'image/jpeg',
      opts.quality
    )
  })
}

/** procesa un PDF y devuelve el PDF con la marca en todas las páginas */
export async function watermarkPdf(
  file: File,
  opts: WmOptions,
  logoPng: Uint8Array | null
): Promise<Blob> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pages = doc.getPages()

  let embedImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  if (opts.mode === 'image' && logoPng) {
    embedImg = await doc.embedPng(logoPng)
  }
  const { r, g, b } = hexToRgb(opts.color)

  for (const page of pages) {
    const { width: W, height: H } = page.getSize()
    const minSide = Math.min(W, H)
    const marginPx = (opts.margin / 100) * minSide

    if (opts.mode === 'text') {
      const fontSize = Math.max(8, (opts.fontScale / 100) * minSide)
      const twApprox = opts.text.length * fontSize * 0.55
      const th = fontSize
      const stampOne = (x: number, y: number) => {
        page.drawText(opts.text, {
          x: x + twApprox / 2,
          y: y + th / 2,
          size: fontSize,
          font: undefined,
          color: rgb(r / 255, g / 255, b / 255),
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        })
      }
      if (opts.position === 'tile') {
        const stepX = twApprox + marginPx * 4
        const stepY = th + marginPx * 4
        for (let y = marginPx; y < H; y += stepY) {
          for (let x = marginPx; x < W; x += stepX) stampOne(x, y)
        }
      } else {
        // pdf-lib: origen abajo-izquierda; convertimos del sistema canvas
        const { x, y } = anchorPos(opts.position, W, H, twApprox, th, marginPx)
        stampOne(x, H - y - th)
      }
    } else if (embedImg) {
      const lw = (opts.logoScale / 100) * W
      const lh = (lw / embedImg.width) * embedImg.height
      const stampOne = (x: number, yTop: number) => {
        page.drawImage(embedImg, {
          x: x + lw / 2 - lw / 2,
          y: H - yTop - lh,
          width: lw,
          height: lh,
          opacity: opts.opacity,
          rotate: degrees(opts.rotation),
        })
      }
      if (opts.position === 'tile') {
        const stepX = lw + marginPx * 4
        const stepY = lh + marginPx * 4
        for (let y = marginPx; y < H; y += stepY) {
          for (let x = marginPx; x < W; x += stepX) stampOne(x, y)
        }
      } else {
        const { x, y } = anchorPos(opts.position, W, H, lw, lh, marginPx)
        stampOne(x, y)
      }
    }
  }
  const out = await doc.save()
  return new Blob([out as unknown as BlobPart], { type: 'application/pdf' })
}

export function outFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'archivo'
  return `${base}-marca.${ext}`
}

export async function downloadZip(items: { name: string; blob: Blob }[], zipName: string) {
  const files: Record<string, [Uint8Array, { level: number }]> = {}
  for (const it of items) {
    const buf = new Uint8Array(await it.blob.arrayBuffer())
    files[it.name] = [buf, { level: 6 }]
  }
  const zipped = zipSync(files, { level: 6 })
  const url = URL.createObjectURL(new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
