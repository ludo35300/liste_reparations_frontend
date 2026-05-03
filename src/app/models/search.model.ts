import { Machine } from './machine.model';
import { Reparation } from './reparation.model';

export interface ExplodedView {
  label:      string;
  pdf_url:    string;
  image_url?: string;
  note?:      string;
}

export interface SearchResult {
  found:              boolean;
  numero_serie:       string;
  machine_type?:      string;
  nombre_reparations: number;
  reparations:        Reparation[];
  machine?:           Machine;
  machine_info?: {
    brand:        string;
    model:        string;
    description?: string;
    specs:        Record<string, string>;
    exploded_view?: ExplodedView | null;
  };
}
