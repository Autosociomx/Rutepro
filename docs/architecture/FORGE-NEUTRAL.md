# ConnectX Negocio OS — estrategia forge-neutral

## Decisión

Git es el formato de control de versiones. GitHub deja de ser dependencia de plataforma.

### Forge primario
- GitLab.com Free para repositorio privado, merge requests y CI/CD.

### Despliegue
- Netlify para web/PWA y previews.
- El build es `npm run build:connectx` y no depende de GitHub Actions.

### Verificación local
- `npm ci`
- `npm run core:check`
- `npm run build:connectx`

La misma verificación debe funcionar en laptop, GitLab CI o cualquier runner compatible con Node 22.

## Migración desde GitHub

Mientras GitHub siga accesible como origen:

```bash
git clone --mirror https://github.com/Autosociomx/Rutepro.git
cd Rutepro.git
git push --mirror https://gitlab.com/<namespace>/<project>.git
```

Alternativamente GitLab puede importar un repositorio Git mediante su URL.

Después de verificar ramas y etiquetas en GitLab:

```bash
git remote rename origin github
git remote add origin https://gitlab.com/<namespace>/<project>.git
git fetch origin
```

No eliminar el remoto `github` hasta completar la verificación de integridad.

## Regla de portabilidad

Ningún módulo de negocio puede depender de APIs de GitHub, GitLab, Bitbucket o un forge específico.

El repositorio podrá trasladarse a:
- GitLab
- Bitbucket
- Forgejo/Gitea autogestionado
- cualquier servidor Git estándar

Los archivos de CI son adaptadores de infraestructura, no parte del dominio.

## Respaldo

En cada versión estable crear un `git bundle`:

```bash
git bundle create connectx-negocio-os.bundle --all
```

Ese único archivo contiene ramas y commits del repositorio Git y puede almacenarse en Drive, almacenamiento de objetos o disco externo.

Restauración:

```bash
git clone connectx-negocio-os.bundle connectx-negocio-os
```

## Política de IA

La disponibilidad de Gemini/OpenAI/u otro proveedor tampoco condiciona el funcionamiento operacional. IA es un adaptador opcional. Local, Rutas, Web, caja, cierre, sincronización y reglas deterministas deben funcionar sin claves de IA.
