// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  Appointment,
  FaceMapPoint,
  FinancialTransaction,
  InventoryItem,
  Patient,
  ProcedureCatalogItem,
} from '../types';
import {
  BACKUP_VERSION,
  backupFileName,
  buildBackupFile,
  downloadBackup,
  mergeBackup,
  parseBackup,
  summarizeBackup,
  type BackupPayload,
} from './backup';

/**
 * Testes do backup do prontuário.
 *
 * Este módulo é o último recurso do usuário: se ele falhar, o histórico
 * clínico some junto com o localStorage. Os testes abaixo cobrem o caminho
 * completo (exportar → reimportar) e cada recusa de arquivo inválido.
 */

// --------------------------------------------------------------- fixtures ---

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'p1',
    name: 'Maria Silva',
    cpf: '000.000.000-00',
    phone: '(11) 90000-0000',
    email: 'maria@exemplo.com',
    birthDate: '1990-05-20',
    gender: 'Feminino',
    tag: 'novo',
    createdAt: '2026-01-10',
    consentSigned: true,
    anamnesis: {
      skinType: 'Normal',
      fitzpatrick: 'III',
      allergies: [],
      medicationsInUse: [],
      chronicDiseases: [],
      pregnantOrLactating: false,
      priorTreatments: [],
      herpesHistory: false,
      keloidTendency: false,
      smoker: false,
      alcoholFrequency: 'Nunca',
      sunExposure: 'Moderada',
      waterIntakeLitersPerDay: 2,
      mainConcerns: [],
      aestheticGoals: '',
    },
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    patientId: 'p1',
    patientName: 'Maria Silva',
    patientPhone: '(11) 90000-0000',
    professionalId: 'prof1',
    professionalName: 'Dra. Ana',
    procedureIds: ['proc1'],
    procedureNames: ['Botox'],
    date: '2026-02-01',
    time: '14:00',
    durationMinutes: 60,
    status: 'agendado',
    totalPrice: 1200,
    paymentStatus: 'pendente',
    ...overrides,
  };
}

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i1',
    name: 'Toxina Botulínica',
    brand: 'Marca X',
    category: 'toxina',
    currentStock: 5,
    minStock: 2,
    unit: 'frascos',
    costPerUnit: 800,
    sellPriceSuggested: 1600,
    lotNumber: 'L-001',
    expirationDate: '2027-01-01',
    ...overrides,
  };
}

function makeProcedure(overrides: Partial<ProcedureCatalogItem> = {}): ProcedureCatalogItem {
  return {
    id: 'proc1',
    name: 'Aplicação de Botox',
    category: 'botox',
    defaultPrice: 1200,
    costPrice: 400,
    durationMinutes: 60,
    recommendedRetouchDays: 15,
    description: 'Aplicação em terço superior.',
    defaultDoseUnit: 'U',
    defaultDoseAmount: 20,
    suggestedProducts: [],
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<FinancialTransaction> = {}): FinancialTransaction {
  return {
    id: 't1',
    type: 'receita',
    category: 'Procedimento',
    description: 'Botox — Maria Silva',
    amount: 1200,
    date: '2026-02-01',
    paymentMethod: 'pix',
    status: 'pago',
    ...overrides,
  };
}

function makeFaceMapPoint(overrides: Partial<FaceMapPoint> = {}): FaceMapPoint {
  return {
    id: 'fp1',
    zone: 'glabela',
    label: 'Glabela',
    x: 50,
    y: 30,
    productType: 'botox',
    productName: 'Toxina Botulínica',
    doseValue: 20,
    doseUnit: 'U',
    depth: 'muscular',
    tool: 'agulha_30g',
    lotNumber: 'L-001',
    ...overrides,
  };
}

/** Backup completo, com um registro de cada tipo. */
function makePayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    patients: [makePatient()],
    appointments: [makeAppointment()],
    inventory: [makeInventoryItem()],
    procedures: [makeProcedure()],
    transactions: [makeTransaction()],
    faceMaps: { p1: [makeFaceMapPoint()] },
    ...overrides,
  };
}

/** Backup sem nenhum registro — `parseBackup` recusa arquivos assim. */
const EMPTY_PAYLOAD: BackupPayload = {
  patients: [],
  appointments: [],
  inventory: [],
  procedures: [],
  transactions: [],
  faceMaps: {},
};

// ------------------------------------------------------- summarizeBackup ----

describe('summarizeBackup', () => {
  it('conta os registros de cada coleção', () => {
    const payload = makePayload({
      patients: [makePatient({ id: 'p1' }), makePatient({ id: 'p2' })],
      transactions: [],
    });

    expect(summarizeBackup(payload)).toEqual({
      patients: 2,
      appointments: 1,
      inventory: 1,
      procedures: 1,
      transactions: 0,
      faceMapPoints: 1,
    });
  });

  it('soma os pontos de mapa facial de todos os pacientes', () => {
    const payload = makePayload({
      faceMaps: {
        p1: [makeFaceMapPoint({ id: 'fp1' }), makeFaceMapPoint({ id: 'fp2' })],
        p2: [makeFaceMapPoint({ id: 'fp3' })],
      },
    });

    expect(summarizeBackup(payload).faceMapPoints).toBe(3);
  });

  it('devolve zeros para um backup vazio', () => {
    expect(summarizeBackup(EMPTY_PAYLOAD)).toEqual({
      patients: 0,
      appointments: 0,
      inventory: 0,
      procedures: 0,
      transactions: 0,
      faceMapPoints: 0,
    });
  });
});

// -------------------------------------------- buildBackupFile / fileName ----

describe('buildBackupFile', () => {
  it('carimba aplicativo, versão e data de exportação', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));

    const file = buildBackupFile(makePayload());

    expect(file.app).toBe('harmonize-clinical');
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.exportedAt).toBe('2026-03-10T12:00:00.000Z');

    vi.useRealTimers();
  });

  it('mantém os dados do prontuário intactos', () => {
    const payload = makePayload();
    const file = buildBackupFile(payload);

    expect(file.patients).toEqual(payload.patients);
    expect(file.appointments).toEqual(payload.appointments);
    expect(file.inventory).toEqual(payload.inventory);
    expect(file.procedures).toEqual(payload.procedures);
    expect(file.transactions).toEqual(payload.transactions);
    expect(file.faceMaps).toEqual(payload.faceMaps);
  });
});

describe('backupFileName', () => {
  it('usa a data local para os arquivos ficarem ordenáveis por nome', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));

    expect(backupFileName()).toBe('harmonize-backup-2026-03-10.json');

    vi.useRealTimers();
  });
});

// ------------------------------------------------------------ parseBackup ---

describe('parseBackup', () => {
  it('reimporta exatamente o que foi exportado (ida e volta)', () => {
    const original = makePayload({
      patients: [makePatient({ id: 'p1' }), makePatient({ id: 'p2', name: 'João Souza' })],
      faceMaps: {
        p1: [makeFaceMapPoint({ id: 'fp1' })],
        p2: [makeFaceMapPoint({ id: 'fp2', zone: 'malar' })],
      },
    });

    const json = JSON.stringify(buildBackupFile(original), null, 2);

    expect(parseBackup(json)).toEqual(original);
  });

  it('recusa um arquivo que não é JSON', () => {
    expect(() => parseBackup('isto não é json')).toThrow('O arquivo não é um JSON válido.');
  });

  it.each([
    ['null', 'null'],
    ['string', '"texto"'],
    ['número', '42'],
  ])('recusa um JSON que não é objeto (%s)', (_rotulo, json) => {
    expect(() => parseBackup(json)).toThrow('O arquivo não contém um backup válido.');
  });

  it('recusa backup de outro aplicativo', () => {
    const json = JSON.stringify({ ...makePayload(), app: 'outro-app' });

    expect(() => parseBackup(json)).toThrow('Este backup pertence a outro aplicativo.');
  });

  it('recusa backup gerado por uma versão mais nova do app', () => {
    const json = JSON.stringify({ ...buildBackupFile(makePayload()), version: BACKUP_VERSION + 1 });

    expect(() => parseBackup(json)).toThrow(/versão mais nova do app/);
  });

  it('aceita backup da versão atual', () => {
    const json = JSON.stringify(buildBackupFile(makePayload()));

    expect(() => parseBackup(json)).not.toThrow();
  });

  it('aceita arquivo sem os campos app e version', () => {
    // Leniência proposital: arquivos editados à mão continuam restauráveis.
    const json = JSON.stringify({ patients: [makePatient()] });

    expect(parseBackup(json).patients).toHaveLength(1);
  });

  it('substitui coleções ausentes por listas vazias', () => {
    const json = JSON.stringify({ app: 'harmonize-clinical', patients: [makePatient()] });

    const payload = parseBackup(json);

    expect(payload.appointments).toEqual([]);
    expect(payload.inventory).toEqual([]);
    expect(payload.procedures).toEqual([]);
    expect(payload.transactions).toEqual([]);
    expect(payload.faceMaps).toEqual({});
  });

  it('descarta coleções com o tipo errado em vez de quebrar', () => {
    const json = JSON.stringify({ patients: [makePatient()], appointments: 'não é lista' });

    expect(parseBackup(json).appointments).toEqual([]);
  });

  it('descarta mapas faciais que não são listas de pontos', () => {
    const json = JSON.stringify({
      patients: [makePatient()],
      faceMaps: { p1: [makeFaceMapPoint()], p2: 'corrompido' },
    });

    const { faceMaps } = parseBackup(json);

    expect(Object.keys(faceMaps)).toEqual(['p1']);
  });

  it('ignora faceMaps enviado como lista', () => {
    const json = JSON.stringify({ patients: [makePatient()], faceMaps: [] });

    expect(parseBackup(json).faceMaps).toEqual({});
  });

  it('recusa arquivo sem nenhum dado da clínica', () => {
    const json = JSON.stringify(buildBackupFile(EMPTY_PAYLOAD));

    expect(() => parseBackup(json)).toThrow('O arquivo não contém nenhum dado da clínica.');
  });

  it('aceita backup que só tem mapas faciais', () => {
    const json = JSON.stringify({ faceMaps: { p1: [makeFaceMapPoint()] } });

    expect(parseBackup(json).faceMaps.p1).toHaveLength(1);
  });
});

// ------------------------------------------------------------ mergeBackup ---

describe('mergeBackup', () => {
  it('acrescenta registros que ainda não existem', () => {
    const current = makePayload({ patients: [makePatient({ id: 'p1' })] });
    const incoming = makePayload({ patients: [makePatient({ id: 'p2', name: 'João Souza' })] });

    const merged = mergeBackup(current, incoming);

    expect(merged.patients.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('mantém o registro atual quando o id colide', () => {
    // O merge nunca sobrescreve: o que está no app vence o que vem do arquivo.
    const current = makePayload({ patients: [makePatient({ id: 'p1', name: 'Nome atual' })] });
    const incoming = makePayload({ patients: [makePatient({ id: 'p1', name: 'Nome antigo' })] });

    const merged = mergeBackup(current, incoming);

    expect(merged.patients).toHaveLength(1);
    expect(merged.patients[0].name).toBe('Nome atual');
  });

  it('funde os pontos do mapa facial de um mesmo paciente', () => {
    const current = makePayload({ faceMaps: { p1: [makeFaceMapPoint({ id: 'fp1' })] } });
    const incoming = makePayload({ faceMaps: { p1: [makeFaceMapPoint({ id: 'fp2' })] } });

    const merged = mergeBackup(current, incoming);

    expect(merged.faceMaps.p1.map((pt) => pt.id)).toEqual(['fp1', 'fp2']);
  });

  it('traz o mapa facial de um paciente que ainda não tinha nenhum', () => {
    const current = makePayload({ faceMaps: {} });
    const incoming = makePayload({ faceMaps: { p2: [makeFaceMapPoint({ id: 'fp9' })] } });

    expect(mergeBackup(current, incoming).faceMaps.p2).toHaveLength(1);
  });

  it('ignora itens sem id utilizável', () => {
    const current = makePayload({ patients: [makePatient({ id: 'p1' })] });
    const incoming = makePayload({
      // Um arquivo corrompido pode trazer registros sem id.
      patients: [{ ...makePatient(), id: undefined as unknown as string }],
    });

    expect(mergeBackup(current, incoming).patients).toHaveLength(1);
  });

  it('não altera os objetos recebidos', () => {
    const current = makePayload({ patients: [makePatient({ id: 'p1' })] });
    const incoming = makePayload({ patients: [makePatient({ id: 'p2' })] });
    const currentAntes = structuredClone(current);
    const incomingAntes = structuredClone(incoming);

    mergeBackup(current, incoming);

    expect(current).toEqual(currentAntes);
    expect(incoming).toEqual(incomingAntes);
  });
});

// --------------------------------------------------------- downloadBackup ---

describe('downloadBackup', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom não implementa a Object URL API; o download tradicional depende dela.
    createObjectURL = vi.fn(() => 'blob:mock');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    vi.restoreAllMocks();
  });

  it('grava pelo seletor de arquivos quando o navegador oferece um', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    });
    Object.assign(window, { showSaveFilePicker });

    const resultado = await downloadBackup(makePayload());

    expect(resultado).toBe('saved');
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    // O conteúdo gravado precisa ser o backup completo, não só o payload.
    expect(JSON.parse(write.mock.calls[0][0] as string).app).toBe('harmonize-clinical');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('devolve "cancelled" quando o usuário fecha o seletor', async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('abortado', 'AbortError'));
    Object.assign(window, { showSaveFilePicker });

    expect(await downloadBackup(makePayload())).toBe('cancelled');
    // Cancelar não pode disparar o download tradicional por baixo.
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('cai no download tradicional se o seletor falhar por outro motivo', async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new Error('sem permissão'));
    Object.assign(window, { showSaveFilePicker });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(await downloadBackup(makePayload())).toBe('saved');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('usa o download tradicional quando não há seletor de arquivos', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    expect(await downloadBackup(makePayload())).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('não deixa o link temporário no documento', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadBackup(makePayload());

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
