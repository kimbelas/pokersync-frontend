import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-viewport-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewport-container" [class]="layoutClass">
      <ng-content></ng-content>
    </div>
  `,
  styles: `
    .viewport-container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .two-section {
      display: grid;
      grid-template-rows: 1fr 1fr;
      height: 100vh;
      overflow: hidden;
    }

    @media (min-width: 1024px) {
      .two-section {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr;
      }
    }

    .centered {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .split-horizontal {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-6);
    }

    .split-vertical {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: var(--space-6);
    }
  `
})
export class ViewportLayoutComponent {
  @Input() layoutClass: string = '';
}