export interface PieceChangee {
  id?: number;
  ref_piece: string;
  designation: string;
  quantite: number;
  is_new?:     boolean;
}

export interface Reparation {
  id?: number;
  numero_serie: string;
  machine_type: string;
  technicien?: string;
  date_reparation: string;   // format JJ/MM/AAAA
  notes?: string;
  created_at?: string;
  pieces?: PieceChangee[];
}

export interface OcrResult {
  is_new_machine: boolean;
  numero_serie: string;
  date: string;
  nb_pieces: number;
  technicien: string;
  machine_type: string;
  pieces: PieceChangee[];
  texte_brut: string;
}

export interface Stats {
  total_reparations: number;
  machines_uniques: number;
  total_pieces: number;
  pieces_les_plus_changees: {
    ref: string;
    designation: string;
    total: number;
  }[];
  reparations: Reparation[]; 
}

export interface MachineTypeRef {
  id:           number;
  marque:       string;
  modele:       string;
  type_machine: string;
  url_logo?:    string;
  label:        string;   // calculé par le back : "MOULIN A CAFE SANTOS 40AN"
}

export interface BrandGroup {
  brand: string;
  machines: MachineTypeRef[];
  expanded: boolean;
}

export interface PieceRef {
  id:          number;
  ref_piece:   string;
  designation: string;
}

export interface ExplodedView {
  label: string;
  pdf_url: string;
  note: string | null;
}

export interface MachineInfo {
  description: string | null;
  specs: Record<string, string> | null;
  exploded_view: ExplodedView | null;
}

export interface SearchResult {
  query: string;
  found: boolean;
  numero_serie: string;
  machine_type: string;
  nombre_reparations: number;
  reparations: Reparation[];
  machine_info: MachineInfo | null;
}