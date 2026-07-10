const VERIFICATION_COLORS = {
  confirmed: '#ff3b3b',
  probable: '#ff8c42',
  reported: '#ffd166',
  disputed: '#8892a4'
};

const START_DATE = new Date('2023-10-07');
const END_DATE = new Date();

let map, strikesData = [], statsData = {}, fullStrikes = [];
let timelineValue = 100;
let isPlaying = false;
let playInterval = null;
let threeScene, threeRenderer, threeCamera, strikeMeshes = [];

const GAZA_BOUNDS = [[34.205, 31.220], [34.565, 31.595]];

function siteBase() {
  const { pathname } = window.location;
  if (pathname.endsWith('/')) return pathname;
  const slash = pathname.lastIndexOf('/');
  return slash >= 0 ? `${pathname.slice(0, slash + 1)}` : '/';
}

function dataUrl(path) {
  return `${siteBase()}${path.replace(/^\//, '')}`;
}

async function fetchJson(path) {
  const response = await fetch(dataUrl(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  const [strikes, stats, buildings, hospitals, schools, camps, roads, damageZones, bufferZones, restrictedAreas, devastationOverlay, gazaBoundary] = await Promise.all([
    fetchJson('api/strikes.json'),
    fetchJson('api/statistics.json'),
    fetchJson('map/buildings.geojson'),
    fetchJson('map/hospitals.geojson'),
    fetchJson('map/schools.geojson'),
    fetchJson('map/refugee_camps.geojson'),
    fetchJson('map/roads.geojson'),
    fetchJson('map/damage_zones.geojson'),
    fetchJson('map/buffer_zones.geojson'),
    fetchJson('map/restricted_areas.geojson'),
    fetchJson('map/devastation_overlay.geojson'),
    fetchJson('map/gaza_boundary.geojson')
  ]);

  const strikeDetails = await Promise.all(
    strikes.slice(0, 8).map(s =>
      fetchJson(`data/strikes/${s.id}.json`).catch(() => s)
    )
  );

  // Load remaining strike details in background
  Promise.all(
    strikes.slice(8).map(s =>
      fetchJson(`data/strikes/${s.id}.json`).catch(() => s)
    )
  ).then(rest => {
    fullStrikes = [...strikeDetails, ...rest];
  });

  return { strikes, strikeDetails, stats, buildings, hospitals, schools, camps, roads, damageZones, bufferZones, restrictedAreas, devastationOverlay, gazaBoundary };
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function updateHeaderStats(stats) {
  const infra = stats.infrastructure;
  document.getElementById('stat-killed').textContent = formatNumber(stats.casualties.reported_killed);
  document.getElementById('stat-damaged-pct').textContent = infra.structures_damaged_percent + '%';
  document.getElementById('stat-restricted').textContent = (stats.territorial_shrinkage?.idf_controlled_percent || 60) + '%';
  document.getElementById('stat-displaced').textContent = formatNumber(stats.displacement.currently_in_displacement_sites);
}

function dateFromTimeline(value) {
  const totalMs = END_DATE - START_DATE;
  return new Date(START_DATE.getTime() + (value / 100) * totalMs);
}

function filterStrikesByDate(strikes, maxDate) {
  const cutoff = maxDate.toISOString().split('T')[0];
  return strikes.filter(s => s.date <= cutoff);
}

function strikesToGeoJSON(strikes) {
  return {
    type: 'FeatureCollection',
    features: strikes.map(s => ({
      type: 'Feature',
      properties: {
        id: s.id || s.strike_id,
        date: s.date,
        time: s.time,
        verification: s.verification,
        confidence: s.confidence,
        facility_type: s.facility_type,
        casualties: s.casualties || s.casualties_reported || 0,
        destroyed_buildings: s.destroyed_buildings || 0,
        description: s.description || '',
        color: VERIFICATION_COLORS[s.verification] || '#ffd166'
      },
      geometry: {
        type: 'Point',
        coordinates: [s.lng || s.longitude, s.lat || s.latitude]
      }
    }))
  };
}

function fitFullGaza(animate = true) {
  if (!map) return;
  const sidebarOpen = window.innerWidth > 768;
  map.fitBounds(GAZA_BOUNDS, {
    padding: {
      top: 70,
      bottom: 70,
      left: 40,
      right: sidebarOpen ? 340 : 40
    },
    pitch: document.getElementById('layer-3d')?.checked ? 35 : 0,
    bearing: -8,
    duration: animate ? 1200 : 0,
    maxZoom: 10.8
  });
}

function initMap(buildings, hospitals, schools, camps, roads, damageZones, bufferZones, restrictedAreas, devastationOverlay, gazaBoundary, strikes) {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics'
        },
        'labels': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'satellite-base',
          type: 'raster',
          source: 'satellite',
          paint: { 'raster-opacity': 1, 'raster-brightness-min': 0.05, 'raster-contrast': 0.1 }
        },
        {
          id: 'labels',
          type: 'raster',
          source: 'labels',
          paint: { 'raster-opacity': 0.45 }
        }
      ]
    },
    center: [34.385, 31.408],
    zoom: 9.8,
    pitch: 35,
    bearing: -8,
    maxBounds: [[34.05, 31.05], [34.75, 31.75]]
  });

  map.addControl(new maplibregl.NavigationControl(), 'bottom-left');

  map.on('load', () => {
    addGazaBoundary(gazaBoundary);
    addDevastationOverlay(devastationOverlay);
    addRestrictedLayer(restrictedAreas);
    addBufferLayer(bufferZones);
    addDamageZoneLayer(damageZones);
    addBuildingLayer(buildings);
    addRubbleFromBuildings();
    addPointLayer('hospitals', hospitals, '#4ea8de', 'cross');
    addPointLayer('schools', schools, '#ffd166', 'school');
    addPointLayer('camps', camps, '#9b5de5', 'camp');
    addRoadLayer(roads);
    addStrikeLayer(strikes);
    initThreeOverlay(strikes);
    fitFullGaza(false);
    map.resize();
    document.getElementById('loading-screen').classList.add('hidden');
  });

  map.on('click', 'strikes-layer', (e) => {
    if (!e.features.length) return;
    showStrikeDetail(e.features[0].properties);
  });

  map.on('mouseenter', 'strikes-layer', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'strikes-layer', () => map.getCanvas().style.cursor = '');
}

function addGazaBoundary(boundary) {
  map.addSource('gaza-boundary', { type: 'geojson', data: boundary });
  map.addLayer({
    id: 'gaza-boundary-line',
    type: 'line',
    source: 'gaza-boundary',
    paint: {
      'line-color': '#ffffff',
      'line-width': 2.5,
      'line-opacity': 0.9,
      'line-dasharray': [4, 2]
    }
  });
  map.addLayer({
    id: 'gaza-boundary-label',
    type: 'symbol',
    source: 'gaza-boundary',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 13,
      'text-anchor': 'top',
      'text-offset': [0, 1]
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2
    }
  });
}

function addDevastationOverlay(overlay) {
  map.addSource('devastation', { type: 'geojson', data: overlay });
  map.addLayer({
    id: 'devastation-overlay',
    type: 'fill',
    source: 'devastation',
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'damage_percent'],
        70, '#8b4513',
        80, '#8b2020',
        90, '#660000'
      ],
      'fill-opacity': 0.35
    }
  });
}

function addBufferLayer(zones) {
  map.addSource('buffer-zones', { type: 'geojson', data: zones });
  map.addLayer({
    id: 'buffer-zones-fill',
    type: 'fill',
    source: 'buffer-zones',
    paint: {
      'fill-color': '#ffaa00',
      'fill-opacity': 0.25,
      'fill-outline-color': '#ff6600'
    }
  });
  map.addLayer({
    id: 'buffer-zones-labels',
    type: 'symbol',
    source: 'buffer-zones',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 9,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ffaa00',
      'text-halo-color': '#0a0e17',
      'text-halo-width': 1.5
    }
  });
}

function addRestrictedLayer(areas) {
  map.addSource('restricted-areas', { type: 'geojson', data: areas });
  map.addLayer({
    id: 'restricted-areas-fill',
    type: 'fill',
    source: 'restricted-areas',
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'no_go_percent'],
        40, '#ff8c42',
        70, '#ff5533',
        100, '#cc0000'
      ],
      'fill-opacity': 0.12
    }
  });
  map.addLayer({
    id: 'restricted-areas-labels',
    type: 'symbol',
    source: 'restricted-areas',
    layout: {
      'text-field': ['concat', ['get', 'governorate'], ': ', ['get', 'no_go_percent'], '% no-go'],
      'text-size': 10,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ff6600',
      'text-halo-color': '#0a0e17',
      'text-halo-width': 2
    }
  });
}

function addDamageZoneLayer(zones) {
  map.addSource('damage-zones', { type: 'geojson', data: zones });
  map.addLayer({
    id: 'damage-zones-fill',
    type: 'fill',
    source: 'damage-zones',
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['get', 'damage_percent'],
        70, '#ff8c42',
        80, '#ff5533',
        90, '#ff3b3b'
      ],
      'fill-opacity': 0.18
    }
  });
  map.addLayer({
    id: 'damage-zones-outline',
    type: 'line',
    source: 'damage-zones',
    paint: {
      'line-color': '#ff3b3b',
      'line-width': 1.5,
      'line-opacity': 0.4,
      'line-dasharray': [4, 2]
    }
  });
  map.addLayer({
    id: 'damage-zones-labels',
    type: 'symbol',
    source: 'damage-zones',
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['get', 'damage_percent'], '% damaged'],
      'text-size': 11,
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ff3b3b',
      'text-halo-color': '#0a0e17',
      'text-halo-width': 2
    }
  });
}

function addRubbleFromBuildings() {
  map.addLayer({
    id: 'rubble-layer',
    type: 'fill',
    source: 'buildings',
    filter: ['!=', ['get', 'status'], 'intact'],
    paint: {
      'fill-color': [
        'match', ['get', 'status'],
        'destroyed', '#3d0c0c',
        'severely_damaged', '#5c1a1a',
        'moderately_damaged', '#7a2e2e',
        'possibly_damaged', '#8b4513',
        '#8b4513'
      ],
      'fill-opacity': 0.65,
      'fill-outline-color': '#ff2200'
    }
  });
}

function addBuildingLayer(buildings) {
  map.addSource('buildings', { type: 'geojson', data: buildings });

  map.addLayer({
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'buildings',
    filter: ['!=', ['get', 'status'], 'intact'],
    paint: {
      'fill-extrusion-color': [
        'match', ['get', 'status'],
        'destroyed', '#ff2200',
        'severely_damaged', '#cc1100',
        'moderately_damaged', '#ff6633',
        'possibly_damaged', '#ff9944',
        '#8b4513'
      ],
      'fill-extrusion-height': [
        'match', ['get', 'status'],
        'destroyed', 0.2,
        'severely_damaged', 0.5,
        'moderately_damaged', 1,
        'possibly_damaged', 1.5,
        2
      ],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.85
    }
  });

  // Intact structures — rare (~19%), shown small and green
  map.addLayer({
    id: 'buildings-intact',
    type: 'fill-extrusion',
    source: 'buildings',
    filter: ['==', ['get', 'status'], 'intact'],
    paint: {
      'fill-extrusion-color': '#2d6a4f',
      'fill-extrusion-height': ['*', ['get', 'floors'], 3],
      'fill-extrusion-opacity': 0.6
    }
  });
}

function addPointLayer(id, geojson, color, type) {
  map.addSource(id, { type: 'geojson', data: geojson });

  map.addLayer({
    id: `${id}-layer`,
    type: 'circle',
    source: id,
    paint: {
      'circle-radius': type === 'camp' ? 12 : 8,
      'circle-color': color,
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3
    }
  });

  map.addLayer({
    id: `${id}-labels`,
    type: 'symbol',
    source: id,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-offset': [0, 1.5],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#e8ecf1',
      'text-halo-color': '#0a0e17',
      'text-halo-width': 1.5
    }
  });
}

function addRoadLayer(roads) {
  map.addSource('roads', { type: 'geojson', data: roads });
  map.addLayer({
    id: 'roads-layer',
    type: 'line',
    source: 'roads',
    layout: { visibility: 'none' },
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'destroyed', '#ff3b3b',
        'damaged', '#ff8c42',
        'blocked', '#8892a4',
        '#06d6a0'
      ],
      'line-width': 3,
      'line-opacity': 0.7
    }
  });
}

function addStrikeLayer(strikes) {
  const geojson = strikesToGeoJSON(strikes);
  if (map.getSource('strikes')) {
    map.getSource('strikes').setData(geojson);
    return;
  }

  map.addSource('strikes', { type: 'geojson', data: geojson });

  map.addLayer({
    id: 'strikes-glow',
    type: 'circle',
    source: 'strikes',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, 8, 14, 20
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.15,
      'circle-blur': 1
    }
  });

  map.addLayer({
    id: 'strikes-layer',
    type: 'circle',
    source: 'strikes',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, 4, 14, 10
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.9,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5
    }
  });
}

function initThreeOverlay(strikes) {
  const container = document.getElementById('three-overlay');
  threeScene = new THREE.Scene();

  threeCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  threeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  threeRenderer.setSize(container.clientWidth, container.clientHeight);
  threeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(threeRenderer.domElement);

  rebuildStrikeMeshes(strikes);
  animateThree();
}

function rebuildStrikeMeshes(strikes) {
  if (!threeScene) return;
  strikeMeshes.forEach(m => threeScene.remove(m));
  strikeMeshes = [];

  const container = document.getElementById('three-overlay');

  strikes.forEach(strike => {
    const lng = strike.lng || strike.longitude;
    const lat = strike.lat || strike.latitude;
    const point = map.project([lng, lat]);

    const height = (strike.casualties || strike.casualties_reported || 0) * 0.05 + 2;
    const geometry = new THREE.CylinderGeometry(0.3, 0.5, height, 8);
    const color = new THREE.Color(VERIFICATION_COLORS[strike.verification] || '#ffd166');
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: strike.verification === 'confirmed' ? 0.7 : 0.35
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData = { lng, lat, strike };
    mesh.position.set(
      (point.x / container.clientWidth) * 20 - 10,
      height / 2,
      (point.y / container.clientHeight) * 20 - 10
    );

    threeScene.add(mesh);
    strikeMeshes.push(mesh);
  });
}

function animateThree() {
  requestAnimationFrame(animateThree);

  if (!map || !threeRenderer) return;

  const container = document.getElementById('three-overlay');
  strikeMeshes.forEach(mesh => {
    const { lng, lat } = mesh.userData;
    const point = map.project([lng, lat]);
    const height = mesh.geometry.parameters.height;
    mesh.position.set(
      (point.x / container.clientWidth) * 20 - 10,
      height / 2,
      (point.y / container.clientHeight) * 20 - 10
    );
  });

  threeCamera.position.set(0, 15, 15);
  threeCamera.lookAt(0, 0, 0);
  threeRenderer.render(threeScene, threeCamera);
}

function showStrikeDetail(props) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  const full = fullStrikes.find(s => (s.strike_id || s.id) === props.id) || props;

  const sources = full.sources || [];
  const confidencePct = Math.round((full.confidence || props.confidence || 0) * 100);

  content.innerHTML = `
    <div class="detail-row">
      <div class="detail-label">Strike ID</div>
      <div class="detail-value">${props.id}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Date & Time</div>
      <div class="detail-value">${props.date} ${props.time || ''}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Verification</div>
      <div class="detail-value" style="color:${VERIFICATION_COLORS[props.verification]}">${props.verification}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Confidence</div>
      <div class="detail-value">${confidencePct}%</div>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${confidencePct}%;background:${VERIFICATION_COLORS[props.verification]}"></div></div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Facility</div>
      <div class="detail-value">${props.facility_type || 'unknown'}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Casualties Reported</div>
      <div class="detail-value">${props.casualties || 0}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">Buildings Destroyed</div>
      <div class="detail-value">${props.destroyed_buildings || 0}</div>
    </div>
    ${full.description ? `<div class="detail-row"><div class="detail-label">Description</div><div class="detail-value">${full.description}</div></div>` : ''}
    ${sources.length ? `<div class="detail-row detail-sources"><div class="detail-label">Sources</div>${sources.map(s => `<a href="${s.url}" target="_blank">${s.name}</a>`).join('')}</div>` : ''}
  `;

  panel.style.display = 'block';
}

function updateTimeline(value) {
  timelineValue = value;
  const date = dateFromTimeline(value);
  document.getElementById('timeline-date').textContent = date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const filtered = filterStrikesByDate(strikesData, date);
  if (map && map.isStyleLoaded()) {
    addStrikeLayer(filtered);
    rebuildStrikeMeshes(filtered);
  }
}

function setupControls() {
  const slider = document.getElementById('timeline-slider');
  slider.addEventListener('input', (e) => updateTimeline(Number(e.target.value)));

  document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) {
      clearInterval(playInterval);
      isPlaying = false;
      document.getElementById('btn-play').textContent = '▶';
    } else {
      isPlaying = true;
      document.getElementById('btn-play').textContent = '⏸';
      slider.value = 0;
      playInterval = setInterval(() => {
        let v = Number(slider.value) + 0.5;
        if (v >= 100) {
          clearInterval(playInterval);
          isPlaying = false;
          document.getElementById('btn-play').textContent = '▶';
          v = 100;
        }
        slider.value = v;
        updateTimeline(v);
      }, 80);
    }
  });

  document.getElementById('btn-fit').addEventListener('click', () => fitFullGaza(true));

  document.getElementById('btn-reset').addEventListener('click', () => {
    slider.value = 100;
    updateTimeline(100);
    fitFullGaza(true);
  });

  const layerMap = {
    'layer-strikes': ['strikes-layer', 'strikes-glow'],
    'layer-buildings': ['buildings-3d', 'buildings-intact', 'gaza-boundary-line', 'gaza-boundary-label'],
    'layer-rubble': ['rubble-layer', 'devastation-overlay'],
    'layer-damage-zones': ['damage-zones-fill', 'damage-zones-outline', 'damage-zones-labels'],
    'layer-buffer': ['buffer-zones-fill', 'buffer-zones-labels'],
    'layer-restricted': ['restricted-areas-fill', 'restricted-areas-labels'],
    'layer-hospitals': ['hospitals-layer', 'hospitals-labels'],
    'layer-schools': ['schools-layer', 'schools-labels'],
    'layer-camps': ['camps-layer', 'camps-labels'],
    'layer-roads': ['roads-layer']
  };

  Object.entries(layerMap).forEach(([checkboxId, layers]) => {
    document.getElementById(checkboxId).addEventListener('change', (e) => {
      const vis = e.target.checked ? 'visible' : 'none';
      layers.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });
    });
  });

  document.getElementById('layer-3d').addEventListener('change', (e) => {
    const pitch = e.target.checked ? 55 : 0;
    map.easeTo({ pitch, duration: 800 });
    document.getElementById('three-overlay').style.display = e.target.checked ? 'block' : 'none';
  });

  window.addEventListener('resize', () => {
    if (map) {
      map.resize();
      fitFullGaza(false);
    }
    if (threeRenderer) {
      const container = document.getElementById('three-overlay');
      threeRenderer.setSize(container.clientWidth, container.clientHeight);
      threeCamera.aspect = container.clientWidth / container.clientHeight;
      threeCamera.updateProjectionMatrix();
    }
  });
}

async function main() {
  try {
    const data = await loadData();
    strikesData = data.strikes;
    fullStrikes = data.strikeDetails;
    statsData = data.stats;

    updateHeaderStats(data.stats);
    initMap(data.buildings, data.hospitals, data.schools, data.camps, data.roads, data.damageZones, data.bufferZones, data.restrictedAreas, data.devastationOverlay, data.gazaBoundary, data.strikes);
    setupControls();

    // Fallback hide loading screen if map load is slow
    setTimeout(() => {
      document.getElementById('loading-screen').classList.add('hidden');
      if (map) map.resize();
    }, 8000);
  } catch (err) {
    console.error('Failed to load:', err);
    document.querySelector('.loader-content p').textContent = 'Error loading data. Check console.';
    document.getElementById('loading-screen').classList.add('hidden');
  }
}

main();
