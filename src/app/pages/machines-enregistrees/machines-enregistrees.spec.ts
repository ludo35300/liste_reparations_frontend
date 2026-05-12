import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MachinesEnregistrees } from './machines-enregistrees';

describe('MachinesEnregistrees', () => {
  let component: MachinesEnregistrees;
  let fixture: ComponentFixture<MachinesEnregistrees>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MachinesEnregistrees]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MachinesEnregistrees);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
