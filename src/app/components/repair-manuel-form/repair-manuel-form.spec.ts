import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RepairManuelForm } from './repair-manuel-form';

describe('RepairManuelForm', () => {
  let component: RepairManuelForm;
  let fixture: ComponentFixture<RepairManuelForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepairManuelForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RepairManuelForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
