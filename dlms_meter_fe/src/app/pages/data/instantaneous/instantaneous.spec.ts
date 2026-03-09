import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Instantaneous } from './instantaneous';

describe('Instantaneous', () => {
  let component: Instantaneous;
  let fixture: ComponentFixture<Instantaneous>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Instantaneous],
    }).compileComponents();

    fixture = TestBed.createComponent(Instantaneous);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
