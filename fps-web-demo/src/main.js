import './style.css';
import { PrototypeApp } from './prototype/PrototypeApp.js';

const canvas = document.querySelector('#scene');

const app = new PrototypeApp({
  canvas,
});

window.__ZGCA_APP__ = app;

app.init().catch((error) => {
  console.error(error);
});
