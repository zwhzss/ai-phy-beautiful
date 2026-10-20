import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MathFormulaComponent } from '../../../../shared/components/math-formula/math-formula.component';

export interface Formula {
  label: string;
  latex: string;
}

@Component({
  selector: 'formula-panel',
  standalone: true,
  imports: [NgFor, NgIf, MathFormulaComponent],
  template: `
    <div class="formula-panel" *ngIf="formulas && formulas.length > 0">
      <h3>核心公式</h3>
      <div *ngFor="let formula of formulas" class="formula-item">
        <span class="formula-label">{{ formula.label }}</span>
        <math-formula [latex]="formula.latex"></math-formula>
      </div>
    </div>
  `,
  styles: [`
    .formula-panel { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .formula-panel h3 { margin-bottom: 1rem; font-size: 1rem; color: #2d3748; }
    .formula-item { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; }
    .formula-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .formula-label { font-size: 0.8rem; color: #718096; display: block; margin-bottom: 0.25rem; }
  `]
})
export class FormulaPanelComponent {
  @Input() formulas: Formula[] = [];
}
