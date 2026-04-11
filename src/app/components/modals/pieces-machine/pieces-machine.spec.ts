import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PiecesMachine } from './pieces-machine';

describe('PiecesMachine', () => {
  let component: PiecesMachine;
  let fixture: ComponentFixture<PiecesMachine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PiecesMachine]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PiecesMachine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
