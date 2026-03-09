import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterSerialConfig } from './meter-serial-config';

describe('MeterSerialConfig', () => {
  let component: MeterSerialConfig;
  let fixture: ComponentFixture<MeterSerialConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterSerialConfig],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterSerialConfig);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
