import { StatutMachine } from "../models/statut.model";

export const STATUTS: { value: StatutMachine; label: string; couleur: string }[] = [
  { value: 'en_attente',    label: 'En attente',    couleur: 'badge-progress' },
  { value: 'en_reparation', label: 'En réparation', couleur: 'badge-warning' },
  { value: 'pret',          label: 'Prêt',          couleur: 'badge-ready' },
  { value: 'termine',       label: 'Terminé',       couleur: 'badge-ready' },
];

export const TYPES_ACTION = [
  { value: 'diagnostic',          label: '🔍 Diagnostic' },
  { value: 'demontage',           label: '🔧 Démontage' },
  { value: 'remplacement_piece',  label: '🔩 Remplacement pièce' },
  { value: 'nettoyage',           label: '🧹 Nettoyage' },
  { value: 'test',                label: '✅ Test' },
  { value: 'commentaire',         label: '💬 Commentaire' },
  { value: 'statut',              label: '🔄 Changement de statut' },
] as const;
