import { TestBed } from '@angular/core/testing';

import { TechniciensService } from './techniciens.service';

describe('TechniciensService', () => {
  let service: TechniciensService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TechniciensService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
