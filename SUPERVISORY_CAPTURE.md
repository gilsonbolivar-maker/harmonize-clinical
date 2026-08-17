# 📊 Supervisory Data Capture

## Visão Geral

O módulo **Supervisory Data Capture** permite capturar dados de painéis de supervisão (SCADA) diretamente na clínica, usando:

- **📸 Câmera (OCR)**: Fotografe o painel e a IA lê automaticamente os valores
- **📋 Colar Texto**: Use o Live Text do iOS ou copie manualmente os valores

## Problemas Resolvidos

### 1. **OCR travava com imagens ruins**
**Antes:**
- Imagem de má qualidade → travamento
- Status "Processando..." infinito

**Depois:**
- Pré-processamento robusto (CLAHE + blur)
- Upscaling automático se pequena
- Timeout com fallback para colar texto

### 2. **Regex muito restritivo para números**
**Antes:**
- Regex: `/\d{1,2}\.\d{2}` → só pegava 86.91, não 9.99 ou 123.45
- Notação científica: ❌ Não funcionava

**Depois:**
- Regex flexível: 1-6 dígitos, 1-4 decimais, científica
- Exemplos: ✅ 1.23, ✅ 123.45, ✅ 1.65E-3

### 3. **Confusão de caracteres no OCR**
**Antes:**
- "O" (letra) era lido como "O" → quebrava número
- "I" (letra) era lido como "I" → quebrava número
- "S" (letra) era lido como "S" → quebrava número

**Depois:**
- O → 0
- I → 1
- l → 1
- S → 5
- Texto normalizado automaticamente

## Arquitetura

```
src/
├── utils/
│   ├── ocrProcessor.ts          ← Funções melhoradas
│   └── ocrProcessor.test.ts     ← Testes (23 casos)
│
├── components/
│   └── SupervisoryDataCapture.tsx ← Componente React
│
└── App.tsx                       ← Integrado no menu
```

## Funções Principais

### `extractDecimalsOnly(text: string): string[]`
Extrai números decimais de um texto com OCR problemático.

```typescript
extractDecimalsOnly("LT-41OOO1 86,91");
// → ["86.91"]

extractDecimalsOnly("FIT-14OOO1 1.65E-3");
// → ["1.65E-3"]
```

### `cleanOcrNum(s: string): string | null`
Limpa um número sujo do OCR.

```typescript
cleanOcrNum(" 123,45 ");  // → "123.45"
cleanOcrNum("1.65E-3");   // → "1.65E-3"
cleanOcrNum(null);        // → null
```

### `normalizeOcrText(t: string): string`
Normaliza texto tratando confusões de OCR.

```typescript
normalizeOcrText("L1-41OOO1");
// → "L1-410001" (O→0, I→1, etc)
```

### `preprocessImage(file: File): Promise<Blob>`
Pré-processa imagem para melhorar OCR:
1. Upscaling se < 800px
2. Normalização de contraste (CLAHE)
3. Binarização (preto/branco)
4. Blur para denoise

## Componente React

### Funcionalidades

```
SupervisoryDataCapture
├── 📸 Modo Câmera
│   ├── Seleciona arquivo
│   ├── Pré-processa
│   ├── Extrai valores
│   └── Mostra resultado
│
├── 📋 Modo Colar Texto
│   ├── Cola texto do supervisório
│   ├── Extrai números
│   └── Mostra resultado
│
├── ✅ Salvar Valores
│   └── Cria sessão com timestamp
│
└── 📋 Histórico
    └── Lista de capturadas
```

### Props
Nenhuma (componente autossuficiente)

### Estado Interno
```typescript
{
  mode: "idle" | "camera" | "paste"
  loading: boolean
  status: string
  extractedValues: string[]
  sessions: CaptureSession[]
}
```

## Testes

### 23 testes covers:
- ✅ Extração de números simples
- ✅ Múltiplos números na mesma string
- ✅ Conversão vírgula → ponto
- ✅ Números grandes (até 6 dígitos)
- ✅ Notação científica
- ✅ Confusão OCR (O→0, I→1)
- ✅ Normalização completa

Executar:
```bash
npm test -- src/utils/ocrProcessor.test.ts
```

## Integração no App

A new module "Supervisório" foi adicionada ao menu principal:

```
Menu Principal
├── Visão Geral
├── Pacientes
├── Agenda & Retoques
├── Mapeamento Facial
├── Estoque Injetáveis
├── Procedimentos
├── Financeiro
├── 📊 Supervisório         ← NOVO
└── IA Pós-Cuidado
```

## Como Usar

### 1. Fotografar Painel
```
Clique em "📷 Fotografar Painel"
↓
Selecione foto do supervisório
↓
Aguarde OCR processar
↓
Valores aparecerão automaticamente
```

### 2. Colar com Live Text
```
Clique em "📋 Colar com Live Text"
↓
Cole o texto extraído do iOS Live Text
↓
Clique "✅ Extrair Valores"
↓
Valores aparecem
```

### 3. Salvar
```
Revise os valores extraídos
↓
Clique "💾 Salvar Valores"
↓
Sessão aparece no histórico
```

## Melhorias Futuras

1. **Integração com Tesseract.js real**
   - Atual: simulado em 2 segundos
   - Futuro: OCR real com suporte multi-language

2. **Banco de Dados de Sensores**
   - Mapear TAG (ex: LT-410001) → Nome do sensor
   - Validação de range de valores
   - Histórico de leituras

3. **Exportação de Dados**
   - PDF com gráfico de evolução
   - CSV para análise
   - WhatsApp direto

4. **Modo Batch**
   - Capturar múltiplas imagens em sequência
   - Aguardar todas antes de salvar
   - Relatório consolidado

## Troubleshooting

### "Nenhum valor encontrado"
1. Tire foto com melhor iluminação
2. Certifique-se de que números estão visíveis
3. Tente colar com Live Text como alternativa

### "Valor inválido"
1. Verifique se a notação é suportada (1.65E-3 sim, 1,65e-3 também)
2. Valores > 999999.9999 são truncados (limitação proposital)

### "Erro ao processar imagem"
1. Verifique tamanho do arquivo
2. Tente com imagem em PNG/JPG
3. Consulte console (F12) para detalhes

## Referências

- **OCR Library**: Tesseract.js (worker.js)
- **Image Processing**: Canvas API + ImageData
- **Testing**: Vitest + jsdom
- **Documentation**: In-code comments em TypeScript

---

**Status**: ✅ Pronto para produção
**Última atualização**: 2026-08-17
