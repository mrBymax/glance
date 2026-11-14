import { createRoot } from 'react-dom/client';
import { App as UITApp } from '@wearables-ui-toolkit/mrbd';
import { HudPage } from './HudPage';
import './app.css';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the ID root.');

createRoot(root).render(
  <UITApp>
    <HudPage />
  </UITApp>,
);
