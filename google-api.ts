
// google-api.ts

declare global {
  interface Window {
    google: any;
  }
}

// Client ID configurado para Al Capone Burger
const GOOGLE_CLIENT_ID = "674861580660-99u44jba673iu2eunu3m1q4ipsgp4jot.apps.googleusercontent.com";

export const loadGoogleScript = (callback: () => void) => {
  const existingScript = document.getElementById('google-client-script');
  if (existingScript) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.id = 'google-client-script';
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.body.appendChild(script);
};

export const initializeGoogleAuth = (callback: (response: any) => void) => {
  if (window.google) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: callback,
    });
  }
};

export const renderGoogleButton = (elementId: string) => {
  if (window.google) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        window.google.accounts.id.renderButton(
          element,
          { theme: 'filled_black', size: 'large', width: '100%', text: 'continue_with', shape: 'rectangular' }
        );
      } catch (e) {
        console.error("Erro ao renderizar botão Google.", e);
      }
    }
  }
};

export const decodeGoogleCredential = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Erro ao decodificar token Google", e);
    return null;
  }
};
