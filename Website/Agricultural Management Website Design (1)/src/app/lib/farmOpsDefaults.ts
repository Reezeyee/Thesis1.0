import type {
  CoffeeFieldRecord,
  IrrigationSystemRecord,
  PestControlRecord,
} from '../types/appState';

export function newFarmEntityId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyCoffeeField(): CoffeeFieldRecord {
  return {
    fieldId: newFarmEntityId(),
    name: '',
    area: '',
    trees: 0,
    status: 'healthy',
    variety: 'Robusta',
    age: '',
    nextHarvest: '',
    productivity: 75,
    lat: 14.5394408,
    lng: 120.5763727,
  };
}

export function emptyIrrigationSystem(): IrrigationSystemRecord {
  return {
    irrigationId: newFarmEntityId(),
    zone: '',
    type: 'Drip',
    status: 'active',
    coverage: '',
    efficiency: 85,
    lastMaintenance: '',
  };
}

export function emptyPestControlLog(): PestControlRecord {
  return {
    pestControlId: newFarmEntityId(),
    date: new Date().toISOString().slice(0, 10),
    field: '',
    issue: '',
    treatment: 'Standard monitoring',
    status: 'Pending',
    treeNumber: '',
    photoUrl: '',
  };
}
