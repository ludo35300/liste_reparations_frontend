import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickSearch } from './quick-search';

describe('QuickSearch', () => {
  let component: QuickSearch;
  let fixture: ComponentFixture<QuickSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickSearch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuickSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
