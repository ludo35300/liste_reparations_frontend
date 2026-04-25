import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Machine, Marque, Modele, Reparation } from '../models/reparation.model';

export interface CreateMachinePayload {
  numero_serie: string;
  modele_id: number;
  statut: Machine['statut'];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  public getMarques(): Observable<Marque[]> {
    return this.http.get<Marque[]>(`${this.apiUrl}/marques`);
  }

  public getModeles(): Observable<Modele[]> {
    return this.http.get<Modele[]>(`${this.apiUrl}/modeles`);
  }

  public getByNumeroSerie(numeroSerie: string): Observable<Machine> {
    return this.http.get<Machine>(
      `${this.apiUrl}/machines/serie/${encodeURIComponent(numeroSerie)}`
    );
  }

  public create(payload: CreateMachinePayload): Observable<Machine> {
    return this.http.post<Machine>(`${this.apiUrl}/machines`, payload);
  }

  public getHistory(machineId: number): Observable<Reparation[]> {
    return this.http.get<Reparation[]>(`${this.apiUrl}/machines/${machineId}/reparations`);
  }
}