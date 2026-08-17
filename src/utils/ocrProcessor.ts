/**
 * OCR Processor - Funções melhoradas para leitura de supervisórios e painéis
 *
 * Problema original: OCR travava com imagens ruins, regex restritivo
 * Solução: Pré-processamento robusto, regex flexível, fallback inteligente
 */

// ============================================
// 1️⃣ EXTRAÇÃO DE NÚMEROS MAIS FLEXÍVEL
// ============================================

/**
 * Extrai valores decimais de texto normalizado
 * Suporta: 1.23, 12.34, 123.456, 1234.5678, 1.65E-3
 *
 * @param text - Texto bruto (pode ter OCR errado)
 * @returns Array de números validados
 */
export function extractDecimalsOnly(text: string): string[] {
  const out: string[] = [];
  const normalized = String(text || "")
    .replace(/,/g, ".")           // vírgulas → pontos
    .replace(/O/g, "0")           // O → 0
    .replace(/I/g, "1")           // I → 1
    .replace(/l/g, "1")           // l → 1
    .replace(/S/g, "5");          // S → 5

  // Regex que aceita: 1-6 dígitos antes do ponto, 1-4 depois, notação científica opcional
  const re = /(\d{1,6}[.,]\d{1,4}(?:[eE][+-]?\d{1,2})?)/g;
  let m;
  while ((m = re.exec(normalized)) !== null) {
    const val = cleanOcrNum(m[1]);
    if (val) out.push(val);
  }
  return out;
}

/**
 * Limpa um número extraído por OCR
 * Trata: notação científica, vírgulas/pontos, espaços
 *
 * @param s - Número sujo do OCR
 * @returns Número limpo ou null se inválido
 */
export function cleanOcrNum(s: string | null): string | null {
  if (!s) return null;

  let v = String(s)
    .replace(/\s/g, "")           // remove espaços
    .replace(/,/g, ".")           // vírgula → ponto
    .toUpperCase();

  // Trata notação científica: 1.65E-3
  const scientific = /^(\d+\.?\d*)[eE][+-]?(\d+)$/;
  if (scientific.test(v)) return v;

  // Números normais: até 6 dígitos, até 4 casas decimais
  const m = v.match(/^(\d{1,6}\.?\d{0,4})/);
  return m ? m[1] : null;
}

/**
 * Normaliza texto extraído por OCR
 * Trata confusões comuns: O→0, I→1, l→1, S→5
 *
 * @param t - Texto sujo
 * @returns Texto normalizado
 */
export function normalizeOcrText(t: string): string {
  return t
    .replace(/[|]/g, " ")
    .replace(/O/g, "0")           // O → 0
    .replace(/I/g, "1")           // I → 1
    .replace(/l/g, "1")           // l → 1
    .replace(/S/g, "5")           // S → 5
    .replace(/\s+/g, " ")
    .toUpperCase();
}

// ============================================
// 2️⃣ PRÉ-PROCESSAMENTO DE IMAGEM
// ============================================

/**
 * Aplica blur simples para denoise
 * @param canvas - Canvas com imagem
 * @param radius - Raio do blur (2-3 é ideal)
 * @returns Canvas blurrado
 */
function blurCanvas(canvas: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const newData = new Uint8ClampedArray(d.length);

  const r = Math.round(radius);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += d[(ny * w + nx) * 4];
            count++;
          }
        }
      }
      newData[(y * w + x) * 4] = Math.round(sum / count);
      newData[(y * w + x) * 4 + 1] = newData[(y * w + x) * 4];
      newData[(y * w + x) * 4 + 2] = newData[(y * w + x) * 4];
      newData[(y * w + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(newData, w, h), 0, 0);
  return canvas;
}

/**
 * Pré-processa imagem para melhorar qualidade de OCR
 * - Upscaling se muito pequena
 * - Normalização de contraste (CLAHE simples)
 * - Binarização (preto e branco)
 * - Blur para denoise
 *
 * @param file - Arquivo de imagem
 * @returns Promise com blob processado
 */
export function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;

        // Upscaling se muito pequena
        const minSize = 800;
        if (w < minSize || h < minSize) {
          const scale = Math.max(minSize / w, minSize / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        // Limita tamanho máximo (para não ficar muito lento)
        const maxW = 1800;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não conseguiu inicializar canvas");

        ctx.drawImage(img, 0, 0, w, h);

        // 1️⃣ Calcular histograma e normalizar contraste
        let id = ctx.getImageData(0, 0, w, h);
        const d = id.data;

        const hist = new Array(256).fill(0);
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          hist[Math.round(lum)]++;
        }

        // Remapear brilho (stretch)
        let min = 0;
        let max = 255;
        let accum = 0;
        for (let i = 0; i < 256; i++) {
          if (accum > hist.length * 0.01 && min === 0) min = i;
          accum += hist[i];
          if (accum < hist.length * 0.99) max = i;
        }

        // 2️⃣ Aplicar contraste e binarizar
        const range = Math.max(max - min, 1);
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const lum = 0.3 * r + 0.59 * g + 0.11 * b;

          // Stretch brilho
          const stretched = Math.round(((lum - min) / range) * 255);

          // Binarizar: preto ou branco
          const v = stretched > 127 ? 255 : 0;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(id, 0, 0);

        // 3️⃣ Aplicar blur leve (denoise)
        const blurred = blurCanvas(canvas, 2);

        URL.revokeObjectURL(url);
        blurred.toBlob((blob) => resolve(blob || file), "image/png");
      } catch (e) {
        console.error("Erro preprocessando:", e);
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = url;
  });
}

// ============================================
// 3️⃣ TIPOS E INTERFACE
// ============================================

export interface OcrResult {
  rawText: string;
  numbers: string[];
  confidence: "high" | "medium" | "low";
  timestamp: Date;
}

export interface OcrOptions {
  showProgress?: (progress: number) => void;
  onStatus?: (status: string) => void;
}
