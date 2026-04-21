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
  label: string;
}

export interface PieceRef {
  id: number;
  ref_piece: string;
  designation: string;
  marque_id?: number;
}

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
  machine_id?: number;
  machine?: Machine;
  // Snapshots retournés par l'API historique
  machine_snapshot?: string;
  technicien_snapshot?: string;
  // Champs formulaire/OCR
  numero_serie?: string;
  machine_type?: string;
  notes?: string;
  // Communs
  technicien?: string;
  technicien_id?: number;
  date_reparation: string;
  description?: string;
  created_at?: string;
  pieces: PieceChangee[];
}

export interface OcrResult {
  technicien:      string;
  date:            string;
  numero_serie:    string;
  machine_type:    string;
  is_new_machine:  boolean;
  pieces:          PieceChangee[];
  nb_pieces_total: number;
  erreur?:         string;
}

export interface Stats {
  total_reparations: number;
  total_pieces:      number;
  machines_uniques:  number;
  pieces_les_plus_changees: { ref: string; designation: string; total: number }[];
  reparations: Reparation[];
}

export interface ExplodedView {
  label:      string;
  pdf_url:    string;
  image_url?: string;  // ← ajouté
  note?:      string;
}

export interface SearchResult {
  found:              boolean;
  numero_serie:       string;
  machine_type?:      string;
  nombre_reparations: number;
  reparations:        Reparation[];
  machine_info?: {
    brand:        string;
    model:        string;
    description?: string;
    specs:        Record<string, string>;
    exploded_view?: ExplodedView | null;  // ← utilise l'interface
  };
}

export interface BrandGroup {
  marque: Marque;
  modeles: Modele[];
  expanded: boolean;
}

/** @deprecated Utiliser Modele */
export type MachineTypeRef = Modele & {
  marque: string; modele: string; type_machine: string; label: string;
};