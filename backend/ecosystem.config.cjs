module.exports = {
  apps: [
    {
      name: "boulangerie-backend",

      // Dossier de travail
      cwd: "/var/www/boulangerie_codex/backend",

      // Point d'entrée Node
      script: "/var/www/boulangerie_codex/backend/src/main.js",

      interpreter: "node",

      env: {
        NODE_ENV: "production",

        // CORS – domaines autorisés
      CORS_ORIGIN: "https://boulangerie.lambert-gestion.fr,https://www.boulangerie.lambert-gestion.fr,https://lambert-gestion.fr,https://www.lambert-gestion.fr",
      },
    },
  ],
};
