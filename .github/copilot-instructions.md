# Copilot Instructions for AppChecklist

## Project Overview
This is a web application for managing checklists, likely for automotive or service workflows. The architecture is simple and file-based, with the main logic in `app.js`, UI in `index.html`, and styles in `styles.css`. Models and icons are organized in their respective folders.

## Key Components
- **app.js**: Main application logic, including UI event handling, data management, and integration with backend services.
- **index.html**: Defines the UI structure. All major UI changes should be reflected here.
- **models/**: Contains data models or helper scripts. Reference these for business logic or data structure patterns.
- **icons/**: Stores static assets for UI.

## Integration Patterns
- **File Uploads**: Uses `FormData` and `fetch` to POST files to external services (see example in `app.js`).
  ```js
  const form = new FormData();
  form.append('file', entradaFoto.files[0]);
  await fetch('http://oficina-service.acacessorios.local/oficina/uploads/avarias', {
    method: 'POST',
    body: form,
  });
  ```
- **External Services**: Communicates with endpoints under `*.acacessorios.local`. Always use async/await and handle errors gracefully.

## Developer Workflows
- **No build step**: Directly edit JS, HTML, and CSS files. Changes are reflected immediately.
- **Debugging**: Use browser DevTools for JS debugging. Console logs are common for tracing.
- **Testing**: No automated tests detected. Manual testing via browser is standard.
- **Docker**: A `Dockerfile` exists, likely for containerized deployment. Build with:
  ```powershell
  docker build -t appchecklist .
  docker run -p 8080:80 appchecklist
  ```

## Project Conventions
- **Single-file JS logic**: All main logic is in `app.js`. Keep related functions grouped and use clear comments.
- **Async operations**: Use async/await for all network requests.
- **Error handling**: Log errors to the console and provide user feedback in the UI.
- **Naming**: Use descriptive variable and function names reflecting their purpose.

## Examples
- **Checklist Item Handling**: Functions for adding, editing, and removing checklist items are in `app.js`.
- **Photo Uploads**: File input and upload logic is handled via FormData and fetch.

## Recommendations for AI Agents
- Always check `app.js` for main logic and patterns before making changes.
- Reference `index.html` for UI structure and ensure JS changes match the HTML.
- For new integrations, follow the fetch/FormData pattern for external service communication.
- Use clear, actionable comments for any new logic added.

---
If any section is unclear or missing, please provide feedback to improve these instructions.
