import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRepairs } from './my-repairs';

describe('MyRepairs', () => {
  let component: MyRepairs;
  let fixture: ComponentFixture<MyRepairs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyRepairs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyRepairs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
