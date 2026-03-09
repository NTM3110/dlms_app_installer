import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterConfigDialog } from './meter-config-dialog';

describe('MeterConfigDialog', () => {
  let component: MeterConfigDialog;
  let fixture: ComponentFixture<MeterConfigDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterConfigDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterConfigDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
