/**
 * Supervisory Data Capture
 *
 * Componente para capturar dados de painéis de supervisão
 * via OCR (foto) ou colagem de texto (Live Text)
 */

import React, { useState, useRef } from "react";
import {
  extractDecimalsOnly,
  cleanOcrNum,
  normalizeOcrText,
  preprocessImage,
} from "../utils/ocrProcessor";

interface CapturedValue {
  tag: string;
  value: string;
  timestamp: Date;
}

interface CaptureSession {
  id: string;
  title: string;
  values: CapturedValue[];
  createdAt: Date;
}

const SupervisoryDataCapture: React.FC = () => {
  const [mode, setMode] = useState<"idle" | "camera" | "paste">("idle");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [extractedValues, setExtractedValues] = useState<string[]>([]);
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [currentSession, setCurrentSession] = useState<Partial<CaptureSession>>({
    values: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================
  // Modo 1: Foto (OCR)
  // ============================================

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus("📸 Processando imagem...");
    setExtractedValues([]);

    try {
      // Pré-processar imagem
      setStatus("📸 Pré-processando imagem...");
      const processedBlob = await preprocessImage(file);

      // Simular OCR com Tesseract.js
      setStatus("🤖 Lendo texto via IA...");
      const ocrText = await simulateOcr(processedBlob);

      // Extrair valores
      const numbers = extractDecimalsOnly(ocrText);
      setExtractedValues(numbers);

      if (numbers.length > 0) {
        setStatus(`✅ Extraídos ${numbers.length} valores!`);
      } else {
        setStatus("⚠️ Nenhum valor encontrado. Tente com imagem melhor.");
      }
    } catch (error) {
      console.error("Erro OCR:", error);
      setStatus("❌ Erro ao processar imagem");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simula OCR - substituir por Tesseract.js real em produção
   */
  const simulateOcr = async (blob: Blob): Promise<string> => {
    // Em produção, usar:
    // const worker = await Tesseract.createWorker();
    // const result = await worker.recognize(blob);
    // return result.data.text;

    // Por enquanto, retorna placeholder
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          `LT-410001 86.91\nLT-410002 45.41\nLT-410003 51.79\nFIT-140001 1.65E-3\nAIT-220001 7.50`
        );
      }, 2000);
    });
  };

  // ============================================
  // Modo 2: Colar Texto (Live Text)
  // ============================================

  const handlePasteText = () => {
    const text = textAreaRef.current?.value || "";
    if (!text.trim()) {
      setStatus("❌ Cole algum texto primeiro");
      return;
    }

    const numbers = extractDecimalsOnly(text);
    setExtractedValues(numbers);

    if (numbers.length > 0) {
      setStatus(`✅ Extraídos ${numbers.length} valores!`);
    } else {
      setStatus("⚠️ Nenhum valor encontrado no texto");
    }
  };

  // ============================================
  // Salvar valores
  // ============================================

  const handleSaveValues = () => {
    if (extractedValues.length === 0) {
      setStatus("❌ Nenhum valor para salvar");
      return;
    }

    const values: CapturedValue[] = extractedValues.map((val, idx) => ({
      tag: `SENSOR_${idx + 1}`,
      value: val,
      timestamp: new Date(),
    }));

    const session: CaptureSession = {
      id: `session_${Date.now()}`,
      title: `Captura ${new Date().toLocaleTimeString("pt-BR")}`,
      values,
      createdAt: new Date(),
    };

    setSessions([session, ...sessions]);
    setCurrentSession({});
    setExtractedValues([]);
    setStatus("💾 Valores salvos!");

    // Limpar inputs
    if (textAreaRef.current) textAreaRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        📊 Captura de Dados de Supervisório
      </h2>

      {/* Status */}
      {status && (
        <div
          className={`mb-4 p-3 rounded ${
            status.includes("❌")
              ? "bg-red-100 text-red-700"
              : status.includes("✅")
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {status}
        </div>
      )}

      {/* Modo seleção */}
      {mode === "idle" && (
        <div className="space-y-3">
          <button
            onClick={() => setMode("camera")}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            📷 Fotografar Painel
          </button>
          <button
            onClick={() => setMode("paste")}
            className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2"
          >
            📋 Colar com Live Text
          </button>
        </div>
      )}

      {/* Modo câmera */}
      {mode === "camera" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={handleCameraClick}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "⏳ Processando..." : "📸 Selecionar Foto"}
          </button>
          <button
            onClick={() => {
              setMode("idle");
              setStatus("");
            }}
            className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* Modo colar */}
      {mode === "paste" && (
        <div className="space-y-3">
          <textarea
            ref={textAreaRef}
            placeholder="Cole o texto do supervisório aqui..."
            className="w-full p-3 border rounded font-mono text-sm h-32"
            defaultValue="LT-410001 86.91&#10;LT-410002 45.41&#10;LT-410003 51.79"
          />
          <button
            onClick={handlePasteText}
            className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600"
          >
            ✅ Extrair Valores
          </button>
          <button
            onClick={() => {
              setMode("idle");
              setStatus("");
            }}
            className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* Valores extraídos */}
      {extractedValues.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-3">
            Valores Extraídos ({extractedValues.length})
          </h3>
          <div className="space-y-2">
            {extractedValues.map((val, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-white border rounded"
              >
                <span className="font-mono">{val}</span>
                <button
                  onClick={() => {
                    setExtractedValues(extractedValues.filter((_, i) => i !== idx));
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveValues}
            className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
          >
            💾 Salvar Valores
          </button>
        </div>
      )}

      {/* Histórico de sessões */}
      {sessions.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-3">Histórico ({sessions.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <details
                key={session.id}
                className="p-3 bg-white border rounded cursor-pointer"
              >
                <summary className="font-semibold">
                  {session.title} - {session.values.length} valores
                </summary>
                <div className="mt-2 space-y-1 text-sm">
                  {session.values.map((val, idx) => (
                    <div key={idx} className="text-gray-600">
                      {val.tag}: {val.value}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisoryDataCapture;
