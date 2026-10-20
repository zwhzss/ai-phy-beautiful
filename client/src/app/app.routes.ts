import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'experiment/:slug',
    loadComponent: () => import('./features/experiments/experiment-detail/experiment-detail.component').then(m => m.ExperimentDetailComponent),
  },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress.component').then(m => m.ProgressComponent),
  },
  {
    path: 'bookmarks',
    loadComponent: () => import('./features/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
  },
  {
    path: 'scale',
    loadComponent: () => import('./features/scale/scale.component').then(m => m.ScaleComponent),
  },
  {
    path: 'milestones',
    loadComponent: () => import('./features/milestones/milestone-timeline.component').then(m => m.MilestoneTimelineComponent),
  },
  {
    path: 'milestones/:slug',
    loadComponent: () => import('./features/milestones/milestone-detail.component').then(m => m.MilestoneDetailComponent),
  },
  {
    path: 'figures',
    loadComponent: () => import('./features/figures/figures.component').then(m => m.FiguresComponent),
  },
  {
    path: 'figures/:slug',
    loadComponent: () => import('./features/figures/figure-detail.component').then(m => m.FigureDetailComponent),
  },
  {
    path: 'library',
    loadComponent: () => import('./features/assets/assets.component').then(m => m.AssetsComponent),
  },
  {
    path: 'models',
    loadComponent: () =>
      import('./features/models/models.component').then((m) => m.ModelsComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
  },
  {
    path: 'review',
    loadComponent: () => import('./features/admin/review-workbench.component').then(m => m.ReviewWorkbenchComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
