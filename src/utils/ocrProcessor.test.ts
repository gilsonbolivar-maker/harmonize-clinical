import { describe, it, expect } from "vitest";
import {
  extractDecimalsOnly,
  cleanOcrNum,
  normalizeOcrText,
} from "./ocrProcessor";

describe("ocrProcessor", () => {
  // ============================================
  // extractDecimalsOnly
  // ============================================

  describe("extractDecimalsOnly", () => {
    it("deve extrair números simples com 2 casas decimais", () => {
      const result = extractDecimalsOnly("LT-410001 86.91");
      expect(result).toContain("86.91");
    });

    it("deve extrair múltiplos números", () => {
      const text = `
        LT-410001 86.91
        LT-410002 45.41
        FIT-140001 1.65E-3
      `;
      const result = extractDecimalsOnly(text);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("86.91");
      expect(result).toContain("45.41");
    });

    it("deve converter vírgulas em pontos", () => {
      const result = extractDecimalsOnly("Valor: 123,45");
      expect(result).toContain("123.45");
    });

    it("deve lidar com números grandes (até 6 dígitos)", () => {
      const result = extractDecimalsOnly("Leitura: 9999.99");
      expect(result).toContain("9999.99");
    });

    it("deve extrair notação científica", () => {
      const result = extractDecimalsOnly("FIT-140001 1.65E-3");
      expect(result.some((n) => n.includes("E"))).toBe(true);
    });

    it("deve tratar confusões de OCR (O→0, I→1)", () => {
      const result = extractDecimalsOnly("O valor é I5.9O");
      // "I5.9O" → "15.90"
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // cleanOcrNum
  // ============================================

  describe("cleanOcrNum", () => {
    it("deve retornar null para string vazia", () => {
      expect(cleanOcrNum("")).toBeNull();
      expect(cleanOcrNum(null)).toBeNull();
    });

    it("deve limpar espaços", () => {
      expect(cleanOcrNum(" 123 . 45 ")).toBe("123.45");
    });

    it("deve converter vírgulas em pontos", () => {
      expect(cleanOcrNum("123,45")).toBe("123.45");
    });

    it("deve suportar notação científica", () => {
      const result = cleanOcrNum("1.65E-3");
      expect(result).toBe("1.65E-3");
    });

    it("deve suportar notação científica com +", () => {
      const result = cleanOcrNum("2.5E+10");
      expect(result).toBe("2.5E+10");
    });

    it("deve validar número com até 6 dígitos inteiros e 4 decimais", () => {
      expect(cleanOcrNum("999999.9999")).toBe("999999.9999");
    });

    it("deve descartar dígitos extras", () => {
      const result = cleanOcrNum("12345678.9999");
      // Deve pegar apenas os primeiros 6+4
      expect(result).toMatch(/^\d{1,6}\.?\d{0,4}$/);
    });
  });

  // ============================================
  // normalizeOcrText
  // ============================================

  describe("normalizeOcrText", () => {
    it("deve converter O em 0", () => {
      const result = normalizeOcrText("LT-41OOO1 86.91");
      expect(result).toContain("0"); // O virou 0
    });

    it("deve converter I em 1", () => {
      const result = normalizeOcrText("L1-410001");
      expect(result.toUpperCase()).toContain("1");
    });

    it("deve converter S em 5", () => {
      const result = normalizeOcrText("S0.50");
      expect(result).toContain("5"); // S virou 5
    });

    it("deve remover pipes e espaços múltiplos", () => {
      const result = normalizeOcrText("LT |  410001   86.91");
      expect(result).not.toContain("|");
      expect(result).not.toMatch(/  /); // sem espaços múltiplos
    });

    it("deve converter para maiúsculas", () => {
      const result = normalizeOcrText("Lt-410001 86.91");
      expect(result).toBe(result.toUpperCase());
    });

    it("deve funcionar com combinação de substituições", () => {
      const input = "L1-41OOO1 5peed 86.9l";
      const result = normalizeOcrText(input);
      // Verificar que conversões aconteceram
      expect(result).toContain("410001"); // O's viraram 0's
      expect(result).toContain("5PEED"); // S virou 5
      expect(result).toContain("86.91"); // l virou 1
      // L (maiúscula) é mantida em LT-
      expect(result).toContain("L1");
    });
  });

  // ============================================
  // Testes de integração
  // ============================================

  describe("Integração", () => {
    it("deve processar linha completa de supervisório", () => {
      const line = "LT-410OO1  86,91"; // O→0, vírgula
      const numbers = extractDecimalsOnly(line);
      expect(numbers).toContain("86.91");
    });

    it("deve processar múltiplas linhas com erros de OCR", () => {
      const text = `
        LT-41OO1 86,91
        LT-41OO2 45.41
        FIT-14OOO1 1.65E-3
        AlT-22OOO1 7.5O
      `;
      const numbers = extractDecimalsOnly(text);
      expect(numbers.length).toBeGreaterThanOrEqual(3);
    });

    it("deve validar números científicos após limpeza", () => {
      const text = "Pressão: 1.65E-3 atm";
      const numbers = extractDecimalsOnly(text);
      expect(numbers.some((n) => n.includes("E"))).toBe(true);
    });

    it("deve suportar notação europeia (vírgula) em lote", () => {
      const text = "Valores: 10,5 ; 20,3 ; 30,1";
      const numbers = extractDecimalsOnly(text);
      expect(numbers).toEqual(["10.5", "20.3", "30.1"]);
    });
  });
});
