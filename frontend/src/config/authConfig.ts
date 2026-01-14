import { Configuration, LogLevel } from '@azure/msal-browser';

// Configuración de Azure AD
export const msalConfig: Configuration = {
  auth: {
    clientId: 'daea675f-7f41-4027-b0cc-7b9b00b101e5', // Application (client) ID
    authority: 'https://login.microsoftonline.com/da47f97f-944c-4b0e-9dde-e799eced5c82', // Tenant ID
    redirectUri: 'http://localhost:5173/auth/callback',
    postLogoutRedirectUri: 'http://localhost:5173/',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

// Scopes para la API de Microsoft Graph (para obtener info del usuario)
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

// Scopes para la API del backend
export const apiRequest = {
  scopes: [`api://${msalConfig.auth.clientId}/access_as_user`],
};
