import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import IotaProvider from './lib/IotaProvider'

ReactDOM.render(
  <IotaProvider>
    <App />
  </IotaProvider>,
document.getElementById('root'));
