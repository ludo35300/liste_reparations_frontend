import { Marque } from './marque.model';

export interface Modele {
  id: number;
  nom: string;
  type_machine: string;
  marque_id: number;
  marque?: Marque;
  label: string;
}

export interface BrandGroup {
  marque: Marque;
  modeles: Modele[];
  expanded: boolean;
}