import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoReadSchedule } from './auto-read-schedule';

describe('AutoReadSchedule', () => {
  let component: AutoReadSchedule;
  let fixture: ComponentFixture<AutoReadSchedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoReadSchedule],
    }).compileComponents();

    fixture = TestBed.createComponent(AutoReadSchedule);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
