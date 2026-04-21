// ── Références catalogue ───────────────────────────────────────

export interface Marque {
  id: number;
  nom: string;
  url_logo?: string | null;
}

export interface Modele {
  id: number;
  nom: string;
  type_machine: string;
  marque_id: number;
  marque?: Marque;
  label: string;        // ex: "EXPRESSO DE'LONGHI MAGNIFICA"
}

export interface PieceRef {
  id: number;
  ref_piece: string;
  designation: string;
  marque_id: number;
}

// ── Machine physique (numéro de série) ─────────────────────────
export interface Machine {
  id: number;
  numero_serie: string;
  modele_id?: number | null;
  modele?: Modele | null;
  statut: 'en_attente' | 'en_reparation' | 'pret' | 'termine';
  date_entree?: string | null;
  notes?: string;
  created_at?: string;
}

// ── Réparation ─────────────────────────────────────────────────
export interface PieceChangee {
  id?: number;
  piece_ref_id?: number;
  ref_piece: string;
  designation: string;
  quantite: number;
  is_new?: boolean;
}

export interface Reparation {
  id?: number;
  machine_id: number;
  machine?: Machine;
  technicien?: string;
  technicien_id?: number;
  date_reparation: string;
  description?: string;
  created_at?: string;
  pieces: PieceChangee[];
}

// ── OCR ────────────────────────────────────────────────────────
export interface OcrResult {
  technicien:     string;
  date:           string;
  numero_serie:   string;
  machine_type:   string;
  is_new_machine: boolean;
  pieces:         PieceChangee[];
  nb_pieces_total: number;
  erreur?:        string;
}

// ── Stats ──────────────────────────────────────────────────────
export interface Stats {
  total_reparations: number;
  total_pieces:      number;
  machines_uniques:  number;
  pieces_les_plus_changees: { ref: string; designation: string; total: number }[];
  reparations: any[];
}

// ── Vue groupée par marque (pour la page Machines) ─────────────
export interface BrandGroup {
  marque: Marque;
  modeles: Modele[];
  expanded: boolean;
}

// ── Compat (à supprimer quand tous les composants sont migrés) ──
/** @deprecated Utiliser Modele */
export type MachineTypeRef = Modele & { marque: string; modele: string; type_machine: string; label: string };
/** @deprecated Utiliser BrandGroup */
export interface BrandGroupLegacy { brand: string; machines: MachineTypeRef[]; expanded: boolean; }