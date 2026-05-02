import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reparation } from '../models/reparation.model';
import { Marque } from '../models/marque.model';
import { Modele } from '../models/modele.model';
import { OcrResult } from '../models/ocr.model';
import { SearchResult } from '../models/search.model';
import { Stats } from '../models/stats.model';
import { TechnicienOption } from '../models/user.model';


@Injectable({ providedIn: 'root' })
export class ReparationService {
  private http = inject(HttpClient);
  private api = '/api';  // proxy vers Flask

  scanFiche(image: File): Observable<OcrResult> {
    const form = new FormData();
    form.append('image', image);
    return this.http.post<OcrResult>(`${this.api}/scan`, form);
  }

  enregistrer(data: Reparation): Observable<Reparation> {
    return this.http.post<Reparation>(`${this.api}/reparations`, data);
  }

  historique(numeroSerie: string): Observable<Reparation[]> {
    return this.http.get<Reparation[]>(
      `${this.api}/machines/serie/${numeroSerie.toUpperCase()}`
    );
  }

  detail(id: number): Observable<Reparation> {
    return this.http.get<Reparation>(`${this.api}/reparations/${id}`);
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/reparations/${id}`);
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.api}/stats`);
  }

  search(query: string): Observable<SearchResult> {
    return this.http.get<SearchResult>(`${this.api}/machines/serie/${encodeURIComponent(query)}`);
  }


  public getTechniciens(): Observable<TechnicienOption[]> {
    return this.http.get<TechnicienOption[]>(`${this.api}/techniciens`);
  }

  public getMarques(): Observable<Marque[]> {
    return this.http.get<Marque[]>(`${this.api}/marques`);
  }

  public getMesReparations(): Observable<Reparation[]> {
    return this.http.get<Reparation[]>(`${this.api}/reparations/mine`);
  }

  public getModeles(): Observable<Modele[]> {
    return this.http.get<Modele[]>(`${this.api}/modeles`);
  }
}