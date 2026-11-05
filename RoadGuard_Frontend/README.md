# RoadGuard frontend

Local dashboard for the RoadGuard_Backend FastAPI ZIP. No Node, npm, React build,
or retraining is required. This is the website UI, not Swagger.

## Windows: start it

1. Keep FastAPI running at http://127.0.0.1:8000 in its existing terminal.
2. Extract the frontend ZIP and open the folder containing `index.html`.
3. Double-click `start_frontend.bat` (Python must be on PATH), or open a NEW
   Command Prompt in that folder and run:

```bat
python -m http.server 5173 --bind 127.0.0.1
```

4. Open http://127.0.0.1:5173 in your browser. Keep both terminal windows open.
   Do not double-click index.html: ES modules need HTTP serving.
5. The top-right status should show Backend connected. If it does not, open
   Connection and check the API URL. Default is http://127.0.0.1:8000.

The backend already permits frontend port 5173 on localhost/127.0.0.1. If you use
another origin, update backend CORS_ORIGINS in .env and restart FastAPI. If port
5173 is busy, stop its previous server or select another port AND update CORS.

## Features

- Overview: live counts from SQLite and recent reports (no seeded/fake data).
- Detect potholes: upload JPEG/PNG, adjust confidence, draw YOLO bounding boxes,
  review predictions, attach supplied coordinates and create a report.
- Hazard reports: manual reports, pagination, status filter, confirmation and
  resolution with a verification note.
- Nearby alerts: supplied/device location and radius, showing confirmed reports
  sorted by straight-line distance. Refresh is manual; there is no live push.
- Connection: configurable API base URL and optional session-memory API key.

Image pixels never establish GPS coordinates. Browser location is only the
observation point and can be inaccurate. Confirm/resolve requires human evidence.
The UI does not auto-clear a pothole on missed detection. An empty nearby result
is not proof that the road is safe. This is a research prototype.

## Files

`index.html`: pages, forms and navigation
`styles.css`: responsive layout and styling
`app.js`: UI and workflow logic
`api.js`: backend requests, authentication header, error handling and timeouts
`start_frontend.bat`: local server launcher
`tests/api.test.mjs`: API-client contract tests (optional Node 18+)

Google Fonts is optional; offline operation falls back to system fonts. No image
assets or map APIs need an external service. API base URL is stored in localStorage;
API key is held only in memory and cleared on reload. Do not ship a shared private
API key inside a public frontend. This local UI has no user accounts or roles.

## Integration

You can use `api.js` separately in another frontend:

```js
import { RoadGuardAPI } from './api.js';
const api = new RoadGuardAPI('http://127.0.0.1:8000');
const reports = await api.list('confirmed', 20, 0);
```

This is designed to run on the SAME laptop as FastAPI. For other devices, use the
laptop LAN address, configure backend binding/CORS/auth appropriately. A publicly
hosted HTTPS frontend needs a reachable HTTPS backend; localhost URLs do not point
to your laptop from other people's computers.

## First end-to-end check

1. Add a manual report at demo coordinates 16.5, 80.5, clearly described as a demo.
2. Confirm it with a demo verification note.
3. Check nearby alerts at the same coordinates with radius 100 metres.
4. Resolve it with a demo note and check again: it should be excluded.
5. Upload a real image under Detect potholes to test your GPU model integration.

Keep demo reports clearly marked. This UI does not delete records.

## Optional API client tests

With Node 18+ installed, run `node --test tests/api.test.mjs`.
See TEST_RESULTS.md for verification scope and limits.
