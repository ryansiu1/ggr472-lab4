/*--------------------------------------------------------------------
GGR472 LAB 4: Incorporating GIS Analysis into web maps using Turf.js 
--------------------------------------------------------------------*/

/*--------------------------------------------------------------------
Step 1: INITIALIZE MAP
--------------------------------------------------------------------*/
//Define access token
mapboxgl.accessToken = 'pk.eyJ1IjoibXJpbm1heWVlZSIsImEiOiJjbGRtMHNobWkwMnRhM25teTJ6Y3poYWY3In0.7jz_b3HAoeEVcCmXB3qCKA'; //****ADD YOUR PUBLIC ACCESS TOKEN*****

// define the boundary extent for the map body as a variable
const maxBounds = [
    [-80.2, 43.3], //SW coords
    [-78.6, 44] //NE coords
];

//Initialize map and edit to your preference
const map = new mapboxgl.Map({
    container: 'map', //container id in HTML
    style: 'mapbox://styles/mapbox/dark-v11',  //****ADD MAP STYLE HERE *****
    zoom: 9, // starting zoom level
    bearing: -16.6, // compass bearing for map
    minZoom: 8, // minimum zoom level
    maxZoom: 12.5, // maximum zoom level
    maxBounds: maxBounds // using the defined boundaries and setting the max bounds
});

map.on('style.load', () => { // Set the default atmosphere style, this adds the 'foggy' like feature when fully zoomed out
    map.setFog({});
});

//Add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl());

//Add fullscreen option to the map
map.addControl(new mapboxgl.FullscreenControl());

/*--------------------------------------------------------------------
Step 2: VIEW GEOJSON POINT DATA ON MAP
--------------------------------------------------------------------*/
let collisionsjson;

// fetch GeoJSON from URL and store response
fetch('https://raw.githubusercontent.com/ryansiu1/datarepo/main/pedcyc_collision_06-21.geojson')
    .then(response => response.json())
    .then(response => {
        console.log(response); // console.log response in developer tools
        collisionsjson = response; // geojson is stored as variable in response
    });


/*--------------------------------------------------------------------
    Step 3: CREATE BOUNDING BOX AND HEXGRID
--------------------------------------------------------------------*/
map.on('load', () => {

    map.addSource('collisons', {
        type: 'geojson',
        data: collisionsjson
    });

    map.addLayer(
        {
            'id': 'collisions',
            'type': 'circle',
            'source': 'collisons',
            'paint': {
                'circle-radius': 5,
                'circle-color': '#ecec10',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#0077b6'
            }
        });

    let bboxgeojson; // variable to hold the bounding box feature
    let bbox = turf.envelope(collisionsjson); // using the envelope tool to create bounding box
    let bboxscaled = turf.transformScale(bbox, 1.1); // increasing the size of the hexagons

    bboxgeojson = {
        "type": "FeatureCollection",
        features: [bboxscaled]
    };

    let bboxcoords = [bboxscaled.geometry.coordinates[0][0][0], // accessing the bounding box coordinates
    bboxscaled.geometry.coordinates[0][0][1],
    bboxscaled.geometry.coordinates[0][2][0],
    bboxscaled.geometry.coordinates[0][2][1],
    ];

    let hexgrid = turf.hexGrid(bboxcoords, 0.5, { units: 'kilometers' }); // creating the hexgrid with 0.5 km

    /*--------------------------------------------------------------------
    Step 4: AGGREGATE COLLISIONS BY HEXGRID
    --------------------------------------------------------------------*/
    // the following code aggregrates the collisions in each hexagon and adds them to a total count as a geojson property
    let collishex = turf.collect(hexgrid, collisionsjson, '_id', 'values');

    let maxcollision = 0;

    collishex.features.forEach((feature) => {
        feature.properties.COUNT = feature.properties.values.length
        if (feature.properties.COUNT > maxcollision) {
            console.log(feature);
            maxcollision = feature.properties.COUNT
        }
    })

    map.addSource('hexgrid-layer', {
        "type": "geojson",
        "data": hexgrid
    });
    map.addLayer({
        "id": "Hexagons",
        "type": "fill",
        "source": "hexgrid-layer",
        "paint": {
            'fill-color': [
                'step',
                ['get', 'COUNT'],
                '#034C3C',
                5, '#84894A',
                20, '#A6A15E',
                35, '#C69F89',
                45, '#93032E'
            ],
            'fill-opacity': 1,
            'fill-outline-color': "black"
        }

    });
    map.addLayer({ // adding another layer as the hover effect layer (different outline colour)
        "id": "Hexagons-fill",
        "type": "fill",
        "source": "hexgrid-layer",
        "paint": {
            'fill-color': [
                'step',
                ['get', 'COUNT'],
                '#034C3C',
                5, '#84894A',
                20, '#A6A15E',
                35, '#C69F89',
                45, '#93032E'
            ],
            'fill-opacity': 1,
            'fill-outline-color': "white"
        },
        'filter': ['==', ['get', 'COUNT'], ''] // This filter will disable the layer from appearing until it is hovered over
    });

});

// Attempt at 3D extrusions for the hexagons
// 'paint': {
//     // Get the `fill-extrusion-color` from the source `color` property.
//     'fill-extrusion-color': ['get', 'COUNT'],

//     // Get `fill-extrusion-height` from the source `height` property.
//     'fill-extrusion-height': ['get', 'COUNT'],

//     // Get `fill-extrusion-base` from the source `base_height` property.
//     'fill-extrusion-base': ['get', 'COUNT'],

//     // Make extrusions slightly opaque to see through indoor walls.
//     'fill-extrusion-opacity': 0.5
//     }

// /*--------------------------------------------------------------------
// Step 5: FINALIZE YOUR WEB MAP
// --------------------------------------------------------------------*/

// Add a hover effect for the hexagon when the mouse is over it
map.on('mousemove', 'Hexagons', (e) => {
    if (e.features.length > 0) { // determines if there is a feature under the mouse
        map.setFilter('Hexagons-fill', ['==', ['get', 'COUNT'], e.features[0].properties.COUNT]); // applies the filter set above
    }
});

map.on('mouseleave', 'Hexagons-fill', () => { //removes the highlight when the mouse moves away
    map.setFilter("Hexagons-fill", ['==', ['get', 'COUNT'], '']);
});

// Create popups upon a click for each hexagon polygon
map.on('click', 'Hexagons', (e) => {
    new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML("This hexagon contains " + e.features[0].properties.COUNT + " collision(s).")
        .addTo(map);
});

// Changes the cursor to a link pointer when the mouse is over a hexagon
map.on('mouseenter', 'Hexagons', () => {
    map.getCanvas().style.cursor = 'pointer';
});

// Changes the cursor back to a pointer when it leaves a hexagon.
map.on('mouseleave', 'Hexagons', () => {
    map.getCanvas().style.cursor = '';
});

// Add a button to toggle the hexgrid layer on/off
map.on('idle', () => {
    // Enumerate ids of the layers.
    const toggleableLayerIds = ['Hexagons'];

    // Set up the corresponding toggle button for each layer.
    for (const id of toggleableLayerIds) {
        // Skip layers that already have a button set up.
        if (document.getElementById(id)) {
            continue;
        }

        // Create a link.
        const toggle = document.createElement('a');
        toggle.id = id;
        toggle.href = '#';
        toggle.textContent = id;
        toggle.className = 'active';

        // Show or hide layer when the toggle is clicked.
        toggle.onclick = function (e) {
            const clickedLayer = this.textContent;
            e.preventDefault();
            e.stopPropagation();

            const visibility = map.getLayoutProperty(
                clickedLayer,
                'visibility'
            );

            // Toggle layer visibility by changing the layout object's visibility property.
            if (visibility === 'visible') {
                map.setLayoutProperty(clickedLayer, 'visibility', 'none');
                this.className = '';
            } else {
                this.className = 'active';
                map.setLayoutProperty(
                    clickedLayer,
                    'visibility',
                    'visible'
                );
            }
        };

        const layers = document.getElementById('menu');
        layers.appendChild(toggle);
    }
});

// Add a dynamic textbox that will change when hovering over different collision point.
map.on("mousemove", function (e) {
    var features = map.queryRenderedFeatures(e.point, {
        layers: ["collisions"]
    });

    if (features.length) {
        //show median income in textbox
        document.getElementById('indicator').innerHTML = "This collision occured in " + features[0].properties.NEIGHBOURHOOD_158 + " and is a " + features[0].properties.ACCLASS;

    } else {
        //if not hovering over a feature set indicator to default message
        document.getElementById('indicator').innerHTML = "Toggle the hexagons layer and hover your cursor over a collision point";
    }
});
