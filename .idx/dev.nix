
{ pkgs, ... }: {
  # El canal de Nixpkgs determina qué versiones de paquetes están disponibles.
  channel = "stable-23.11";

  # Lista de paquetes para instalar desde el canal especificado.
  packages = [
    pkgs.nodejs_20  # Entorno de ejecución de Node.js, versión 20.
  ];

  # Configuraciones específicas del editor IDX.
  idx = {
    # Lista de extensiones de VS Code para instalar desde el Open VSX Registry.
    extensions = [
      "dbaeumer.vscode-eslint"  # Linter para JavaScript y TypeScript.
      "esbenp.prettier-vscode"    # Formateador de código.
      "bradlc.vscode-tailwindcss" # Soporte para Tailwind CSS.
    ];

    # Comandos que se ejecutan en diferentes momentos del ciclo de vida del espacio de trabajo.
    workspace = {
      # Se ejecuta cuando el espacio de trabajo se crea por primera vez.
      onCreate = {
        install-deps = "npm install"; # Instala las dependencias del proyecto.
      };
      # Se ejecuta cada vez que el espacio de trabajo se inicia o reinicia.
      onStart = {
        run-dev-server = "npm run dev"; # Inicia el servidor de desarrollo.
      };
    };

    # Configura la vista previa de la aplicación web.
    previews = {
      enable = true;
      previews = {
        # Nombre de la vista previa (puedes tener varias).
        web = {
          # Comando para iniciar la aplicación en el puerto asignado por IDX.
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web"; # Tipo de vista previa.
        };
      };
    };
  };
}
