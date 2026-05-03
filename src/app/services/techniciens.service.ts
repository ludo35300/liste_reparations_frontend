import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TechnicienOption } from '../models/user.model';



@Injectable({ providedIn: 'root' })
export class TechnicienService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  public getAll(): Observable<TechnicienOption[]> {
    return this.http.get<TechnicienOption[]>(`${this.apiUrl}/techniciens`);
  }
}