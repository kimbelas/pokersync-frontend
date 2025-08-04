import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/lobby',
    pathMatch: 'full'
  },
  {
    path: 'lobby',
    loadComponent: () => import('./features/lobby/components/lobby/lobby.component').then(c => c.LobbyComponent)
  },
  {
    path: 'voting',
    loadComponent: () => import('./features/voting/components/voting-board/voting-board.component').then(c => c.VotingBoardComponent)
  },
  {
    path: 'results',
    loadComponent: () => import('./features/results/components/results/results.component').then(c => c.ResultsComponent)
  },
  {
    path: '**',
    redirectTo: '/lobby'
  }
];
